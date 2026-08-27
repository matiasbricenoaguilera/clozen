-- =====================================================
-- 🔒 LÍMITE DE CAPACIDAD DE LAS CAJAS, EN LA BASE DE DATOS
-- =====================================================
-- Hasta ahora `boxes.max_capacity` solo se respetaba porque el navegador lo
-- comprobaba antes de escribir. Eso deja dos agujeros:
--   1. Dos móviles ingresando a la vez pasan los dos la validación.
--   2. Cualquier escritura que no venga de la app (SQL a mano, un script)
--      puede meter 40 prendas en una caja de 15.
--
-- Este script añade la regla como trigger, que es el único sitio donde se
-- puede hacer cumplir de verdad. La app sigue validando para dar buenos
-- mensajes; esto es la última línea, no la primera.
--
-- Idempotente: se puede volver a ejecutar sin efectos secundarios.
-- =====================================================

-- =====================================================
-- Paso 1: mantener `updated_at` desde la base
-- =====================================================
-- Cuatro de las escrituras de la app se olvidaban de ponerlo. Con esto deja de
-- depender del cliente.

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS garments_touch_updated_at ON public.garments;
CREATE TRIGGER garments_touch_updated_at
  BEFORE UPDATE ON public.garments
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- =====================================================
-- Paso 2: impedir que una caja pase de su capacidad
-- =====================================================
-- Solo cuentan las prendas 'available': una prenda retirada suelta su caja
-- (box_id = NULL), así que no ocupa sitio en ninguna parte.

CREATE OR REPLACE FUNCTION public.enforce_box_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ocupacion INTEGER;
  capacidad INTEGER;
  nombre_caja TEXT;
BEGIN
  -- Solo hay que comprobar cuando la prenda acaba dentro de una caja y disponible
  IF NEW.box_id IS NULL OR NEW.status <> 'available' THEN
    RETURN NEW;
  END IF;

  -- En un UPDATE que no cambia ni la caja ni el estado no hay nada que validar
  IF TG_OP = 'UPDATE'
     AND NEW.box_id IS NOT DISTINCT FROM OLD.box_id
     AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Serializa las escrituras sobre la misma caja durante esta transacción:
  -- sin esto, dos ingresos simultáneos pueden contar ambos 14 y guardar los dos
  PERFORM pg_advisory_xact_lock(hashtext(NEW.box_id::text));

  SELECT b.max_capacity, b.name
    INTO capacidad, nombre_caja
    FROM public.boxes b
   WHERE b.id = NEW.box_id;

  IF capacidad IS NULL THEN
    capacidad := 15; -- mismo default que la columna
  END IF;

  SELECT COUNT(*)
    INTO ocupacion
    FROM public.garments g
   WHERE g.box_id = NEW.box_id
     AND g.status = 'available'
     AND g.id <> NEW.id;

  IF ocupacion >= capacidad THEN
    RAISE EXCEPTION
      'La caja "%" está llena: % de % prendas.', nombre_caja, ocupacion, capacidad
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS garments_enforce_box_capacity ON public.garments;
CREATE TRIGGER garments_enforce_box_capacity
  BEFORE INSERT OR UPDATE ON public.garments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_box_capacity();

-- =====================================================
-- Paso 3: comprobar que no hay cajas ya pasadas de límite
-- =====================================================
-- El trigger solo mira las escrituras nuevas. Si alguna caja ya venía por
-- encima de su capacidad, esta consulta la saca a la luz (debería salir vacía).

SELECT
    b.name AS caja,
    COUNT(g.id) AS prendas_dentro,
    b.max_capacity AS capacidad
FROM public.boxes b
JOIN public.garments g ON g.box_id = b.id AND g.status = 'available'
GROUP BY b.id, b.name, b.max_capacity
HAVING COUNT(g.id) > b.max_capacity
ORDER BY b.name;

-- =====================================================
-- Paso 4: verificar que los triggers quedaron activos
-- =====================================================
SELECT tgname AS trigger, tgenabled AS activo
FROM pg_trigger
WHERE tgrelid = 'public.garments'::regclass
  AND NOT tgisinternal
ORDER BY tgname;

-- =====================================================
-- ✅ RESULTADO ESPERADO
-- =====================================================
-- Paso 3: 0 filas (ninguna caja pasada de su límite).
-- Paso 4: garments_enforce_box_capacity y garments_touch_updated_at, activo = 'O'.
--
-- A partir de aquí, meter una prenda de más en una caja llena devuelve:
--   La caja "Caja 1" está llena: 30 de 30 prendas.
-- La app muestra ese mensaje tal cual.
-- =====================================================
