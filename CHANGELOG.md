# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Búsqueda de outfits similares de Pinterest**: Nueva funcionalidad para encontrar outfits similares a imágenes de Pinterest usando Google Vision
  - **MEJORADO**: Sistema de búsqueda más flexible y preciso
  - Mapeo de tipos mejorado: soporta más términos y búsqueda parcial
  - Comparación de colores mejorada: soporta nombres de colores (azul, rojo, etc.) y códigos hex
  - Umbrales de similitud ajustados: de 30 a 15 para encontrar más coincidencias
  - Búsqueda de respaldo: si no encuentra matches, busca con umbrales más bajos
  - Logging de depuración: muestra en consola qué detecta y qué encuentra
  - Mejor scoring: sistema de puntos más flexible que considera tipo, color y palabras comunes
  - Componente `PinterestOutfitAnalyzer` para subir imágenes o ingresar URLs de Pinterest
  - Análisis de imágenes con Google Vision API: detecta prendas, colores dominantes y estilos
  - Búsqueda inteligente de outfits similares en el closet del usuario basada en tipo y color
  - Sistema de scoring de similitud que compara prendas detectadas con el closet
  - Integrado en la página de Recomendaciones
  - Muestra análisis detallado: prendas detectadas, colores dominantes y estilo
  - Permite usar outfits encontrados directamente desde los resultados
  - Soporte para subir archivos de imagen o ingresar URLs de imágenes públicas
  - No requiere API de Pinterest, solo Google Vision (ya configurada)
- **Tipo de prenda "Ropa de trabajo"**: Nuevo tipo de prenda disponible en el sistema
  - Agregado a la lista de tipos de prenda en el formulario de agregar prendas
  - Las prendas de tipo "ropa de trabajo" NO se incluyen en las recomendaciones automáticas
  - Útil para separar ropa de trabajo de ropa casual/de uso diario
- **Escáner NFC para seleccionar cajas automáticamente**: Nueva funcionalidad para escanear tags NFC de cajas al asignar prendas lavadas
  - Botón "Escanear NFC" junto al selector de cajas en "Organizar Ropa Lavada"
  - Escaneo automático de tags NFC asociados a cajas
  - Validación de capacidad máxima: si la caja está llena, muestra error y sugiere otra caja disponible
  - Validación de espacio suficiente: verifica que haya espacio para todo el lote de prendas
  - Selección automática de la caja al escanear exitosamente
  - Mensajes informativos con capacidad actual y espacios disponibles
  - Integrado en la sección de asignación de cajas a lotes de prendas
- **Escáner NFC de cajas en botón "Ingresar"**: Nueva funcionalidad para escanear tags NFC de cajas al ingresar prendas individuales
  - Botón "Escanear NFC" junto al selector de cajas en el modal de "Ingresar Prenda"
  - Escaneo automático de tags NFC asociados a cajas
  - Validación de capacidad máxima: si la caja está llena, muestra error y sugiere otra caja disponible
  - Selección automática de la caja al escanear exitosamente
  - Mensajes informativos con capacidad actual y espacios disponibles
  - Integrado en el flujo de ingreso de prendas individuales desde el dashboard del usuario

