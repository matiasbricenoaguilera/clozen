# 🚀 Cómo Crear Cuenta Admin en Clozen

## Paso 1: Crear Cuenta de Usuario Normal

1. **Ve a la aplicación:** http://localhost:3000
2. **Haz clic en "Registrarse"**
3. **Crea una cuenta** con:
   - Email: tu email real (ej: `tu@email.com`)
   - Contraseña: la que prefieras
   - Nombre completo: tu nombre

## Paso 2: Convertir Usuario en Admin

### Opción A: Usando Supabase Dashboard (Recomendado)

1. **Ve a Supabase:** https://supabase.com/dashboard
2. **Selecciona tu proyecto** Clozen
3. **Ve a "Table Editor"** en el menú lateral
4. **Selecciona la tabla** `users`
5. **Busca tu usuario** por email
6. **Haz clic en "Edit"** (icono de lápiz)
7. **Cambia el campo `role`** de `'user'` a `'admin'`
8. **Guarda los cambios**

### Opción B: Usando SQL (Más rápido)

En **SQL Editor** de Supabase, ejecuta:

```sql
-- Reemplaza 'tu@email.com' con tu email real
UPDATE public.users
SET role = 'admin'
WHERE email = 'tu@email.com';
```

## Paso 3: Verificar que Funciona

1. **Inicia sesión** en http://localhost:3000 con tu cuenta
2. **Deberías ver nuevas opciones** en la navegación:
   - "Cajas" - para gestionar cajas físicas
   - Posiblemente más opciones admin

## 🎯 Funcionalidades de Admin

Como admin podrás:
- ✅ Gestionar cajas del closet (`/admin/boxes`)
- ✅ Escanear y escribir tags NFC
- ✅ Administrar usuarios (futuro)
- ✅ Acceder a paneles administrativos

## 🔧 Solución de Problemas

Si no ves las opciones de admin:
1. Verifica que el campo `role` sea exactamente `'admin'` (con minúsculas)
2. Recarga la página o cierra/inicia sesión nuevamente
3. Revisa la consola del navegador por errores

¿Necesitas ayuda con algún paso específico?</contents>
</xai:function_call">Crea un archivo con instrucciones detalladas para crear cuenta admin



