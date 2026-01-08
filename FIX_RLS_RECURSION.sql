-- =====================================================
-- 🔧 SOLUCIÓN AL ERROR 500: RECURSIÓN EN POLÍTICAS RLS
-- =====================================================
-- El problema: La política "Admins can view all users" causa recursión
-- porque intenta consultar la tabla users dentro de la política RLS.
-- Solución: Usar una función SECURITY DEFINER para verificar el rol.
-- =====================================================

-- Paso 1: Crear función para verificar si el usuario actual es admin
-- Esta función se ejecuta con privilegios de superusuario, evitando la recursión
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
END;
$$;

-- Paso 2: Eliminar la política problemática
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;

-- Paso 3: Crear la política usando la función (evita recursión)
CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT 
  USING (public.is_admin());

-- Paso 4: Verificar que el usuario tenga rol admin
-- (Ejecuta esto primero para verificar que eres admin)
SELECT 
  id,
  email,
  role,
  full_name
FROM public.users
WHERE email = 'matiasbricenoaguilera@gmail.com';

-- Si el role NO es 'admin', ejecuta esto:
UPDATE public.users 
SET role = 'admin'
WHERE email = 'matiasbricenoaguilera@gmail.com';

-- Paso 5: Verificar que las políticas estén correctas
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'users'
ORDER BY policyname;

-- Paso 6: Actualizar políticas de boxes que también tienen recursión
DROP POLICY IF EXISTS "Admins can manage boxes" ON public.boxes;
CREATE POLICY "Admins can manage boxes" ON public.boxes
  FOR ALL USING (public.is_admin());

-- Paso 7: Actualizar políticas de nfc_tags que también tienen recursión
DROP POLICY IF EXISTS "Admins can manage NFC tags" ON public.nfc_tags;
CREATE POLICY "Admins can manage NFC tags" ON public.nfc_tags
  FOR ALL USING (public.is_admin());

-- Paso 8: Probar la función
SELECT public.is_admin() as es_admin;

-- Paso 9: Verificar todas las políticas actualizadas
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND (tablename = 'users' OR tablename = 'boxes' OR tablename = 'nfc_tags')
ORDER BY tablename, policyname;

-- =====================================================
-- ✅ RESULTADO ESPERADO
-- =====================================================
-- Después de ejecutar este script:
-- 1. La función is_admin() debería retornar true si eres admin
-- 2. Deberías ver 2 políticas SELECT para users:
--    - "Users can view their own data"
--    - "Admins can view all users"
-- 3. Las políticas de boxes y nfc_tags también usarán is_admin()
-- 4. El error 500 debería desaparecer completamente
-- =====================================================

