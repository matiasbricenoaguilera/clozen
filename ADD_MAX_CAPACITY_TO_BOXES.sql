-- Agregar campo max_capacity a la tabla boxes
-- Ejecutar en Supabase SQL Editor

ALTER TABLE public.boxes 
ADD COLUMN IF NOT EXISTS max_capacity INTEGER DEFAULT 15 NOT NULL;

-- Actualizar cajas existentes que no tengan max_capacity
UPDATE public.boxes 
SET max_capacity = 15 
WHERE max_capacity IS NULL;
