# 🔧 Solución: Error ERR_NAME_NOT_RESOLVED

## Problema
Al intentar iniciar sesión, aparece el error:
```
Failed to load resource: net::ERR_NAME_NOT_RESOLVED
```

## Causas Posibles

### 1. Variables de Entorno No Configuradas
Las variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` no están configuradas correctamente.

### 2. URL de Supabase Mal Formada
La URL debe empezar con `https://` y tener el formato correcto.

### 3. Problema de Conexión/DNS
Tu conexión a internet o el DNS no puede resolver el dominio de Supabase.

## Soluciones

### Paso 1: Verificar Variables de Entorno

1. Abre la consola del navegador (F12)
2. Busca el log: `🔍 Supabase Config Check:`
3. Verifica que muestre:
   - `url: ✅ Configurada`
   - `key: ✅ Configurada`
   - `fullUrl: https://tu-proyecto.supabase.co` (debe empezar con https://)

### Paso 2: Verificar Archivo .env.local

Asegúrate de tener un archivo `.env.local` en la raíz del proyecto (`clozen-app/.env.local`) con:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anonima_aqui
```

**⚠️ IMPORTANTE:**
- La URL debe empezar con `https://`
- No debe tener espacios al inicio o final
- No debe tener comillas

### Paso 3: Reiniciar el Servidor de Desarrollo

Después de crear o modificar `.env.local`:

1. Detén el servidor (Ctrl+C en la terminal)
2. Reinicia con:
   ```bash
   npm run dev
   ```

### Paso 4: Verificar Credenciales en Supabase

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Settings → API
3. Verifica que:
   - **Project URL** sea correcta (debe empezar con `https://`)
   - **anon/public key** sea correcta

### Paso 5: Verificar Conexión a Internet

Si las variables están correctas pero sigue el error:

1. Verifica tu conexión a internet
2. Intenta acceder directamente a tu URL de Supabase en el navegador:
   ```
   https://tu-proyecto.supabase.co
   ```
   Deberías ver una página de Supabase

### Paso 6: Verificar DNS

Si no puedes acceder a la URL directamente:

1. Prueba con otro navegador
2. Prueba con otra conexión (móvil, otro WiFi)
3. Verifica que no haya un firewall bloqueando Supabase

## Logs de Diagnóstico

Después de reiniciar el servidor, deberías ver en la consola:

```
🔍 Supabase Config Check: {
  url: "✅ Configurada",
  key: "✅ Configurada",
  fullUrl: "https://tu-proyecto.supabase.co",
  urlStartsWithHttp: true,
  isConfigured: true
}
```

Si ves `❌ No configurada` en algún campo, las variables de entorno no están cargadas correctamente.

## Solución Rápida

Si nada funciona, crea/edita `.env.local` manualmente:

1. En la raíz del proyecto (`clozen-app/`), crea el archivo `.env.local`
2. Agrega las variables (reemplaza con tus valores reales):
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://veonmbligxuuwyysrjli.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_aqui
   ```
3. Guarda el archivo
4. **Reinicia el servidor completamente** (Ctrl+C y luego `npm run dev`)

## Verificación Final

Después de aplicar las soluciones:

1. Abre la aplicación en el navegador
2. Abre la consola (F12)
3. Intenta iniciar sesión
4. Deberías ver logs como:
   ```
   🔍 [useAuth] signIn: Intentando iniciar sesión para: tu@email.com
   🔍 [useAuth] signIn: Supabase URL: https://tu-proyecto.supabase.co
   ✅ [useAuth] signIn: Login exitoso
   ```

Si aún ves el error después de seguir todos los pasos, comparte los logs completos de la consola para diagnóstico adicional.