### Fixed
- **Corregida liberación de recursos de cámara en escáner de códigos de barras (Solución Definitiva v2)**: Solucionado completamente el problema donde la cámara no se liberaba correctamente y el campo de texto no era editable
  - **Componente BarcodeScanner** (`components/barcode/barcode-scanner.tsx`):
    - **CRÍTICO**: Removida verificación previa de permisos con `getUserMedia()` que causaba conflictos
    - Ahora `html5-qrcode` maneja TODOS los permisos y acceso a la cámara directamente
    - Esto elimina la condición de carrera donde dos procesos intentaban acceder a la cámara simultáneamente
    - **Agregado estado `isInitializing`** para prevenir múltiples inicializaciones simultáneas
    - **Botón "Iniciar Escaneo" ahora se deshabilita** durante la inicialización, mostrando "Inicializando..."
    - **Limpieza proactiva**: Verifica y limpia TODOS los videos existentes en el DOM antes de iniciar
    - Aumentado delay de limpieza de 500ms a **1000ms** para dar más tiempo a la liberación de recursos
    - Delay adicional de 500ms después de limpiar videos existentes
    - Convertida `stopScanner()` a `useCallback` para prevenir recreaciones innecesarias
    - Mejorada liberación de recursos: ahora detiene TODOS los MediaStreams globalmente como último recurso
    - Agregada limpieza de todos los elementos `<video>` en el DOM, no solo el del escáner
    - `useEffect` de cleanup ahora incluye `stopScanner` en dependencias correctamente
    - Mejorados mensajes de error para ser más específicos y útiles
  - **Página de Organizar** (`src/app/admin/organize/page.tsx`):
    - **CRÍTICO**: Corregido problema de closure en `onSuccess` del escáner
    - Ahora usa `batchCodesRef.current` en lugar de `batchCodes` para obtener el valor más actualizado
    - Esto resuelve el problema donde el campo no era editable y el código volvía a aparecer
    - Aumentados timeouts de 500ms a **1000ms** en `onSuccess` y `onClose`
  - **Página Agregar Prenda** (`src/app/closet/add/page.tsx`):
    - Aumentados timeouts de 500ms a **1000ms** en `onSuccess` y `onClose`
  - **Solucionado**: Campo de códigos ahora es completamente editable sin que el código escaneado vuelva a aparecer
  - **Solucionado**: Ya no aparece el error "La cámara está siendo usada por otra aplicación" o "NotReadableError"
  - **Solucionado**: La cámara se libera completamente entre escaneos con tiempos más generosos
  - **Solucionado**: Prevención de doble-clicks y múltiples inicializaciones simultáneas
  - **Página de Organizar** (`src/app/admin/organize/page.tsx`):
    - Cambiado a **modo seguro**: `continuous={false}` para cierre automático después de cada escaneo
    - El escáner se cierra automáticamente después de escanear cada código
    - Aumentado timeout de key de 100ms a 500ms para dar tiempo a limpieza completa
    - Key se incrementa tanto en `onSuccess` como en `onClose` para forzar recreación limpia
    - Key se incrementa antes de abrir el escáner para garantizar instancia fresca
  - **Página Agregar Prenda** (`src/app/closet/add/page.tsx`):
    - Agregado estado `barcodeScannerKey` para forzar recreación del componente
    - Implementada misma lógica segura con timeouts de 500ms
    - `continuous={false}` explícito para comportamiento predecible
  - **Solucionado**: Campo de códigos ahora es completamente editable (no se bloquea por el escáner)
  - **Solucionado**: Ya no aparece el error "La cámara está siendo usada por otra aplicación"
  - **Solucionado**: La cámara se libera completamente entre escaneos
  - **Nota**: Para escanear múltiples códigos, ahora hay que presionar el botón 📷 cada vez (más seguro y estable)
- **Corregido error de permisos al retirar prendas**: Solucionado el problema donde los usuarios no podían retirar sus propias prendas
  - Agregado campo `user_id` a la consulta en `findEntityByNFCTag()`
  - Ahora la función verifica correctamente el propietario de la prenda antes de permitir retirarla
  - Los usuarios normales pueden retirar solo sus prendas, los admins pueden retirar cualquier prenda
- **Eliminados logs de debugging que causaban errores en consola**: Removidos todos los logs de debugging que intentaban conectarse a un servidor local inexistente
  - Eliminados 10 bloques de código de logging de depuración en `hooks/useNFC.ts`
  - La consola del navegador ya no muestra errores `ERR_CONNECTION_REFUSED` al usar NFC
  - La funcionalidad NFC sigue funcionando correctamente sin estos logs
- **Funcionalidad de retirar e ingresar prendas con NFC ahora funciona correctamente**: Mejorada la funcionalidad de retirar e ingresar prendas desde el perfil de usuario
  - La función "Retirar" ahora efectivamente retira la prenda (status: 'in_use', box_id: null) y muestra mensaje de éxito
  - La función "Ingresar" ahora muestra correctamente el selector de caja después de escanear
  - Mejorado el manejo de errores con mensajes más descriptivos
  - Mensajes de éxito se muestran en verde, errores en rojo
  - La función `withdrawGarment` ahora lanza errores correctamente para mejor manejo
  - Al retirar una prenda, se remueve automáticamente de la caja (box_id: null)
