-- =====================================================
-- 🚨 FIX CRÍTICO: ESCALADA DE PRIVILEGIOS VÍA COLUMNA role
-- =====================================================
-- PROBLEMA:
--   La política "Users can update their own data" permite UPDATE sobre
--   la fila propia sin restringir columnas. Como un UPDATE sin WITH CHECK
--   reutiliza la expresión de USING, lo único que se valida es que la fila
--   siga siendo la del propio usuario: la columna `role` queda libre.
--
--   Cualquier usuario autenticado puede ejecutar desde el navegador:
--     supabase.from('users').update({ role: 'admin' }).eq('id', <su id>)
--   y convertirse en administrador (ver todos los usuarios, ver/editar/borrar
--   las prendas de todos, gestionar cajas y tags NFC).
--
-- SOLUCIÓN (defensa en profundidad, 3 capas):
--   Capa 1: trigger BEFORE UPDATE que congela `role` para no-admins.
--   Capa 2: REVOKE del privilegio UPDATE sobre la columna `role`.
--   Capa 3: WITH CHECK explícito en la política.
--
-- Este script es idempotente: se puede ejecutar varias veces.
-- Ejecutar en Supabase → SQL Editor.
-- =====================================================

-- =====================================================
-- 🔧 PASO 0: FUNCIÓN is_admin() (requisito previo)
-- =====================================================
-- SECURITY DEFINER + search_path fijo: consulta users saltándose RLS,
-- por lo que NO provoca recursión al usarse dentro de políticas de users.

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

-- =====================================================
-- 🛡️ PASO 1 (CAPA 1): TRIGGER QUE CONGELA LA COLUMNA role
-- =====================================================
-- Reglas:
--   - service_role (backend con clave de servicio): puede cambiar el rol.
--   - Un admin autenticado: puede cambiar el rol (gestión legítima).
--   - Cualquier otro caso: NEW.role se fuerza al valor anterior.
-- Se fuerza el valor en vez de lanzar excepción para que la app siga
-- funcionando cuando envía la fila completa (p. ej. updateProfile).

CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF auth.role() = 'service_role' OR public.is_admin() THEN
      RETURN NEW;  -- cambio de rol autorizado
    END IF;

    RAISE WARNING 'Intento de cambio de rol bloqueado para el usuario % (% -> %)',
      OLD.id, OLD.role, NEW.role;
    NEW.role := OLD.role;  -- se ignora silenciosamente el cambio
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.users;
CREATE TRIGGER trg_prevent_role_escalation
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_escalation();

-- =====================================================
-- 🛡️ PASO 2 (CAPA 2): RESTRINGIR UPDATE A COLUMNAS CONCRETAS
-- =====================================================
-- ⚠️ OJO: un `REVOKE UPDATE (role)` NO funciona si el rol tiene UPDATE a
-- nivel de TABLA (que es como Supabase concede permisos por defecto). Los
-- privilegios de tabla y de columna son independientes: el de tabla cubre
-- todas las columnas y el revoke por columna no lo resta (Postgres emite
-- "WARNING: no privileges could be revoked for column").
--
-- La forma correcta: revocar el UPDATE de tabla y volver a concederlo solo
-- sobre las columnas que la app necesita editar. Así PostgREST devuelve 403
-- en cuanto el payload incluye "role", antes incluso de llegar al trigger.

REVOKE UPDATE ON public.users FROM authenticated;
REVOKE UPDATE ON public.users FROM anon;

-- Columnas que sí puede editar el usuario desde la app.
-- Quedan fuera a propósito: role (escalada), id y created_at (inmutables).
-- Referencia: hooks/useAuth.ts:254 (updateProfile) y components/weather/weather-card.tsx:74 (city)
GRANT UPDATE (email, full_name, city, preferences, updated_at)
  ON public.users TO authenticated;

-- Nota: con esto, un admin tampoco puede cambiar roles DESDE LA APP
-- (el trigger se lo permitiría, pero el GRANT no). Es deliberado: los roles
-- se asignan por SQL, que es como ya lo hace el proyecto
-- (README.md, scripts/make-admin.js, SET_ADMIN_ROLE.sql).

-- =====================================================
-- 🛡️ PASO 3 (CAPA 3): WITH CHECK EXPLÍCITO EN LA POLÍTICA
-- =====================================================
-- Nota: una política RLS no puede comparar la fila nueva con la antigua
-- (WITH CHECK solo ve NEW), por eso el trigger del paso 1 es imprescindible.
-- Este WITH CHECK deja explícito que un usuario no puede reasignar su fila.

DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
CREATE POLICY "Users can update their own data" ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- =====================================================
-- 🔁 PASO 4: CORREGIR LA POLÍTICA RECURSIVA DE ADMINS
-- =====================================================
-- UPDATE_USERS_RLS_FOR_ADMINS.sql crea una política sobre users que hace
-- SELECT ... FROM public.users dentro de sí misma → recursión infinita
-- (error 500 en el login de todos). Se sustituye por is_admin().

DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT
  USING (public.is_admin());

-- =====================================================
-- ✅ PASO 5: VERIFICACIÓN
-- =====================================================

-- 5.1 El trigger debe existir
SELECT tgname AS trigger_name, tgenabled AS habilitado
FROM pg_trigger
WHERE tgrelid = 'public.users'::regclass
  AND NOT tgisinternal;

-- 5.2 'authenticated' NO debe tener UPDATE a nivel de tabla...
SELECT grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public' AND table_name = 'users'
  AND privilege_type = 'UPDATE'
ORDER BY grantee;
-- (esperado: NO aparece 'authenticated'; sí pueden aparecer postgres/service_role)

-- ...y sí debe tenerlo sobre las columnas permitidas, nunca sobre 'role'
SELECT grantee, column_name, privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name = 'users'
  AND privilege_type = 'UPDATE' AND grantee = 'authenticated'
ORDER BY column_name;
-- (esperado: email, full_name, city, preferences, updated_at — y NUNCA role)

-- 5.3 Políticas activas sobre users
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'users'
ORDER BY cmd, policyname;

-- 5.4 PRUEBA DE HUMO (ejecutar como usuario NO admin desde la app):
--     await supabase.from('users').update({ role: 'admin' }).eq('id', <su id>)
--     Resultado esperado: error 403 de PostgREST, o éxito aparente pero
--     con role sin cambiar. Confirmar con:
--       SELECT id, email, role FROM public.users ORDER BY created_at;

-- =====================================================
-- 📌 PROMOVER A UN ADMIN LEGÍTIMO (desde el SQL Editor)
-- =====================================================
-- El SQL Editor corre como superusuario, así que el trigger lo permite:
-- UPDATE public.users SET role = 'admin' WHERE email = 'tu@email.com';
