# FAQ - Preguntas Frecuentes sobre NFC

## 📱 ¿Qué pasa si dos tags NFC tienen el mismo código?

### Problema
Algunos tags NFC económicos pueden tener **serial numbers duplicados**. Esto significa que dos tags diferentes pueden mostrar el mismo código (ejemplo: `35:33:3A:66:34:3A`), lo que impide identificar correctamente cada prenda.

### Solución
El sistema **prioriza el registro UTF-8** sobre el serial number del chip. Si encuentras tags duplicados, puedes escribir un **UUID único** en cada tag:

## 🔧 Cómo resolver tags duplicados

### Paso 1: Identificar el problema
Cuando intentas asociar un tag a una prenda y el sistema te dice:
```
⚠️ Este tag NFC ya está asociado a la prenda "polera adidas"
```

Pero estás escaneando una prenda diferente, entonces tienes un serial number duplicado.

### Paso 2: Escribir un UUID único
1. Ve a **Admin → Gestionar Tags**
2. Click en **"Escribir nuevo ID"**
3. Escanea el tag que quieres diferenciar
4. El sistema generará automáticamente un UUID único (ejemplo: `A1B2C3D4E5F6789...`)
5. Mantén el tag quieto hasta que veas **"✅ Tag NFC escrito exitosamente"**

### Paso 3: Verificar
1. Click en **"Escanear tag existente"**
2. Escanea el tag que acabas de escribir
3. Verifica que **"Registro 1 (UTF-8)"** muestre el nuevo UUID (con fondo verde)

### Paso 4: Repetir para el segundo tag
1. Haz lo mismo con el otro tag duplicado
2. Se generará un UUID diferente automáticamente
3. Ahora cada tag tiene identificación única

## 📊 Cómo funciona la priorización

El sistema lee los tags NFC en este orden de prioridad:

```
Prioridad 1: UTF-8 registro 1 (editable, único) ⭐
Prioridad 2: UTF-8 registro 2 (si registro 1 duplicado)
Prioridad 3: Serial number del chip (inmutable, puede duplicarse)
Prioridad 4: HEX (último recurso)
```

### Ejemplo práctico

**Tag 1 (polera adidas):**
```
Serial: 35:33:3A:66:34:3A (ignorado)
UTF-8:  A1B2C3D4E5F6789... ← ✅ El sistema usa este
```

**Tag 2 (pijama panda):**
```
Serial: 35:33:3A:66:34:3A (ignorado, mismo que tag 1)
UTF-8:  B2C3D4E5F6789AB... ← ✅ El sistema usa este (diferente)
```

Resultado: ✅ Ambas prendas se identifican correctamente

## 🎯 Flujo de trabajo recomendado

### Para tags nuevos:
```
1. Comprar tags NFC
2. Admin → Gestionar Tags → Escribir nuevo ID
3. Asociar cada tag a una prenda
4. ✅ Listo para usar
```

### Para tags ya asociados con serial duplicado:
```
1. Detectar el duplicado (el sistema te avisará)
2. Admin → Gestionar Tags → Escribir nuevo ID
3. Escanear el tag en la sección donde lo estás usando
4. ✅ Ahora se identifica con el UUID único
```

## ❓ Preguntas frecuentes

### ¿Por qué algunos tags tienen serial duplicado?
Los fabricantes de tags NFC económicos a veces reutilizan serial numbers. Esto es común en tags de bajo costo.

### ¿Puedo usar tags sin escribir UUID?
Sí, si el serial number es único. El sistema funciona con ambos formatos.

### ¿Qué pasa si borro accidentalmente el UUID?
Puedes escribir uno nuevo en cualquier momento desde **Admin → Gestionar Tags → Escribir nuevo ID**.

### ¿El UUID se borra si escaneo el tag muchas veces?
No. El UUID queda grabado permanentemente en el tag hasta que lo sobrescribas.

### ¿Puedo usar la misma solución con códigos de barras?
No. Los códigos de barras son solo para lectura y vienen impresos. Para códigos de barras duplicados, necesitas reimprimir etiquetas con códigos únicos.

### ¿Necesito una app especial para escribir los UUID?
No. Puedes escribir directamente desde **Admin → Gestionar Tags** en tu navegador (Chrome en Android).

### ¿Funciona en iPhone/iOS?
No. Web NFC solo funciona en **Chrome para Android**. iOS no soporta Web NFC por restricciones de Apple.

## 🔒 Compatibilidad

### ✅ Compatible:
- Chrome en Android 10+
- Tags NFC tipo NTAG213, NTAG215, NTAG216
- Tags compatibles con NFC Forum Type 2

### ❌ No compatible:
- iPhone/iOS (limitación de Apple)
- Firefox, Safari, Edge (solo Chrome Android soporta Web NFC)
- Tags NFC con protección de escritura bloqueada
- Tags Mifare Classic (no son NDEF)

## 🆘 Soporte adicional

Si tienes problemas:
1. Verifica que estés usando **Chrome en Android**
2. Asegúrate que el **NFC esté activado** en tu teléfono
3. Mantén el tag **completamente quieto** durante la escritura (3 segundos)
4. Si el error persiste, intenta con otro tag NFC

---

**Última actualización:** Enero 2026