- **Escáner NFC en perfil de usuario ahora lee UTF-8 correctamente**: Corregida la lectura de tags NFC en las funciones "Retirar" e "Ingresar"
  - Agregado `skipExistenceCheck={true}` a ambos escáneres NFC en el perfil de usuario
  - Ahora aplica la misma lógica de lectura UTF-8 que en la sección de administrador
  - Solucionado: El escáner ahora lee correctamente los registros UTF-8 sin confundirse con el serial number
  - Los tags ya asociados a prendas pueden ser leídos correctamente para retirar/ingresar
- **Selector de caja en "Organizar Ropa Lavada" ahora visible para NFC**: Corregida la visualización del selector de caja y lista de prendas encontradas
  - Movida la sección de prendas encontradas fuera del bloque condicional del modo de escaneo
  - Ahora se muestra tanto para escaneo NFC como para códigos de barras
  - Solucionado: Al escanear con NFC, ahora aparece la opción de asignar caja correctamente
- **Escáneres se cierran automáticamente al buscar prendas**: Mejora en la UX de "Organizar Ropa Lavada"
  - El modal del scanner NFC se cierra automáticamente después de presionar "Buscar Prenda"
  - El scanner de códigos de barras también se cierra automáticamente
  - Permite visualizar mejor la lista de prendas encontradas y el selector de caja

### Added
- **Escáner de códigos de barras con cámara**: Nueva funcionalidad para leer códigos de barras usando la cámara del celular
  - Componente `BarcodeScanner` usando la biblioteca `html5-qrcode`
  - Soporte para múltiples formatos: EAN-13, EAN-8, CODE-128, CODE-39, CODE-93, UPC-A, UPC-E, ITF
  - Modo continuo para escanear múltiples códigos en secuencia
  - Prevención de escaneos duplicados (debounce de 1 segundo)
  - Preferencia automática por cámara trasera en dispositivos móviles
  - Integrado en "Agregar Prenda" con botón de cámara junto al input manual
  - Integrado en "Organizar Ropa Lavada" con modo continuo para múltiples escaneos
  - Interfaz intuitiva con instrucciones y feedback visual
- **Botones de acción rápida "Retirar" e "Ingresar" en dashboard**: Nuevos botones responsivos para gestión rápida de prendas
  - Botón "Retirar": Escanea NFC y retira prenda del cajón (status: 'in_use')
  - Botón "Ingresar": Escanea NFC y permite elegir cajón donde guardar (status: 'available' + box_id)
  - Modales con scanners NFC integrados
  - Selector de cajón con validación de capacidad máxima
  - Interfaz responsive para móvil y desktop
- **Filtro por usuario en Mi Closet (solo admin)**: Los administradores ahora pueden filtrar prendas por usuario
  - Nuevo selector de usuario en la barra de búsqueda
  - Muestra el nombre completo o email del usuario
  - Solo visible para usuarios con rol admin
  - Se combina con los filtros existentes (búsqueda y tipo de prenda)
- **Página FAQ en panel admin**: Nueva sección de preguntas frecuentes sobre NFC
  - Accesible desde Admin → FAQ
  - Explica cómo resolver tags NFC duplicados
  - Información de compatibilidad de dispositivos
  - Solución a errores comunes de escritura
  - Preguntas frecuentes con respuestas detalladas
- **FAQ sobre NFC (FAQ_NFC.md)**: Documentación completa sobre manejo de tags NFC duplicados
  - Explicación del problema de serial numbers duplicados
  - Guía paso a paso para resolver duplicados escribiendo UUIDs únicos
  - Explicación de la priorización UTF-8 > Serial > HEX
  - Preguntas frecuentes sobre compatibilidad y uso
  - Flujos de trabajo recomendados para tags nuevos y existentes

### Changed
- **WeatherCard compacto**: Clima ahora se muestra en una barra horizontal compacta
  - Diseño más pequeño y eficiente
  - Muestra temperatura, descripción, humedad y ciudad en una sola línea
  - Iconos reducidos para mejor uso del espacio
  - Mejor integración visual en el dashboard
