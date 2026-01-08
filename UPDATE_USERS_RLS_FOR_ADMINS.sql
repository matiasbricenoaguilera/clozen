-- =====================================================
-- 🔧 ACTUALIZACIÓN DE POLÍTICAS RLS PARA USUARIOS
-- Permitir que los administradores vean todos los usuarios
-- =====================================================

-- Paso 1: Verificar el rol del usuario actual
-- (Ejecuta esto primero para verificar que eres admin)
SELECT 
  id,
  email,
  role,
  full_name
FROM public.users
WHERE id = auth.uid();

-- Paso 2: Si el usuario actual NO es admin, actualízalo manualmente:
-- UPDATE public.users SET role = 'admin' WHERE email = 'tu-email@ejemplo.com';

-- Paso 3: Eliminar políticas existentes que puedan causar conflictos
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;

-- Paso 4: Crear política para que admins puedan ver todos los usuarios
-- Esta política usa una subconsulta optimizada con LIMIT para mejor rendimiento
CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT 
  USING (
    -- Verificar si el usuario actual es admin
    -- Usamos una subconsulta optimizada con LIMIT para mejor rendimiento
    (SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1) = 'admin'
  );

-- Paso 5: Verificar que RLS esté habilitado en la tabla users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- ✅ VERIFICACIÓN Y DIAGNÓSTICO
-- =====================================================

-- Verificar que las políticas estén activas
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

-- Verificar que RLS esté habilitado
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'users';

-- Probar la política: contar usuarios visibles para el admin actual
SELECT COUNT(*) as total_users_visible
FROM public.users;

-- Listar todos los usuarios visibles (debería mostrar todos si eres admin)
SELECT 
  id,
  email,
  role,
  full_name,
  created_at
FROM public.users
ORDER BY created_at DESC;

-- =====================================================
-- 📋 RESULTADO ESPERADO
-- =====================================================
-- Después de ejecutar este script:
-- 1. Deberías ver tu usuario con role = 'admin' en el primer SELECT
-- 2. Deberías ver al menos 2 políticas para la tabla users:
--    - "Users can view their own data" (para usuarios normales)
--    - "Admins can view all users" (para administradores)
-- 3. El COUNT(*) debería mostrar el total de usuarios registrados
-- 4. El último SELECT debería mostrar TODOS los usuarios si eres admin
-- =====================================================
