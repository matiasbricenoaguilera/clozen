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

## 🌐 Despliegue en Netlify

### Paso 1: Preparar el Repositorio

1. Asegúrate de tener tu código en un repositorio Git (GitHub, GitLab, Bitbucket)
2. El archivo `netlify.toml` ya está configurado para Next.js

### Paso 2: Crear Sitio en Netlify

1. Ve a [https://app.netlify.com](https://app.netlify.com)
2. Haz clic en **"Add new site"** → **"Import an existing project"**
3. Conecta tu repositorio Git
4. Netlify detectará automáticamente la configuración de Next.js

### Paso 3: Configurar Variables de Entorno en Netlify

**⚠️ IMPORTANTE**: En Netlify NO usas archivos `.env.local`. Las variables se configuran en el dashboard:

1. En tu sitio de Netlify → **Site settings** → **Environment variables**
2. Haz clic en **"Add a variable"**
3. Agrega cada variable una por una:

```
🔑 OBLIGATORIAS:
NEXT_PUBLIC_SUPABASE_URL = https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = tu_clave_anonima_aqui

🤖 OPCIONALES:
GOOGLE_VISION_API_KEY = tu_api_key_google
NEXT_PUBLIC_OPENWEATHER_API_KEY = tu_api_key_openweather
OPENAI_API_KEY = tu_api_key_openai
```

**💡 Tip**: Puedes definir variables por entorno (Production, Deploy previews, Branch deploys)

### Paso 4: Instalar Plugin de Next.js

El archivo `netlify.toml` ya incluye el plugin, pero Netlify lo instalará automáticamente en el primer despliegue.

Si prefieres instalarlo manualmente:
```bash
npm install --save-dev @netlify/plugin-nextjs
```

### Paso 5: Configurar Build Settings

Netlify detectará automáticamente:
- **Build command**: `npm run build` (ya configurado en `package.json`)
- **Publish directory**: `.next` (manejado por el plugin de Next.js)

### Paso 6: Primer Despliegue

1. Haz commit y push de tus cambios a la rama principal
2. Netlify desplegará automáticamente
3. Verás la URL de tu sitio (ej: `tu-app.netlify.app`)

### Paso 7: Verificar Configuración

Después del despliegue:
1. Visita tu sitio en Netlify
2. Verifica que las variables de entorno estén cargadas (revisa los logs del build)
3. Prueba la funcionalidad completa

## 🔄 Actualizar Variables en Netlify

Si necesitas cambiar variables de entorno:
1. Ve a **Site settings** → **Environment variables**
2. Edita o elimina las variables necesarias
3. Haz un nuevo despliegue (Netlify lo hará automáticamente si tienes auto-deploy habilitado)

**Nota**: Los cambios en variables de entorno requieren un nuevo build para tomar efecto.

## 🆘 Solución de Problemas

### Error "Supabase no configurado"
- **Desarrollo local**: Verifica que `.env.local` existe y tiene las variables correctas
- **Netlify**: Verifica que las variables están configuradas en el dashboard de Netlify
- Reinicia el servidor después de cambiar variables (en desarrollo local)

### Error de autenticación
- Verifica que las credenciales de Supabase sean correctas
- Confirma que ejecutaste el schema SQL en Supabase

### Error de APIs externas
- Verifica que las API keys sean válidas
- Revisa límites de uso (especialmente OpenAI - $10 límite)

### Error en Netlify Build
- Verifica que todas las variables de entorno están configuradas
- Revisa los logs del build en Netlify para ver errores específicos
- Asegúrate de que el plugin `@netlify/plugin-nextjs` está instalado

### Las variables no se cargan en Netlify
- Verifica que los nombres de las variables son exactamente iguales (case-sensitive)
- Asegúrate de que las variables con `NEXT_PUBLIC_` están marcadas para exponerse al cliente
- Haz un nuevo deploy después de agregar/modificar variables

¿Necesitas ayuda configurando alguna parte específica?