- **Mejora visualización de imágenes verticales**: Imágenes de prendas ahora se muestran mejor para fotos tomadas en vertical
  - Cambio de `object-cover` a `object-contain` para mostrar imagen completa sin recortar
  - Aspect ratio 3:4 (vertical) en lugar de cuadrado
  - Aplicado en todas las secciones: Mi Closet, Recomendaciones, Prendas encontradas
  - Mejor visualización de prendas fotografiadas con celular en posición vertical
- **Tipos de prenda ordenados alfabéticamente**: Lista de tipos de prenda reorganizada para facilitar búsqueda
  - Ordenados de A-Z en el selector de agregar prenda
  - Mejora la usabilidad al buscar tipos específicos
- **Responsividad mejorada en Gestionar Tags**: Códigos HEX largos ahora se ajustan correctamente
  - Eliminado desbordamiento horizontal de códigos HEX
  - Textos con `break-all` para ajuste automático
  - Mejor visualización en dispositivos móviles
- **Gestión de errores NFC mejorada en modo continuo**: Los errores de reinicio del scanner ya no se muestran innecesariamente
  - En "Organizar ropa lavada", los errores se ignoran si ya hay códigos agregados exitosamente
  - Reduce confusión del usuario al ver mensajes de error después de escaneos exitosos
  - Solo se muestran errores reales que requieren atención del usuario

### Fixed
- **Extracción correcta del texto NDEF saltando el header**: Corregida la lectura de registros NDEF Text Record para extraer solo el ID real
  - Web NFC NO quita automáticamente el header NDEF al leer (incluye status byte + language code)
  - Lógica aplicada directamente en el código de lectura (sin helper) para mayor simplicidad y confiabilidad
  - El header NDEF Text Record incluye: [status byte][language code 'en'][texto UTF-8]
  - Status byte: bits 5-0 = longitud del código de idioma (0x02 para 'en')
  - Ahora extrae correctamente el ID real leyendo el status byte y saltando (1 byte status + N bytes language code)
  - Aplicado en `readNFCTag` (lectura principal) y `readNdefTextRecordsOnce` (verificación)
  - Solucionado: IDs leídos ahora coinciden con los escritos (ej: `BC655FA1301345D2B623E6DFE185D86D` en vez de `\x02enBC655FA1301345D2B623E6DFE185D86D`)
  - Solucionado: Búsquedas en base de datos ahora funcionan correctamente
  - Solucionado: Eliminados falsos duplicados causados por el header incluido
- **Construcción manual completa de NDEF Text Record para escritura**: Se construye el payload NDEF según especificación NFC Forum RTD
  - Payload completo: [status byte][language code 'en'][texto UTF-8]
  - Status byte calculado correctamente (0x02 = UTF-8 + longitud idioma 2)
  - Formato 100% compatible con estándar NFC Forum Type 2 Tag
  - Logs detallados del payload construido para debugging
- **Escritura NFC simplificada sin verificación automática**: Eliminada la verificación posterior que causaba falsos negativos
  - Ahora confía en que `ndef.write()` solo resuelve si la escritura fue exitosa (comportamiento estándar de Web NFC)
  - Eliminados delays y lectura de verificación que causaban conflictos de timing
  - Si `write()` no lanza error = escritura exitosa (como hacen la mayoría de apps NFC profesionales)
- **Validación mejorada de ndef.stop()**: Verifica que el método existe antes de llamarlo para evitar errores
- **Verificación de escritura NFC corregida con detención del reader**: Se detiene el NDEFReader antes de verificar para evitar conflictos
  - Detiene el reader activo después de escribir (`ndef.stop()`) antes de crear uno nuevo para verificar
  - Delay aumentado de 500ms a 1500ms para tags que necesitan más tiempo de grabación física
  - Evita conflicto de múltiples readers activos simultáneamente
  - Logs detallados para debugging completo del proceso
  - Solucionado: "No se pudo verificar el ID escrito" cuando el tag SÍ se escribió correctamente
- **Escritura NDEF text record corregida**: Se corrige `buildSingleTextMessage` para escribir registros NDEF text completos con header válido (status byte + código de idioma + texto UTF-8)
  - Ahora los registros escritos son 100% compatibles con la lectura NDEF que espera este formato
  - Solucionado: "Escribir nuevo ID" en Admin → Gestionar Tags ahora funciona correctamente y se verifica automáticamente
