# 🚨 POLÍTICAS RLS REQUERIDAS PARA CLOZEN

## ⚠️ ERROR DE DEPLOY - POLÍTICAS RLS FALTANTES

El deploy de Netlify está fallando porque **las políticas RLS de Supabase no permiten que los usuarios normales vean las cajas**. Esto causa errores en las consultas durante el build.

## 🔧 SOLUCIÓN: Ejecutar Políticas RLS

### Paso 1: Acceder a Supabase SQL Editor
1. Ve a [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto Clozen
3. Ve a **SQL Editor** en el menú lateral

### Paso 2: Ejecutar el Script de Políticas

Copia y pega **TODO** el contenido del archivo `update-boxes-policies.sql` en el SQL Editor y ejecuta:

```sql
-- Actualización de políticas RLS para cajas públicas
-- Ejecutar este script en Supabase SQL Editor

-- Eliminar política antigua restrictiva
DROP POLICY IF EXISTS "Admins can manage boxes" ON public.boxes;

-- Nueva política: Todos pueden VER cajas públicas
CREATE POLICY "Anyone can view boxes" ON public.boxes
  FOR SELECT USING (true);

-- Nueva política: Solo admins pueden CREAR, EDITAR y ELIMINAR cajas
CREATE POLICY "Admins can manage boxes" ON public.boxes
  FOR INSERT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update boxes" ON public.boxes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete boxes" ON public.boxes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

### Paso 3: Verificar que Funciona

Después de ejecutar el script, deberías poder:
- ✅ Usuarios normales pueden ver las cajas al agregar prendas
- ✅ El closet carga correctamente las prendas
- ✅ El deploy de Netlify funciona sin errores

## 🔍 ¿Por Qué Fallaba el Deploy?

**Antes:** Solo admins podían ver cajas → Usuarios normales no veían opciones → Consultas fallaban

**Después:** Todos pueden ver cajas → Funcionalidad completa → Build exitoso

## 🎯 Próximos Pasos

1. ✅ Ejecutar el script SQL arriba
2. ✅ Hacer commit si es necesario
3. ✅ Trigger nuevo deploy en Netlify
4. ✅ Verificar que funciona correctamente

## 📞 Soporte

Si el problema persiste, comparte los logs completos del build de Netlify para diagnóstico específico.</contents>
</xai:function_call">Crea un archivo con instrucciones claras para ejecutar las políticas RLS necesarias
