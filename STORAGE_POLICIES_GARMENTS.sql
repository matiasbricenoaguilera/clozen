-- =====================================================
-- 🗄️ POLÍTICAS DE STORAGE PARA EL BUCKET "garments"
-- =====================================================
-- PROBLEMA:
--   La ruta de subida la decide el cliente:
--     src/app/closet/add/page.tsx:460
--       `garments/${selectedUserId || userProfile?.id}/${fileName}`
--   `selectedUserId` es estado de React, manipulable. Sin políticas que
--   aten el prefijo a auth.uid(), un usuario puede escribir (o borrar)
--   dentro de la carpeta de otro usuario.
--   Además no hay límite de tamaño ni de tipo MIME en el bucket: las
--   validaciones de components/ui/file-upload.tsx son solo de cliente.
--
-- ESTRUCTURA DE RUTAS (bucket "garments"):
--   garments/{user_id}/{timestamp}-{random}.jpg
--   → split_part(name, '/', 2) = user_id propietario
--
-- REGLA APLICADA:
--   Escribir/actualizar/borrar solo dentro del prefijo propio,
--   salvo administradores (la app permite que un admin registre
--   prendas para otro usuario).
--
-- Ejecutar en Supabase → SQL Editor.
-- =====================================================

-- =====================================================
-- 🔍 PASO 1: DIAGNÓSTICO — QUÉ HAY AHORA
-- =====================================================
-- ⚠️ IMPORTANTE: si el bucket ya funciona, es porque existen políticas
-- permisivas creadas desde el dashboard (nombres tipo "Give users access
-- to own folder" o "Enable insert for authenticated users only").
-- Revisa esta lista y ELIMINA a mano las que dejen escribir sin restringir
-- el prefijo, o las nuevas políticas no servirán de nada: en RLS las
-- políticas PERMISSIVE se combinan con OR.

SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY cmd, policyname;

-- Para eliminar una política permisiva antigua:
--   DROP POLICY "<nombre exacto>" ON storage.objects;
--
-- ⚠️ DETECTADA EN ESTE PROYECTO (verificado el 2026-08-23):
--   "Users can upload garment images" (INSERT) — no comprueba auth.uid(),
--   permite a cualquier usuario autenticado escribir en CUALQUIER carpeta.
--   Queda sustituida por garments_insert_own_folder:
--     DROP POLICY "Users can upload garment images" ON storage.objects;

-- Estado actual del bucket
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'garments';

-- =====================================================
-- 🔧 PASO 2: FUNCIÓN is_admin() (requisito previo)
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- =====================================================
-- 🛡️ PASO 3: POLÍTICAS DE ESCRITURA ATADAS AL PREFIJO
-- =====================================================

-- 3.1 INSERT: solo en la carpeta propia (o admin)
DROP POLICY IF EXISTS "garments_insert_own_folder" ON storage.objects;
CREATE POLICY "garments_insert_own_folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'garments'
    AND split_part(name, '/', 1) = 'garments'
    AND (
      split_part(name, '/', 2) = auth.uid()::text
      OR public.is_admin()
    )
  );

-- 3.2 UPDATE: solo objetos de la carpeta propia (o admin)
DROP POLICY IF EXISTS "garments_update_own_folder" ON storage.objects;
CREATE POLICY "garments_update_own_folder" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'garments'
    AND (split_part(name, '/', 2) = auth.uid()::text OR public.is_admin())
  )
  WITH CHECK (
    bucket_id = 'garments'
    AND (split_part(name, '/', 2) = auth.uid()::text OR public.is_admin())
  );

-- 3.3 DELETE: solo objetos de la carpeta propia (o admin)
-- Lo usa components/garments/edit-garment-modal.tsx:474 al reemplazar imagen.
DROP POLICY IF EXISTS "garments_delete_own_folder" ON storage.objects;
CREATE POLICY "garments_delete_own_folder" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'garments'
    AND (split_part(name, '/', 2) = auth.uid()::text OR public.is_admin())
  );

-- 3.4 SELECT para clientes autenticados (listar/descargar vía API).
-- Mientras el bucket sea público, las imágenes se sirven por
-- /storage/v1/object/public/** SIN pasar por RLS: esta política solo
-- afecta al acceso autenticado y a list(). Es la que hará el trabajo
-- si algún día pasas el bucket a privado (ver PASO 5).
DROP POLICY IF EXISTS "garments_select_authenticated" ON storage.objects;
CREATE POLICY "garments_select_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'garments');

-- =====================================================
-- 📏 PASO 4: LÍMITES DE TAMAÑO Y TIPO EN EL BUCKET
-- =====================================================
-- Aplica en el servidor de Storage, no se puede saltar desde el cliente.
-- 10 MB = el mismo límite que valida components/ui/file-upload.tsx.
-- La app convierte siempre a JPEG antes de subir (closet/add/page.tsx:458).

UPDATE storage.buckets
SET file_size_limit  = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'garments';

-- =====================================================
-- 🔒 PASO 5 (OPCIONAL, NO APLICADO): BUCKET PRIVADO
-- =====================================================
-- Hoy el bucket es público: las fotos de la ropa de cualquier usuario son
-- accesibles por URL sin autenticación. Las URLs son difíciles de adivinar
-- (Date.now() + Math.random()), pero eso es oscuridad, no control de acceso.
--
-- Pasarlo a privado NO es solo este UPDATE — requiere cambios de código:
--   1) UPDATE storage.buckets SET public = false WHERE id = 'garments';
--   2) Sustituir getPublicUrl() por createSignedUrl(path, ttl) en
--      src/app/closet/add/page.tsx:471 y edit-garment-modal.tsx:353
--   3) Guardar el PATH en garments.image_url (no la URL firmada, que caduca)
--      y firmar en el momento de renderizar → migración de los datos ya guardados
--   4) Ajustar remotePatterns en next.config.ts (la ruta deja de ser /public/)
--   5) Restringir el SELECT del paso 3.4 al prefijo propio o de admin
-- Decisión pendiente: valóralo según lo sensibles que consideres las fotos.

-- =====================================================
-- ✅ PASO 6: VERIFICACIÓN
-- =====================================================

-- 6.1 Deben aparecer las 4 políticas nuevas y NINGUNA permisiva antigua
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY cmd, policyname;

-- 6.2 Límites aplicados
SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'garments';

-- 6.3 PRUEBA DE HUMO (como usuario NO admin, desde la consola del navegador):
--   const otro = '<uuid de otro usuario>'
--   await supabase.storage.from('garments')
--     .upload(`garments/${otro}/test.jpg`, new Blob(['x'], {type:'image/jpeg'}))
--   Resultado esperado: error "new row violates row-level security policy".
--   Subir en la carpeta propia debe seguir funcionando.
