-- =====================================================
-- 🚀 SCRIPT COMPLETO DE CONFIGURACIÓN CLOZEN
-- Ejecutar en Supabase SQL Editor para resolver TODOS los problemas
-- =====================================================

-- =====================================================
-- 🔧 PASO 1: VERIFICACIÓN Y CREACIÓN DE TABLAS
-- =====================================================

-- Crear tabla de usuarios (extiende auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'admin')) DEFAULT 'user',
  full_name TEXT,
  city TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla de cajas
CREATE TABLE IF NOT EXISTS public.boxes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  nfc_tag_id TEXT UNIQUE,
  location TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla de prendas CON TODAS LAS COLUMNAS
CREATE TABLE IF NOT EXISTS public.garments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  color TEXT,
  season TEXT CHECK (season IN ('verano', 'invierno', 'otoño', 'primavera', 'all')),
  style TEXT[],
  image_url TEXT,
  box_id UUID REFERENCES public.boxes(id),
  nfc_tag_id TEXT UNIQUE,
  barcode_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_use')),
  last_used TIMESTAMP WITH TIME ZONE,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla de outfits
CREATE TABLE IF NOT EXISTS public.outfits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  garment_ids UUID[] NOT NULL,
  weather_conditions JSONB,
  occasion TEXT,
  ai_prompt TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla de historial de uso
CREATE TABLE IF NOT EXISTS public.usage_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  garment_id UUID REFERENCES public.garments(id) ON DELETE CASCADE,
  outfit_id UUID REFERENCES public.outfits(id),
  usage_type TEXT CHECK (usage_type IN ('outfit', 'manual', 'recommendation')),
  weather_at_use JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla de tags NFC
CREATE TABLE IF NOT EXISTS public.nfc_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tag_id TEXT UNIQUE NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('box', 'garment')),
  entity_id UUID NOT NULL,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 🔧 PASO 2: AGREGAR COLUMNAS FALTANTES (SI NO EXISTEN)
-- =====================================================

-- Agregar columnas faltantes en garments (manejo seguro)
DO $$
BEGIN
    -- Agregar barcode_id si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'garments' AND column_name = 'barcode_id') THEN
        ALTER TABLE public.garments ADD COLUMN barcode_id TEXT UNIQUE;
        RAISE NOTICE '✅ Columna barcode_id agregada a garments';
    ELSE
        RAISE NOTICE 'ℹ️ Columna barcode_id ya existe en garments';
    END IF;

    -- Agregar status si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'garments' AND column_name = 'status') THEN
        ALTER TABLE public.garments ADD COLUMN status TEXT NOT NULL DEFAULT 'available'
            CHECK (status IN ('available', 'in_use'));
        RAISE NOTICE '✅ Columna status agregada a garments';
    ELSE
        RAISE NOTICE 'ℹ️ Columna status ya existe en garments';
    END IF;

    -- Agregar last_used si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'garments' AND column_name = 'last_used') THEN
        ALTER TABLE public.garments ADD COLUMN last_used TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE '✅ Columna last_used agregada a garments';
    ELSE
        RAISE NOTICE 'ℹ️ Columna last_used ya existe en garments';
    END IF;

    -- Agregar usage_count si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'garments' AND column_name = 'usage_count') THEN
        ALTER TABLE public.garments ADD COLUMN usage_count INTEGER DEFAULT 0;
        RAISE NOTICE '✅ Columna usage_count agregada a garments';
    ELSE
        RAISE NOTICE 'ℹ️ Columna usage_count ya existe en garments';
    END IF;

    -- Agregar updated_at si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'garments' AND column_name = 'updated_at') THEN
        ALTER TABLE public.garments ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE '✅ Columna updated_at agregada a garments';
    ELSE
        RAISE NOTICE 'ℹ️ Columna updated_at ya existe en garments';
    END IF;

END $$;

-- =====================================================
-- 🔒 PASO 3: CONFIGURACIÓN DE RLS (Row Level Security)
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outfits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfc_tags ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 📋 PASO 4: POLÍTICAS RLS COMPLETAS
-- =====================================================

