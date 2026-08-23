-- =====================================================
-- 🔎 VERIFICACIÓN DE LOS PARCHES DE SEGURIDAD
-- =====================================================
-- Ejecutar ENTERO en Supabase → SQL Editor y revisar la columna "resultado".
-- Todo debe salir ✅. Cualquier ❌ indica un paso que no se aplicó.
-- =====================================================

WITH checks AS (

  -- 1. Trigger anti-escalada activo
  SELECT 1 AS n,
    'Trigger prevent_role_escalation' AS chequeo,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgrelid = 'public.users'::regclass
        AND tgname = 'trg_prevent_role_escalation'
        AND tgenabled = 'O'
    ) THEN '✅ activo' ELSE '❌ FALTA o deshabilitado' END AS resultado,
    'Capa 1: impide cambiar users.role' AS detalle

  UNION ALL

  -- 2. La función del trigger existe y es SECURITY DEFINER
  SELECT 2,
    'Funcion prevent_role_escalation()',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'prevent_role_escalation'
        AND p.prosecdef
    ) THEN '✅ existe (SECURITY DEFINER)' ELSE '❌ FALTA' END,
    'Necesaria para el trigger'

  UNION ALL

  -- 3. authenticated NO debe tener UPDATE a nivel de tabla
  SELECT 3,
    'UPDATE de tabla en users revocado',
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.table_privileges
      WHERE table_schema = 'public' AND table_name = 'users'
        AND privilege_type = 'UPDATE' AND grantee = 'authenticated'
    ) THEN '✅ revocado' ELSE '❌ authenticated aún tiene UPDATE de TABLA' END,
    'Si falla, el GRANT por columnas no sirve de nada'

  UNION ALL

  -- 4. La columna role NO debe ser actualizable por authenticated
  SELECT 4,
    'Columna users.role protegida',
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.column_privileges
      WHERE table_schema = 'public' AND table_name = 'users'
        AND column_name = 'role' AND privilege_type = 'UPDATE'
        AND grantee = 'authenticated'
    ) THEN '✅ no actualizable' ELSE '❌ authenticated puede escribir role' END,
    'Capa 2: PostgREST devuelve 403 si el payload trae role'

  UNION ALL

  -- 5. Las columnas de perfil sí deben seguir siendo editables (que no rompa la app)
  SELECT 5,
    'Columnas de perfil editables',
    CASE WHEN (
      SELECT count(*) FROM information_schema.column_privileges
      WHERE table_schema = 'public' AND table_name = 'users'
        AND privilege_type = 'UPDATE' AND grantee = 'authenticated'
        AND column_name IN ('email','full_name','city','preferences','updated_at')
    ) = 5 THEN '✅ las 5 concedidas' ELSE '⚠️ revisar: updateProfile podría fallar' END,
    'city la usa weather-card.tsx:74'

  UNION ALL

  -- 6. is_admin() existe y es SECURITY DEFINER (evita recursión RLS)
  SELECT 6,
    'Funcion is_admin()',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'is_admin' AND p.prosecdef
    ) THEN '✅ existe (SECURITY DEFINER)' ELSE '❌ FALTA' END,
    'Sin ella las politicas de admin recursan'

  UNION ALL

  -- 7. La política de admins sobre users no debe ser recursiva
  SELECT 7,
    'Politica admins users NO recursiva',
    COALESCE((
      SELECT CASE
        WHEN qual LIKE '%is_admin%' THEN '✅ usa is_admin()'
        ELSE '❌ RECURSIVA: consulta users dentro de users'
      END
      FROM pg_policies
      WHERE schemaname='public' AND tablename='users'
        AND policyname='Admins can view all users'
    ), '⚠️ la politica no existe'),
    'La version recursiva provoca error 500 en el login'

  UNION ALL

  -- 8. Políticas de escritura del bucket garments
  SELECT 8,
    'Politicas storage garments',
    CASE WHEN (
      SELECT count(*) FROM pg_policies
      WHERE schemaname='storage' AND tablename='objects'
        AND policyname IN ('garments_insert_own_folder','garments_update_own_folder',
                           'garments_delete_own_folder','garments_select_authenticated')
    ) = 4 THEN '✅ las 4 creadas' ELSE '❌ faltan politicas (revisar STORAGE_POLICIES_GARMENTS.sql)' END,
    'Atan la escritura al prefijo del propio usuario'

  UNION ALL

  -- 9. ⚠️ EL CHEQUEO MÁS IMPORTANTE: políticas permisivas antiguas
  -- En RLS las políticas PERMISSIVE se combinan con OR: una sola política
  -- de escritura que no compruebe auth.uid() anula todo lo anterior.
  SELECT 9,
    'Sin politicas permisivas antiguas',
    CASE WHEN (
      SELECT count(*) FROM pg_policies
      WHERE schemaname='storage' AND tablename='objects'
        AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
        AND COALESCE(qual,'') || COALESCE(with_check,'') NOT LIKE '%auth.uid()%'
    ) = 0 THEN '✅ ninguna'
    ELSE '❌ HAY POLITICAS ABIERTAS: ' || (
      SELECT string_agg(policyname || ' (' || cmd || ')', ', ')
      FROM pg_policies
      WHERE schemaname='storage' AND tablename='objects'
        AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
        AND COALESCE(qual,'') || COALESCE(with_check,'') NOT LIKE '%auth.uid()%'
    ) END,
    'Si sale ❌: DROP POLICY "<nombre>" ON storage.objects;'

  UNION ALL

  -- 10. RLS habilitado en las tablas del dominio
  SELECT 10,
    'RLS habilitado en todas las tablas',
    CASE WHEN (
      SELECT count(*) FROM pg_tables
      WHERE schemaname='public'
        AND tablename IN ('users','boxes','garments','outfits','usage_history','nfc_tags')
        AND rowsecurity
    ) = 6 THEN '✅ las 6 tablas' ELSE '❌ alguna tabla sin RLS' END,
    'Base de todo el modelo de seguridad'
)
SELECT chequeo, resultado, detalle
FROM checks
ORDER BY n;
