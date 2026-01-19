# Clozen - Closet Digital Inteligente

Una aplicación web para organizar tu ropa usando NFC, IA y recomendaciones inteligentes basadas en clima.

## 🚀 Características

- **Organización NFC**: Escanea tags NTAG213 para localizar prendas en cajas
- **Análisis Visual**: Sube fotos y automáticamente detecta colores y tipos
- **Recomendaciones IA**: Sugerencias de outfits basadas en clima y estilo personal
- **Gestión de Roles**: Usuarios estándar y administradores
- **Interfaz Mobile-First**: Optimizada para dispositivos móviles

## 🛠️ Stack Tecnológico

- **Frontend**: Next.js 14, React, TypeScript, TailwindCSS
- **Backend**: Next.js API Routes
- **Base de Datos**: Supabase (PostgreSQL)
- **Autenticación**: Supabase Auth
- **Storage**: Supabase Storage
- **IA**: OpenAI GPT-4o-mini
- **Visión**: Google Vision API
- **Clima**: OpenWeatherMap API
- **NFC**: Web NFC API

## 📋 Prerrequisitos

- Node.js 18+
- Cuenta de Supabase
- API Key de Google Vision
- API Key de OpenWeatherMap
- API Key de OpenAI (GPT-4o-mini)

## 👑 Crear Cuenta Admin

Para acceder a funcionalidades administrativas (gestión de cajas, NFC, etc.):

### Opción 1: Registro Normal + Promoción
1. Regístrate normalmente en http://localhost:3000
2. Ve a Supabase → Table Editor → tabla `users`
3. Cambia el campo `role` de `'user'` a `'admin'`

### Opción 2: SQL Directo
```sql
-- Reemplaza con tu email
UPDATE public.users SET role = 'admin' WHERE email = 'tu@email.com';
```

### Funcionalidades Admin
- ✅ Gestionar cajas físicas
- ✅ Escanear/escribir tags NFC
- ✅ Panel administrativo completo

## 🚀 Configuración Inicial

### 1. Clona y instala dependencias

```bash
git clone <repository-url>
cd clozen-app
npm install
```

### 2. Configura Supabase

