# ⚙️ Configuración de Clozen

## 🚨 Estado Actual: Modo Demo

**La aplicación funciona en modo demo sin Supabase configurado.** Puedes explorar la interfaz pero algunas funcionalidades estarán limitadas.

## 🔧 Para Funcionalidad Completa - Configura Supabase

### Paso 1: Crear Proyecto Supabase

1. Ve a [https://supabase.com](https://supabase.com)
2. Crea cuenta gratuita
3. Crea un nuevo proyecto
4. Espera a que se configure (2-3 minutos)

### Paso 2: Obtener Credenciales

1. En tu proyecto Supabase → **Settings** → **API**
2. Copia:
   - **Project URL**
   - **anon/public key**

### Paso 3: Configurar Variables de Entorno

Crea un archivo `.env.local` en la raíz del proyecto:

```env
# 🔑 Credenciales de Supabase (OBLIGATORIO)
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anonima_aqui

# 🤖 Google Vision API (opcional - para análisis de prendas)
GOOGLE_VISION_API_KEY=tu_api_key_google

# 🌤️ OpenWeatherMap API (opcional - para clima)
NEXT_PUBLIC_OPENWEATHER_API_KEY=tu_api_key_openweather

# 🧠 OpenAI GPT (opcional - para recomendaciones IA)
OPENAI_API_KEY=tu_api_key_openai
```

### Paso 4: Configurar Base de Datos

1. En Supabase → **SQL Editor**
2. Copia y pega todo el contenido del archivo `supabase-schema.sql`
3. Ejecuta las consultas

### Paso 5: Reiniciar la Aplicación

```bash
# Detén el servidor (Ctrl+C)
npm run dev
```

## 🎯 Funcionalidades por Nivel de Configuración

| Funcionalidad | Sin Config | Con Supabase | + APIs |
|---------------|------------|--------------|--------|
| Ver interfaz | ✅ | ✅ | ✅ |
| Navegación | ✅ | ✅ | ✅ |
| Tema oscuro | ✅ | ✅ | ✅ |
| Registro/Login | ❌ | ✅ | ✅ |
| Gestionar prendas | ❌ | ✅ | ✅ |
| Gestionar cajas | ❌ | ✅ | ✅ |
| NFC | ❌ | ✅ | ✅ |
| Análisis de fotos | ❌ | ❌ | ✅ |
| Recomendaciones IA | ❌ | ❌ | ✅ |
| Clima | ❌ | ❌ | ✅ |

## 🔍 Verificar Configuración

Para verificar que todo funciona:

1. **Inicia sesión** con una cuenta creada
2. **Ve a `/closet`** - deberías ver el closet vacío
3. **Ve a `/admin/boxes`** (como admin) - gestión de cajas
4. **Prueba subir una foto** - debería analizarse automáticamente

## 🆘 Solución de Problemas

### Error "Supabase no configurado"
- Verifica que `.env.local` existe y tiene las variables correctas
- Reinicia el servidor después de cambiar variables

### Error de autenticación
- Verifica que las credenciales de Supabase sean correctas
- Confirma que ejecutaste el schema SQL

### Error de APIs externas
- Verifica que las API keys sean válidas
- Revisa límites de uso (especialmente OpenAI - $10 límite)

¿Necesitas ayuda configurando alguna parte específica?</contents>
</xai:function_call">Crear archivo de configuración detallado
