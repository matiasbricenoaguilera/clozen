-- =====================================================
-- 🔧 ACTUALIZAR ROL DE USUARIO A ADMIN
-- =====================================================

-- Actualizar el rol del usuario específico a 'admin'
UPDATE public.users 
SET role = 'admin'
WHERE email = 'matiasbricenoaguilera@gmail.com';

-- Verificar que el cambio se aplicó correctamente
SELECT 
  id,
  email,
  role,
  full_name,
  created_at
FROM public.users
WHERE email = 'matiasbricenoaguilera@gmail.com';

-- =====================================================
-- ✅ RESULTADO ESPERADO
-- =====================================================
-- Deberías ver una fila con:
-- - email: matiasbricenoaguilera@gmail.com
-- - role: admin
-- =====================================================