1. Crea un proyecto en [Supabase](https://supabase.com)
2. Ve a Settings > API y copia:
   - Project URL
   - Anon Public Key

### 3. Configura APIs Externas

#### Google Vision API
1. Ve a [Google Cloud Console](https://console.cloud.google.com)
2. Crea un proyecto o selecciona uno existente
3. Habilita la Vision API
4. Crea una API Key

#### OpenWeatherMap API
1. Regístrate en [OpenWeatherMap](https://openweathermap.org/api)
2. Obtén tu API Key gratuita

#### OpenAI API
1. Regístrate en [OpenAI](https://platform.openai.com)
2. Crea una API Key
3. **Nota**: Límite de $10/mes para controlar costos

### 4. Variables de Entorno

Crea un archivo `.env.local` en la raíz del proyecto:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google Vision API
GOOGLE_VISION_API_KEY=your_google_vision_api_key

# OpenWeatherMap API
NEXT_PUBLIC_OPENWEATHER_API_KEY=your_openweather_api_key

# OpenAI (GPT-4o-mini)
OPENAI_API_KEY=your_openai_api_key

# Environment
NODE_ENV=development
```

### 5. Configura la Base de Datos

Ejecuta las migraciones SQL en Supabase SQL Editor:

```sql
-- Crear tabla de usuarios (extiende auth.users)
CREATE TABLE public.users (
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
CREATE TABLE public.boxes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  nfc_tag_id TEXT UNIQUE,
  location TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla de prendas
CREATE TABLE public.garments (
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
  last_used TIMESTAMP WITH TIME ZONE,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla de outfits
CREATE TABLE public.outfits (
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
CREATE TABLE public.usage_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  garment_id UUID REFERENCES public.garments(id) ON DELETE CASCADE,
  outfit_id UUID REFERENCES public.outfits(id),
  usage_type TEXT CHECK (usage_type IN ('outfit', 'manual', 'recommendation')),
  weather_at_use JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla de tags NFC
CREATE TABLE public.nfc_tags (
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
CREATE POLICY "Users can view their own data" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own data" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Políticas para prendas
CREATE POLICY "Users can view their own garments" ON public.garments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own garments" ON public.garments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own garments" ON public.garments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own garments" ON public.garments
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas para outfits
CREATE POLICY "Users can view their own outfits" ON public.outfits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own outfits" ON public.outfits
  FOR ALL USING (auth.uid() = user_id);

-- Políticas para historial
CREATE POLICY "Users can view their own history" ON public.usage_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own history" ON public.usage_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Políticas para cajas (solo admin puede gestionar)
CREATE POLICY "Admins can manage boxes" ON public.boxes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Políticas para tags NFC
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
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 6. Ejecuta la aplicación

```bash
npm run dev
```

Visita `http://localhost:3000` para ver la aplicación.

## 📱 Uso de NFC

### Requisitos para NFC
- **Navegador**: Chrome para Android (Web NFC API)
- **Tags**: NTAG213, NTAG215, NTAG216 compatibles
- **Permisos**: Habilitar NFC en el dispositivo

### Funcionalidades NFC
1. **Escanear tag**: Identificar prendas y cajas mediante tags NFC
2. **Escribir UUID único**: Resolver tags duplicados escribiendo identificadores únicos
3. **Gestionar tags**: Liberar, reescribir y administrar tags desde el panel admin
4. **Organizar ropa lavada**: Escaneo continuo de múltiples prendas

### ❓ ¿Tags NFC duplicados?
Si encuentras tags con el mismo código serial, puedes escribir un UUID único en cada uno para diferenciarlos.

**📖 Lee la [Guía Completa de NFC y resolución de duplicados](FAQ_NFC.md)**

## 🤖 APIs y Costos

| API | Costo | Límite |
|-----|-------|--------|
| OpenAI GPT-4o-mini | ~$0.0015/1K tokens | $10/mes |
| Google Vision | $1.50/1K imágenes | Gratuito hasta 1K |
| OpenWeatherMap | Gratuito | 1K llamadas/día |

## 📁 Estructura del Proyecto

```
clozen-app/
├── app/                    # Next.js App Router
│   ├── auth/              # Páginas de autenticación
│   ├── admin/             # Panel de administración
│   ├── closet/            # Closet del usuario
│   └── api/               # API Routes
├── components/            # Componentes React
│   ├── ui/               # Componentes UI reutilizables
│   └── layout/           # Layout components
├── lib/                  # Utilidades y configuración
├── types/                # TypeScript types
└── hooks/                # Custom React hooks
```

## 🔄 Roadmap de Desarrollo

### Etapa 1 ✅ - Foundation
- [x] Configuración proyecto Next.js
- [x] Base de datos Supabase
- [x] Autenticación básica
- [x] UI skeleton

### Etapa 2 🔄 - Core CRUD
- [ ] Gestión de cajas (admin)
- [ ] Registro de prendas básico
- [ ] Dashboard usuario

### Etapa 3 - Análisis Inteligente
- [ ] Google Vision API
- [ ] Clasificación automática
- [ ] Subida de imágenes

### Etapa 4 - Sistema NFC
- [ ] Web NFC API
- [ ] Escaneo/escritura NTAG213
- [ ] Integración con cajas

### Etapa 5 - Recomendaciones IA
- [ ] OpenAI GPT-4o-mini
- [ ] OpenWeatherMap
- [ ] Sistema de feedback

## 📝 Scripts Disponibles

```bash
npm run dev          # Inicia servidor de desarrollo
npm run build        # Construye para producción
npm run start        # Inicia servidor de producción
npm run lint         # Ejecuta ESLint
```

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.

## 📞 Soporte

Para soporte técnico o preguntas, por favor contacta al equipo de desarrollo.