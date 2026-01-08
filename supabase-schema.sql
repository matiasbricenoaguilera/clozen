-- Schema SQL para Clozen - Ejecutar en Supabase SQL Editor

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

-- Crear tabla de prendas
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
  barcode_id TEXT UNIQUE, -- Nuevo: soporte para códigos de barras
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

-- Políticas RLS (Row Level Security)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outfits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfc_tags ENABLE ROW LEVEL SECURITY;

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

-- Políticas para cajas
-- Todos pueden VER cajas públicas
DROP POLICY IF EXISTS "Anyone can view boxes" ON public.boxes;
CREATE POLICY "Anyone can view boxes" ON public.boxes
  FOR SELECT USING (true);

-- Solo admins pueden CREAR, EDITAR y ELIMINAR cajas
DROP POLICY IF EXISTS "Admins can manage boxes" ON public.boxes;
CREATE POLICY "Admins can manage boxes" ON public.boxes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Políticas para tags NFC
DROP POLICY IF EXISTS "Admins can manage NFC tags" ON public.nfc_tags;
CREATE POLICY "Admins can manage NFC tags" ON public.nfc_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

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

-- Insertar usuario admin inicial (cambiar email después)
-- INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, raw_user_meta_data)
-- VALUES ('admin@clozen.com', crypt('password123', gen_salt('bf')), NOW(), '{"full_name": "Admin Clozen"}');
--
-- UPDATE public.users SET role = 'admin' WHERE email = 'admin@clozen.com';
