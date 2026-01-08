-- Actualización de políticas RLS para cajas públicas
-- Ejecutar este script en Supabase SQL Editor

-- Eliminar política antigua restrictiva
DROP POLICY IF EXISTS "Admins can manage boxes" ON public.boxes;

-- Nueva política: Todos pueden VER cajas públicas
CREATE POLICY "Anyone can view boxes" ON public.boxes
  FOR SELECT USING (true);

-- Nueva política: Solo admins pueden CREAR, EDITAR y ELIMINAR cajas
CREATE POLICY "Admins can manage boxes" ON public.boxes
  FOR INSERT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update boxes" ON public.boxes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete boxes" ON public.boxes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
