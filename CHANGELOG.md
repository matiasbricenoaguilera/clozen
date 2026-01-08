# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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
