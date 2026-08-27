-- =====================================================
-- 🧹 SOLTAR LA CAJA DE LAS PRENDAS QUE ESTÁN EN USO
-- =====================================================
-- Regla del sistema: una prenda retirada NO ocupa sitio en su caja.
-- Al retirar se pone `box_id = NULL`, y la caja se reasigna al ingresar.
--
-- El retiro en lote de /closet no limpiaba `box_id` (sí lo hacía el retiro
-- individual), así que pueden quedar prendas `in_use` apuntando a una caja
-- donde nadie las ve pero que, según el registro, siguen dentro.
--
-- Este script arregla esas filas heredadas. Es idempotente: al volver a
-- ejecutarlo no encontrará nada que corregir.
-- =====================================================

-- Paso 1: ver qué se va a corregir (ejecuta esto primero)
SELECT
    g.id,
    g.name AS prenda,
    b.name AS caja_fantasma,
    g.last_used
FROM public.garments g
LEFT JOIN public.boxes b ON b.id = g.box_id
WHERE g.status = 'in_use'
  AND g.box_id IS NOT NULL
ORDER BY b.name, g.name;

-- Paso 2: soltar la caja de esas prendas
UPDATE public.garments
SET box_id = NULL,
    updated_at = NOW()
WHERE status = 'in_use'
  AND box_id IS NOT NULL;

-- Paso 3: comprobar que no queda ninguna (debe devolver 0)
SELECT COUNT(*) AS prendas_en_uso_con_caja
FROM public.garments
WHERE status = 'in_use'
  AND box_id IS NOT NULL;

-- =====================================================
-- ✅ RESULTADO ESPERADO
-- =====================================================
-- El paso 3 devuelve 0 y los contadores de ocupación de cada caja pasan a
-- coincidir con lo que hay dentro de verdad.
-- =====================================================