- **Admin → Gestionar Tags ahora permite escanear y escribir tags asociados**: Se habilita `skipExistenceCheck` para todos los modos (read y write)
  - Permite escanear tags ya asociados para gestionarlos, liberarlos y sobrescribirlos
  - Solucionado: Tanto "Escanear tag existente" como "Escribir nuevo ID" funcionan con tags asociados
- **Prioridad UTF-8 sobre serial number**: Se corrige la priorización para que el UTF-8 escrito (editable) tenga prioridad sobre el serial number (inmutable del hardware)
  - Ahora la prioridad es: UTF-8 → Serial Number → HEX
  - Esto permite sobrescribir tags con nuevos IDs sin que el serial number interfiera
  - Solucionado: Tags con serial duplicado (ej: 35:33:3A:66:34:3A) ahora leen el UUID sobrescrito
- **Decodificación correcta de NDEF text records**: Se corrige la lectura de registros NDEF para extraer solo el texto UTF-8, sin incluir el status byte ni el código de idioma
  - Ahora se saltan correctamente los primeros bytes (status + lang code) del NDEF text record
  - Esto permite que los registros UTF-8 sobrescritos se lean correctamente en todas las secciones
  - Solucionado: En "Incorporar prenda lavada" ahora se lee el UTF-8 en vez del HEX

### Changed
- **Estrategia de IDs NFC corregida**: 
  - Prioridad 1: UTF-8 registro 1 (lo que escribiste, editable)
  - Prioridad 2: UTF-8 registro 2 (si registro 1 está duplicado)
  - Prioridad 3: Serial number del chip (solo si no hay UTF-8, inmutable)
  - Prioridad 4: HEX (último recurso si no hay UTF-8 ni serial)
  - UTF-8 tiene prioridad porque es editable y permite resolver duplicados de serial number
- **Resaltado visual del registro usado**: En Admin → Gestionar Tags, el registro que se usó como ID se muestra con fondo verde y marca "✓ Usado como ID"
- **Crear Nuevo Tag NFC ahora siempre escribe un UUID único**: El flujo de escritura genera un ID válido antes de escribirlo, evitando reusar NDEF antiguos y duplicados
- **Lectura NDEF por registros con avisos**: Se lee el registro 1 (UTF‑8) y, si está duplicado, se usa el registro 2 con aviso al usuario
  - Si no hay ID válido, se genera y se informa que se está creando un nuevo código
- **Sobrescritura NDEF en tags nuevos**: Al escribir un tag nuevo se reemplaza el contenido previo con un solo registro UTF‑8
- **Aviso de tag solo lectura**: Se muestra un error claro si el tag no permite escritura
- **Nueva sección Admin "Gestionar Tag"**: Herramienta para escanear, liberar y reescribir tags NFC desde el panel administrativo
- **Verificación automática de escritura NFC**: Después de escribir, se vuelve a leer el tag y se valida que el ID quedó guardado
- **Diagnóstico NDEF en Admin**: La sección Gestionar Tags ahora muestra registros NDEF en UTF‑8 y HEX para comparar valores

### Added
- **Validación en tiempo real de códigos duplicados**: Sistema de avisos visuales cuando se intenta usar un código NFC o de barras ya registrado
  - Validación automática con debounce de 500ms al ingresar códigos
  - Alertas visuales (Alert) que muestran el nombre de la prenda que ya tiene el código
  - Funciona tanto en la página de agregar prendas como en el modal de edición
  - Validación al escanear tags NFC o ingresar códigos manualmente
  - En el modal de edición, excluye la prenda actual de la validación para permitir ediciones sin falsos positivos
  - Prevención de guardado si hay códigos duplicados

### Fixed
- **Fix de redirección durante guardado**: Corregido problema donde la aplicación redirigía al login durante el proceso de guardado de prendas con código NFC
  - Agregada protección en useEffect para evitar redirecciones cuando `saving === true`
  - Previene que cambios temporales en `userProfile` durante el guardado causen redirecciones no deseadas
  - Mejora la experiencia de usuario al evitar interrupciones durante el proceso de guardado
