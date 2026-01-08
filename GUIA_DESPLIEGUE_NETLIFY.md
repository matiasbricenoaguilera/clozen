# 🚀 Guía Paso a Paso: Desplegar Clozen en Netlify

Esta guía te llevará paso a paso para desplegar tu aplicación Clozen en Netlify.

## ✅ Paso 1: Verificar Preparación Local

### 1.1 Asegúrate de tener tu código en Git

```bash
# Verifica que tienes cambios commit
git status

# Si hay cambios sin commit, hazlo:
git add .
git commit -m "Preparar para despliegue en Netlify"
```

### 1.2 Verifica que el proyecto está listo

```bash
# Asegúrate de estar en la carpeta del proyecto
cd clozen-app

# Verifica que las dependencias están instaladas
npm install

# Prueba el build localmente (opcional)
npm run build:local
```

---

## 📤 Paso 2: Subir Código a GitHub (si aún no lo tienes)

### 2.1 Si NO tienes repositorio en GitHub:

1. **Crea un repositorio nuevo en GitHub**:
   - Ve a [https://github.com/new](https://github.com/new)
   - Dale un nombre a tu repositorio (ej: `clozen-app`)
   - Elige si será público o privado
   - **NO** inicialices con README, .gitignore o licencia (ya los tienes)

2. **Conecta tu repositorio local con GitHub**:
```bash
# Reemplaza TU_USUARIO y TU_REPO con tus datos
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git branch -M main
git push -u origin main
```

### 2.2 Si YA tienes repositorio en GitHub:

```bash
# Solo asegúrate de que tus cambios estén subidos
git push origin main
```

---

## 🌐 Paso 3: Crear Cuenta y Sitio en Netlify

### 3.1 Crear cuenta en Netlify

1. Ve a [https://app.netlify.com](https://app.netlify.com)
2. Haz clic en **"Sign up"** (Registrarse)
3. Elige **"Sign up with GitHub"** (Es la opción más fácil)
4. Autoriza a Netlify para acceder a tus repositorios

### 3.2 Crear nuevo sitio

1. Una vez dentro de Netlify, haz clic en **"Add new site"**
2. Selecciona **"Import an existing project"**
3. Elige **"Deploy with GitHub"** (o GitLab/Bitbucket si usas esos)
4. Si es la primera vez, autoriza la conexión con GitHub
5. Selecciona tu repositorio `clozen-app` (o el nombre que le hayas dado)

---

## ⚙️ Paso 4: Configurar Build Settings en Netlify

Netlify debería detectar automáticamente que es un proyecto Next.js, pero verifica:

1. En la pantalla de configuración del despliegue, verifica:
   - **Build command**: `npm run build` ✅
   - **Publish directory**: `.next` ✅

2. Si no está configurado automáticamente:
   - **Base directory**: (déjalo vacío o pon `/clozen-app` si tu repo tiene subdirectorios)
   - **Build command**: `cd clozen-app && npm install && npm run build`
   - **Publish directory**: `clozen-app/.next`

3. Haz clic en **"Show advanced"** y configura:
   - **Node version**: `18` o superior

---

## 🔑 Paso 5: Configurar Variables de Entorno (MUY IMPORTANTE)

**⚠️ CRÍTICO**: Este es el paso más importante. Sin estas variables, tu app no funcionará.

### 5.1 Obtener tus credenciales

Antes de continuar, asegúrate de tener:

1. **Credenciales de Supabase**:
   - Ve a tu proyecto en [Supabase](https://supabase.com)
   - Settings → API
   - Copia: **Project URL** y **anon/public key**

2. **API Keys** (si las usas):
   - Google Vision API Key
   - OpenWeatherMap API Key  
   - OpenAI API Key

### 5.2 Agregar variables en Netlify

1. En la pantalla de configuración del despliegue, haz clic en **"Show advanced"**
2. Busca la sección **"Environment variables"** o **"New variable"**
3. Haz clic en **"Add a variable"** por cada variable:

#### Variables OBLIGATORIAS (mínimo para que funcione):

```
Variable: NEXT_PUBLIC_SUPABASE_URL
Value: https://tu-proyecto.supabase.co
Scope: All scopes (Production, Deploy previews, Branch deploys)
```

```
Variable: NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: tu_clave_anonima_de_supabase
Scope: All scopes
```

#### Variables OPCIONALES (para funcionalidades adicionales):

```
Variable: GOOGLE_VISION_API_KEY
Value: tu_api_key_google
Scope: All scopes
```

```
Variable: NEXT_PUBLIC_OPENWEATHER_API_KEY
Value: tu_api_key_openweather
Scope: All scopes
```

```
Variable: OPENAI_API_KEY
Value: tu_api_key_openai
Scope: All scopes
```

**💡 Tip**: 
- Las variables con `NEXT_PUBLIC_` están disponibles en el cliente (navegador)
- Las variables SIN `NEXT_PUBLIC_` solo están en el servidor
- Puedes usar diferentes valores para Production, Preview y Branch deploys

---

## 🚀 Paso 6: Realizar el Primer Despliegue

1. Una vez configuradas todas las variables de entorno, haz clic en **"Deploy site"**
2. Netlify comenzará a construir tu aplicación
3. Verás el progreso en tiempo real en la pantalla

**⏱️ Tiempo estimado**: 2-5 minutos

---

## ✅ Paso 7: Verificar el Despliegue

### 7.1 Revisar logs del build

1. En la pantalla de despliegue, verás los logs
2. Busca errores en rojo
3. Si todo está bien, verás: **"Deploy is live!"** o **"Published"**

### 7.2 Visitar tu sitio

1. Netlify te dará una URL automática como: `tu-app-123abc.netlify.app`
2. Haz clic en la URL o en el botón **"Open production deploy"**
3. Prueba tu aplicación:
   - Verifica que carga correctamente
   - Prueba el registro/login
   - Verifica que las funcionalidades principales funcionan

### 7.3 Verificar variables de entorno

Si algo no funciona:

1. Ve a **Site settings** → **Environment variables**
2. Verifica que todas las variables están ahí con los valores correctos
3. **IMPORTANTE**: Si agregaste variables después del primer despliegue, haz un **"Trigger deploy"** → **"Clear cache and deploy site"**

---

## 🎨 Paso 8: Personalizar tu Dominio (Opcional)

### 8.1 Cambiar nombre del sitio

1. Ve a **Site settings** → **Change site name**
2. Elige un nombre único (ej: `mi-clozen` → `mi-clozen.netlify.app`)

### 8.2 Usar dominio personalizado

1. Ve a **Domain settings** → **Add custom domain**
2. Sigue las instrucciones para configurar tu dominio

---

## 🔄 Paso 9: Configurar Auto-Deploy

Ya está configurado automáticamente, pero verifica:

1. Ve a **Site settings** → **Build & deploy** → **Continuous Deployment**
2. Asegúrate de que está conectado a tu repositorio
3. Cada vez que hagas `git push`, Netlify desplegará automáticamente

---

## 📝 Checklist Final

Antes de considerar que está completo, verifica:

- [ ] El build se completó sin errores
- [ ] El sitio carga correctamente
- [ ] Las variables de entorno están configuradas
- [ ] Puedes registrarte e iniciar sesión
- [ ] Las funcionalidades principales funcionan
- [ ] El auto-deploy está activado

---

## 🆘 Solución de Problemas Comunes

### ❌ Error: "Build failed"

**Posibles causas**:
- Variables de entorno faltantes o incorrectas
- Error en el código
- Versión de Node.js incorrecta

**Solución**:
1. Revisa los logs del build (haz clic en el deploy fallido)
2. Busca el error específico
3. Verifica que todas las variables están configuradas

### ❌ Error: "Supabase no configurado"

**Causa**: Variables de Supabase no configuradas o incorrectas

**Solución**:
1. Ve a **Site settings** → **Environment variables**
2. Verifica que `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` existen
3. Verifica que los valores son correctos (sin espacios al inicio/final)
4. Haz un nuevo deploy: **Deploys** → **Trigger deploy** → **Clear cache and deploy site**

### ❌ El sitio carga pero las funciones no funcionan

**Causa**: Variables de entorno no disponibles en el cliente

**Solución**:
- Asegúrate de que las variables que necesitas en el cliente tienen el prefijo `NEXT_PUBLIC_`
- Haz un nuevo deploy después de cambiar variables

### ❌ Las APIs externas no funcionan

**Causa**: API keys no configuradas o incorrectas

**Solución**:
1. Verifica que las API keys están en las variables de entorno
2. Verifica que son válidas y no han expirado
3. Revisa los límites de uso de cada API

---

## 📚 Recursos Adicionales

- [Documentación oficial de Netlify](https://docs.netlify.com/)
- [Next.js en Netlify](https://docs.netlify.com/integrations/frameworks/nextjs/)
- [Variables de entorno en Netlify](https://docs.netlify.com/environment-variables/overview/)

---

## 🎉 ¡Listo!

Una vez completados todos los pasos, tu aplicación Clozen estará desplegada y funcionando en Netlify. 

**¿Necesitas ayuda?** Revisa la sección de Solución de Problemas o consulta los logs del build en Netlify.

