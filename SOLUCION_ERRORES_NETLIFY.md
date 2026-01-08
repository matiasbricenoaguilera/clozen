# 🔧 Solución de Errores en Netlify

## ❌ Error 1: `@import rules are not allowed here`

Este error está relacionado con cómo Next.js maneja los CSS en producción. Es un warning que no afecta la funcionalidad pero puede aparecer en la consola.

### Solución:

El error generalmente se resuelve automáticamente. Si persiste, verifica:

1. **Verifica que estás usando el plugin correcto de Netlify**
   - El archivo `netlify.toml` debe tener el plugin `@netlify/plugin-nextjs`
   - Este plugin maneja automáticamente la optimización de CSS

2. **Si el error persiste**, puede ser que necesites actualizar la configuración:
   - El plugin de Netlify para Next.js maneja automáticamente los CSS
   - No necesitas configuraciones adicionales en `next.config.ts` para CSS

3. **Este warning es informativo** y no afecta la funcionalidad de la aplicación

---

## ❌ Error 2: `401 Unauthorized` de Supabase

Este error indica que las credenciales de Supabase NO están configuradas correctamente en Netlify.

### Solución Paso a Paso:

#### Paso 1: Verificar que las variables están en Netlify

1. Ve a tu sitio en Netlify → **Site settings**
2. Ve a **Environment variables**
3. Verifica que tienes estas variables:

```
✅ NEXT_PUBLIC_SUPABASE_URL
✅ NEXT_PUBLIC_SUPABASE_ANON_KEY
```

#### Paso 2: Verificar que los valores son correctos

Las variables deben tener exactamente estos valores (sin espacios al inicio o final):

**Variable 1:**
```
Nombre: NEXT_PUBLIC_SUPABASE_URL
Valor: https://veonmbligxuuwyysrjli.supabase.co
```

**Variable 2:**
```
Nombre: NEXT_PUBLIC_SUPABASE_ANON_KEY
Valor: (tu clave anónima completa de Supabase)
```

#### Paso 3: Verificar en Supabase

1. Ve a tu proyecto en [Supabase](https://supabase.com)
2. Ve a **Settings** → **API**
3. Copia exactamente:
   - **Project URL** → debe ir en `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → debe ir en `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**⚠️ IMPORTANTE**: 
- Usa **anon public key**, NO la service_role key
- Asegúrate de que la URL empieza con `https://`
- No debe haber espacios al inicio o final

#### Paso 4: Hacer un nuevo deploy después de agregar variables

**CRÍTICO**: Después de agregar o modificar variables de entorno:

1. Ve a **Deploys** en Netlify
2. Haz clic en **Trigger deploy**
3. Selecciona **Clear cache and deploy site**
4. Esto fuerza un nuevo build con las nuevas variables

**NO** uses "Retry deploy" - debes hacer un deploy limpio.

---

## 🔍 Verificar que las Variables Están Cargadas

Para verificar que las variables se están cargando correctamente:

### Método 1: Revisar los logs del build

1. Ve a **Deploys** en Netlify
2. Haz clic en el último deploy
3. Busca en los logs si aparecen errores sobre variables no encontradas

### Método 2: Verificar en el navegador (solo para variables NEXT_PUBLIC_*)

Abre la consola del navegador (F12) en tu sitio desplegado y ejecuta:

```javascript
console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log('Supabase Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Configurada ✅' : 'No configurada ❌')
```

**Nota**: Solo funciona para variables que empiezan con `NEXT_PUBLIC_`

### Método 3: Agregar temporalmente un componente de debug

Puedes agregar temporalmente este componente en tu página principal para verificar:

```tsx
{process.env.NODE_ENV === 'development' && (
  <div className="fixed bottom-0 right-0 bg-yellow-500 p-2 text-xs">
    Supabase URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅' : '❌'}
    Supabase Key: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅' : '❌'}
  </div>
)}
```

---

## ✅ Checklist de Verificación

Antes de reportar un problema, verifica:

- [ ] Las variables están configuradas en Netlify → Site settings → Environment variables
- [ ] Los nombres de las variables son EXACTAMENTE:
  - `NEXT_PUBLIC_SUPABASE_URL` (con guiones bajos, no guiones)
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (con guiones bajos, no guiones)
- [ ] Los valores son correctos (sin espacios al inicio/final)
- [ ] La URL de Supabase empieza con `https://`
- [ ] Estás usando la **anon key**, NO la service_role key
- [ ] Hiciste un **nuevo deploy** después de agregar/modificar variables
- [ ] Usaste "Clear cache and deploy site" no solo "Retry deploy"
- [ ] Esperaste 2-5 minutos a que termine el deploy

---

## 🆘 Si Nada Funciona

Si después de seguir todos los pasos sigue dando error 401:

1. **Verifica las credenciales en Supabase**:
   - Ve a Supabase → Settings → API
   - Verifica que las credenciales son correctas
   - Si es necesario, regenera la anon key

2. **Verifica que el proyecto de Supabase está activo**:
   - Asegúrate de que el proyecto no está pausado
   - Verifica que no has excedido los límites gratuitos

3. **Revisa los logs del build en Netlify**:
   - Ve a Deploys → Último deploy → Ver logs completos
   - Busca errores relacionados con variables de entorno

4. **Prueba las credenciales localmente**:
   - Verifica que funcionan en `.env.local` en desarrollo
   - Si funcionan localmente pero no en Netlify, el problema está en la configuración de Netlify

---

## 📝 Nota Importante sobre Variables de Entorno

**Variables con `NEXT_PUBLIC_`**:
- Están disponibles en el navegador (cliente)
- Se exponen en el código JavaScript
- Úsalas para cosas que el cliente necesita ver

**Variables SIN `NEXT_PUBLIC_`**:
- Solo están disponibles en el servidor
- NO se exponen en el código del cliente
- Úsalas para API keys secretas

**Para Supabase**, necesitas las variables con `NEXT_PUBLIC_` porque el cliente necesita conectarse directamente a Supabase.

