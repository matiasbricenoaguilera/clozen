-- =====================================================
-- 🚀 ÍNDICES PARA OPTIMIZAR BÚSQUEDAS DE PRENDAS
-- Ejecutar en Supabase SQL Editor para mejorar rendimiento
-- =====================================================

-- Índice para búsquedas por código NFC
-- Mejora significativamente las consultas .in('nfc_tag_id', [...])
CREATE INDEX IF NOT EXISTS idx_garments_nfc_tag_id 
ON public.garments(nfc_tag_id) 
WHERE nfc_tag_id IS NOT NULL;

-- Índice para búsquedas por código de barras
-- Mejora significativamente las consultas .in('barcode_id', [...])
CREATE INDEX IF NOT EXISTS idx_garments_barcode_id 
ON public.garments(barcode_id) 
WHERE barcode_id IS NOT NULL;

-- Índice compuesto para búsquedas NFC con filtro de status
-- Optimiza consultas que filtran por status y nfc_tag_id
CREATE INDEX IF NOT EXISTS idx_garments_nfc_status 
ON public.garments(nfc_tag_id, status) 
WHERE nfc_tag_id IS NOT NULL;

-- Índice compuesto para búsquedas barcode con filtro de status
-- Optimiza consultas que filtran por status y barcode_id
CREATE INDEX IF NOT EXISTS idx_garments_barcode_status 
ON public.garments(barcode_id, status) 
WHERE barcode_id IS NOT NULL;

-- Índice para búsquedas por box_id y status (usado en conteos)
-- Optimiza las consultas de conteo de prendas por caja
CREATE INDEX IF NOT EXISTS idx_garments_box_status 
ON public.garments(box_id, status) 
WHERE box_id IS NOT NULL;

-- Índice para búsquedas por user_id y status
-- Optimiza las consultas de prendas del usuario
CREATE INDEX IF NOT EXISTS idx_garments_user_status 
ON public.garments(user_id, status);

-- Verificar que los índices se crearon correctamente
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'garments'
  AND indexname LIKE 'idx_garments%'
ORDER BY indexname;

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE '✅ Índices creados exitosamente. Las búsquedas ahora serán mucho más rápidas.';
END $$;

