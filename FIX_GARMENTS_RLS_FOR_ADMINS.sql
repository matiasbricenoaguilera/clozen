-- =====================================================
-- 🔧 SOLUCIÓN AL ERROR 403: POLÍTICAS RLS PARA PRENDAS
-- =====================================================
-- El problema: Los admins no pueden insertar/actualizar/eliminar
-- prendas para otros usuarios porque las políticas solo permiten
-- operaciones sobre prendas propias.
-- Solución: Agregar políticas que permitan a admins gestionar
-- todas las prendas usando la función is_admin().
-- =====================================================

-- Paso 1: Asegurarse de que la función is_admin() existe
-- (Si ya la ejecutaste en FIX_RLS_RECURSION.sql, puedes saltar este paso)
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

-- Paso 2: Agregar políticas para que admins puedan VER todas las prendas
DROP POLICY IF EXISTS "Admins can view all garments" ON public.garments;
CREATE POLICY "Admins can view all garments" ON public.garments
  FOR SELECT 
  USING (public.is_admin());

-- Paso 3: Agregar políticas para que admins puedan INSERTAR prendas para cualquier usuario
DROP POLICY IF EXISTS "Admins can insert garments for any user" ON public.garments;
CREATE POLICY "Admins can insert garments for any user" ON public.garments
  FOR INSERT 
  WITH CHECK (public.is_admin());

-- Paso 4: Agregar políticas para que admins puedan ACTUALIZAR prendas de cualquier usuario
DROP POLICY IF EXISTS "Admins can update any garments" ON public.garments;
CREATE POLICY "Admins can update any garments" ON public.garments
  FOR UPDATE 
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Paso 5: Agregar políticas para que admins puedan ELIMINAR prendas de cualquier usuario
DROP POLICY IF EXISTS "Admins can delete any garments" ON public.garments;
CREATE POLICY "Admins can delete any garments" ON public.garments
  FOR DELETE 
  USING (public.is_admin());

-- Paso 6: Verificar que todas las políticas estén activas
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'garments'
ORDER BY cmd, policyname;

-- Paso 7: Probar la función is_admin()
SELECT public.is_admin() as es_admin;

-- =====================================================
-- ✅ RESULTADO ESPERADO
-- =====================================================
-- Después de ejecutar este script:
-- 1. Deberías ver 9 políticas para la tabla garments:
--    SELECT:
--      - "Users can view their own garments"
--      - "Admins can view all garments"
--    INSERT:
--      - "Users can insert their own garments"
--      - "Admins can insert garments for any user"
--    UPDATE:
--      - "Users can update their own garments"
--      - "Admins can update any garments"
--    DELETE:
--      - "Users can delete their own garments"
--      - "Admins can delete any garments"
-- 2. El error 403 debería desaparecer
-- 3. Los admins podrán crear prendas para cualquier usuario
-- =====================================================