- **Fix de guardado de códigos NFC**: Corregido problema donde los códigos NFC no se guardaban correctamente
  - Normalización automática de códigos NFC: se limpian espacios y se convierten a mayúsculas antes de guardar
  - Normalización aplicada tanto al leer desde scanner como al ingresar manualmente
  - Mejor manejo de errores con logging detallado para diagnóstico
  - Corrección aplicada en página de agregar prendas y modal de edición
  - Validación de duplicados también usa códigos normalizados para consistencia
- **Fix de carga infinita en autenticación**: Corregido problema donde la aplicación se quedaba cargando al iniciar sesión
  - Agregado timeout de 10 segundos para evitar que la consulta de perfil se quede colgada
  - Mejorado manejo de errores con logging detallado para diagnóstico
  - Asegurado que `loading` siempre se establece en `false` incluso si hay errores
  - Uso de `useCallback` para optimizar `fetchUserProfile` y evitar recreaciones innecesarias
  - Detección específica de error PGRST116 (usuario no encontrado) con mensaje informativo
  - Mejor logging en `onAuthStateChange` para rastrear cambios de estado de autenticación

### Added
- **Mejoras completas de responsividad**: La aplicación ahora es totalmente responsive en todos los dispositivos
  - Menú hamburguesa móvil en Navbar con navegación adaptativa
  - Grids adaptativos en todas las páginas (closet, recomendaciones, admin)
  - Tablas responsive con vista móvil optimizada (Admin In-Use)
  - Formularios adaptativos con mejor UX en pantallas pequeñas
  - Botones y controles optimizados para touch en móviles
  - Textos y espaciados adaptativos según tamaño de pantalla
  - Mejora en la experiencia de usuario en dispositivos móviles y tablets

### Added
- **Sistema de selección múltiple con lista de búsqueda**: Flujo optimizado para buscar y retirar múltiples prendas
  - Panel flotante (GarmentSelectionCart) que muestra resumen de prendas seleccionadas
  - Panel lateral deslizable (GarmentSearchList) con vista detallada de cajas agrupadas
  - Selección múltiple: usuarios pueden agregar varias prendas a una lista antes de buscar
  - Marcar como "encontrada": checkboxes para marcar prendas encontradas antes de confirmar
  - Quitar de lista: botón para remover prendas de la selección antes de confirmar
  - Ordenamiento inteligente: cajas ordenadas por ubicación física (si existe) o alfabéticamente
  - Confirmación múltiple: retirar todas las prendas seleccionadas en una sola acción
  - Indicadores visuales: botones cambian a "En Lista" cuando la prenda está seleccionada
- **Modal de ubicación de prendas**: Componente que muestra dónde buscar las prendas antes de usarlas
  - Agrupa prendas por caja para facilitar la búsqueda
  - Muestra ubicación física de las cajas cuando está disponible
  - Advertencia para prendas sin caja asignada
  - Resumen visual de ubicaciones únicas
- **Optimización de búsqueda de prendas**: Sistema mejorado para identificar dónde están las prendas
  - Modal de ubicación antes de retirar prendas individuales
  - Modal de ubicación antes de usar outfits completos
  - Visualización mejorada de ubicación en tarjetas de prendas (incluye location de caja)
- **Funcionalidad NFC COMPLETA**: Sistema NFC totalmente operativo para prendas individuales
- **Diagnóstico avanzado de NFC**: Información detallada sobre compatibilidad y problemas específicos
- **Generación automática de IDs tipo MAC**: Tags NFC generan identificadores únicos similares a direcciones MAC
- **Validación de tags duplicados**: Prevención de asignación de tags NFC ya asociados a otras prendas/cajas
- **Escáner NFC integrado**: Componente funcional en formulario de agregar prendas con modos lectura/escritura
- **Indicadores NFC visuales**: Badges NFC en tarjetas de prendas para identificar prendas con tags asociados
- **Escáner de prendas desde closet**: Botón para escanear e identificar prendas existentes por NFC
- **Registro automático en base de datos**: Tags NFC se registran automáticamente en tabla `nfc_tags`
- **Utilidades NFC completas**: Librería de funciones para gestión completa de tags NFC

