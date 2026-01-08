-- =====================================================
-- 🔍 SCRIPT DE VERIFICACIÓN CLOZEN
-- Ejecutar DESPUÉS del script principal para confirmar funcionamiento
-- =====================================================

-- Verificar que todas las tablas existen
SELECT
    schemaname,
    tablename,
    tableowner
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('users', 'boxes', 'garments', 'outfits', 'usage_history', 'nfc_tags')
ORDER BY tablename;

-- Verificar estructura completa de garments
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default,
    CASE WHEN column_name IN ('barcode_id', 'status', 'last_used', 'usage_count', 'updated_at') THEN '✅ NUEVA' ELSE '✅ EXISTENTE' END as status
FROM information_schema.columns
WHERE table_name = 'garments'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Verificar políticas RLS activas
SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('users', 'boxes', 'garments', 'outfits', 'usage_history', 'nfc_tags')
ORDER BY tablename;

-- Contar registros en cada tabla
SELECT
    'users' as tabla,
    COUNT(*) as registros
FROM public.users
UNION ALL
SELECT
    'boxes' as tabla,
    COUNT(*) as registros
FROM public.boxes
UNION ALL
SELECT
    'garments' as tabla,
    COUNT(*) as registros
FROM public.garments
UNION ALL
SELECT
    'outfits' as tabla,
    COUNT(*) as registros
FROM public.outfits
UNION ALL
SELECT
    'usage_history' as tabla,
    COUNT(*) as registros
FROM public.usage_history
UNION ALL
SELECT
    'nfc_tags' as tabla,
    COUNT(*) as registros
FROM public.nfc_tags;

-- Verificar constraints y foreign keys
SELECT
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY')
  AND tc.table_name IN ('users', 'boxes', 'garments', 'outfits', 'usage_history', 'nfc_tags')
ORDER BY tc.table_name, tc.constraint_type;

-- Verificar políticas RLS detalladas
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
ORDER BY tablename, policyname;

-- Test de consulta que usa las nuevas columnas
SELECT
    g.id,
    g.name,
    g.status,
    g.barcode_id,
    g.usage_count,
    g.last_used,
    b.name as box_name
FROM public.garments g
LEFT JOIN public.boxes b ON g.box_id = b.id
LIMIT 5;

-- =====================================================
-- ✅ RESULTADOS ESPERADOS:
-- =====================================================
-- 1. 6 tablas listadas (users, boxes, garments, outfits, usage_history, nfc_tags)
-- 2. Columna 'status' presente y no nullable
-- 3. Columna 'barcode_id' presente
-- 4. Todas las tablas con RLS activado (rowsecurity = t)
-- 5. Políticas RLS definidas correctamente
-- 6. Constraints de foreign key funcionando
-- 7. Consulta de test exitosa (sin errores de columna no encontrada)