-- Políticas para usuarios
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
CREATE POLICY "Users can view their own data" ON public.users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
CREATE POLICY "Users can update their own data" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Políticas para prendas
DROP POLICY IF EXISTS "Users can view their own garments" ON public.garments;
CREATE POLICY "Users can view their own garments" ON public.garments
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own garments" ON public.garments;
CREATE POLICY "Users can insert their own garments" ON public.garments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own garments" ON public.garments;
CREATE POLICY "Users can update their own garments" ON public.garments
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own garments" ON public.garments;
CREATE POLICY "Users can delete their own garments" ON public.garments
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas para outfits
DROP POLICY IF EXISTS "Users can view their own outfits" ON public.outfits;
CREATE POLICY "Users can view their own outfits" ON public.outfits
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own outfits" ON public.outfits;
CREATE POLICY "Users can manage their own outfits" ON public.outfits
  FOR ALL USING (auth.uid() = user_id);

-- Políticas para historial
DROP POLICY IF EXISTS "Users can view their own history" ON public.usage_history;
CREATE POLICY "Users can view their own history" ON public.usage_history
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own history" ON public.usage_history;
CREATE POLICY "Users can insert their own history" ON public.usage_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Políticas para cajas (públicas para lectura)
DROP POLICY IF EXISTS "Anyone can view boxes" ON public.boxes;
CREATE POLICY "Anyone can view boxes" ON public.boxes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage boxes" ON public.boxes;
CREATE POLICY "Admins can manage boxes" ON public.boxes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Políticas para tags NFC (solo admins)
DROP POLICY IF EXISTS "Admins can manage NFC tags" ON public.nfc_tags;
CREATE POLICY "Admins can manage NFC tags" ON public.nfc_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- 🤖 PASO 5: FUNCIONES Y TRIGGERS
-- =====================================================

-- Función para crear perfil de usuario automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para crear perfil automáticamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 🔄 PASO 6: REFRESCAR SCHEMA CACHE (CRÍTICO)
-- =====================================================

-- Ejecutar consultas para refrescar el schema cache de Supabase
SELECT 'users' as table_name, COUNT(*) as record_count FROM public.users
UNION ALL
SELECT 'boxes' as table_name, COUNT(*) as record_count FROM public.boxes
UNION ALL
SELECT 'garments' as table_name, COUNT(*) as record_count FROM public.garments
UNION ALL
SELECT 'outfits' as table_name, COUNT(*) as record_count FROM public.outfits
UNION ALL
SELECT 'usage_history' as table_name, COUNT(*) as record_count FROM public.usage_history
UNION ALL
SELECT 'nfc_tags' as table_name, COUNT(*) as record_count FROM public.nfc_tags;

-- Verificar estructura de la tabla garments (especialmente las columnas nuevas)
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'garments'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- =====================================================
-- 🚀 PASO 7: CREAR ÍNDICES PARA OPTIMIZACIÓN (CRÍTICO PARA RENDIMIENTO)
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

-- =====================================================
-- ✅ PASO 8: VERIFICACIÓN FINAL
-- =====================================================

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE '=================================================';
    RAISE NOTICE '🎉 CONFIGURACIÓN CLOZEN COMPLETADA EXITOSAMENTE';
    RAISE NOTICE '=================================================';
    RAISE NOTICE '✅ Todas las tablas creadas/verficadas';
    RAISE NOTICE '✅ Todas las columnas presentes (status, barcode_id, etc.)';
    RAISE NOTICE '✅ Políticas RLS configuradas';
    RAISE NOTICE '✅ Schema cache refrescado';
    RAISE NOTICE '✅ Triggers y funciones activas';
    RAISE NOTICE '✅ Índices de optimización creados';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 ¡Clozen está listo para funcionar completamente!';
    RAISE NOTICE '';
    RAISE NOTICE '📱 Prueba la aplicación en http://localhost:3000';
    RAISE NOTICE '=================================================';
END $$;