### Changed
- **Hook useNFC mejorado**: Agregada generación de IDs tipo MAC, validación de duplicados y funciones de utilidad
- **Diagnóstico NFC avanzado**: Función `getNFCSupportInfo()` para troubleshooting detallado
- **Validación HTTPS**: Detección automática de problemas de protocolo para Web NFC
- **Mensajes de error detallados**: Información específica sobre qué falta para que NFC funcione
- **Ingreso manual de NFC**: Opción para ingresar códigos NFC tipo MAC/hexadecimal manualmente
- **Validación de formato**: Soporte para formatos MAC (XX:XX:XX:XX:XX:XX) y hexadecimal largo
- **Feedback visual NFC**: Indicadores de carga y estados para operaciones NFC manuales
- **Optimización completa del closet**: Mejora significativa del rendimiento de carga
  - Consulta optimizada sin JOIN innecesario
  - Límite de 100 prendas para mejor rendimiento
  - Lazy loading de imágenes con fallback automático
  - Mapa de cajas para acceso O(1)
  - Estados de carga detallados y paralelos
  - Indicadores visuales mejorados
- **Corrección TypeScript**: Tipado explícito para resolver errores de compilación en Netlify
- **Sistema de cajas públicas**: Implementación completa con políticas RLS corregidas
- **Corrección TypeScript adicional**: Tipado explícito para resolver errores de consulta de cajas
- **Navegación condicional**: Panel Admin visible solo para administradores en el navbar
- **Corrección logout**: Usar signOut en lugar de logout del hook useAuth
- **Sistema Clozen completo**: Implementación total del sistema familiar de organización de ropa
- **Documentación crítica**: Guía para políticas RLS requeridas para deploy exitoso
- **Corrección de sintaxis**: Arreglo de coma faltante en objeto JavaScript
- **Importación faltante**: Agregar Package de lucide-react en navbar
- **Corrección TypeScript adicional**: Tipado en admin/organize page
- **Importación Search**: Agregar ícono Search faltante en admin/organize
- **Optimización formulario prendas**: Logging detallado, compresión de imágenes, operaciones paralelas
- **Corrección TypeScript destructuring**: Tipado explícito en callback NFC
- **Scripts SQL completos**: SUPABASE_SCHEMA_COMPLETE.sql y VERIFICACION_SCHEMA.sql para resolver problemas de schema cache
- **Corrección supabase.raw**: Reemplazar función inexistente con lógica de cliente en withdrawGarment
- **Mejoras completas en Organizar**: Navbar sticky, modal de cajas, selector manual con recomendaciones, mover/quitar prendas
- **Restricción de agregar prendas**: Solo administradores pueden agregar prendas, usuarios normales solo pueden ver y usar
- **Actualización de prendas olvidadas**: Al retirar una prenda, desaparece automáticamente de la lista de recomendaciones
- **Navbar reorganizado**: Admins siempre ven Mi Closet, Organizar y Cajas de forma clara
- **Selector de usuario al agregar**: Admins pueden elegir de qué usuario es la prenda desde lista desplegable
- **Formulario agregar prenda**: Integrado selector NFC con opciones de escanear tag existente o crear nuevo
- **Vista del closet**: Agregados indicadores NFC y funcionalidad de escaneo de prendas
- **Base de datos**: Integración completa con tabla `nfc_tags` para seguimiento de asociaciones

### Fixed
- **Error CSS @import en Netlify**: Ajustada configuración de Next.js para evitar warnings de @import en producción
- **Error 401 Supabase en Netlify**: Agregado mejor manejo de variables de entorno y validación de credenciales
- **Error Node.js version mismatch en Netlify**: Actualizado Node.js a 20.9.0 (Next.js requiere >=20.9.0)
  - Actualizado `netlify.toml` con `NODE_VERSION = "20.9.0"`
  - Creado archivo `.nvmrc` con versión 20.9.0 (método recomendado)
  - Agregado campo `engines` en `package.json` con `node >= 20.9.0` como respaldo
- **Configuración Netlify**: Ajustado netlify.toml para correcta construcción del proyecto
- **Debug de variables de entorno**: Agregado logging en desarrollo para verificar configuración de Supabase

### Changed
- **next.config.ts**: Simplificada configuración removiendo opciones que el plugin de Netlify maneja automáticamente
- **lib/supabase.ts**: Mejorada validación de credenciales y agregado debug en desarrollo
- **package.json**: Agregado campo `engines` para especificar versión de Node.js requerida
- **Documentación**: Creado SOLUCION_ERRORES_NETLIFY.md con guía completa para resolver errores comunes

### Fixed
- **NFC Writing Logic:** Corregido error crítico en `writeNFCTag` donde se intentaba escribir antes de detectar el tag NFC
- **NFC Tag Registry:** Implementado registro centralizado de tags NFC en tabla `nfc_tags` al asignar tags a cajas
- **NFC Duplicate Validation:** Agregada validación para prevenir asignación de tags NFC duplicados entre cajas y prendas
- **NFC Tag Cleanup:** Implementada limpieza automática de registros NFC al eliminar cajas
- **Páginas de autenticación:** Crear páginas `/auth/forgot-password` y `/auth/reset-password`
- **Error 404:** Solucionar enlace roto de "Olvidaste tu contraseña"
- **Variables de entorno:** Forzar carga de credenciales con dotenv-cli en scripts de desarrollo
- **Flujo de recuperación:** Implementar recuperación completa de contraseña con Supabase Auth
- **Prerendering Netlify:** Resolver error de prerendering con Suspense boundary para useSearchParams
- **Configuración Next.js:** Modificar scripts dev y build para cargar .env.local explícitamente
- **Tailwind CSS:** Migrar de Tailwind v4 a v3 para resolver errores de construct stylesheets
- **PostCSS:** Configurar correctamente plugins para compatibilidad con Next.js
- **Dependencias:** Limpiar y reinstalar node_modules para resolver conflictos de versiones

### Deployment
- **Netlify Variables:** Configuración de variables de entorno en Netlify para producción
- **Trigger Deploy:** Commit para activar despliegue con credenciales de Supabase
- **Configuración Netlify completa:**
  - Actualizado `netlify.toml` con plugin oficial de Next.js (`@netlify/plugin-nextjs`)
  - Configuración optimizada para Next.js 16 en Netlify
  - Scripts de build actualizados: `build` para producción (Netlify), `build:local` para desarrollo local
  - Removido `dotenv-cli` del comando build de producción (Netlify maneja variables automáticamente)
  - Agregado plugin `@netlify/plugin-nextjs` como dependencia dev
  - Documentación completa de despliegue en Netlify agregada a `CONFIGURACION.md`

### Fixed
- **Configuración Netlify**: Archivo `netlify.toml` recreado sin BOM (Byte Order Mark) para resolver error de parsing
- **Encoding UTF-8**: Archivo creado con encoding puro UTF-8 sin caracteres especiales
- **Plugin Next.js**: Removido plugin manual para evitar conflicto con configuración UI de Netlify

## [1.1.0] - 2025-12-31 ✅ RELEASED

### Added
- **Configuración de Supabase COMPLETA**: Aplicación totalmente funcional con base de datos
- **Sistema de autenticación operativo**: Login/registro funcionando con Supabase Auth
- **Gestión completa de closets**: CRUD de prendas, cajas y outfits
- **Panel administrativo funcional**: Gestión de cajas NFC y usuarios
- **Variables de entorno configuradas**: Credenciales de Supabase y APIs externas
- **Base de datos inicializada**: Schema SQL ejecutado correctamente
- **Modo demo eliminado**: Aplicación funciona completamente sin restricciones
- **Integración APIs externas**:
  - OpenAI para recomendaciones IA inteligentes
  - OpenWeather para datos climáticos
  - Google Vision para análisis automático de prendas

## [1.0.0] - 2025-12-31

### Added
- **Commit inicial**: Primera versión completa de la aplicación Clozen
- Aplicación Next.js con TypeScript para gestión de closets
- Sistema de autenticación con Supabase
- Componentes UI con shadcn/ui
- Integración NFC para escaneo de prendas
- Panel de administración
- Sistema de gestión de closets y prendas
- Configuración completa de ESLint y PostCSS
- Schema de base de datos Supabase

### Features
- Autenticación de usuarios (login/registro)
- Dashboard de usuario
- Gestión de closets virtuales
- Escáner NFC para prendas
- Panel administrativo
- Subida de archivos
- Tema claro/oscuro

### Tech Stack
- Next.js 15
- TypeScript
- Tailwind CSS
- Supabase
- shadcn/ui components
- React Hooks
