# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos

```bash
npm run dev            # Dev server (carga .env.local vía dotenv-cli)
npm run build          # Build de producción SIN cargar .env.local (es el que corre Netlify)
npm run build:local    # Build reproduciendo el entorno local (.env.local)
npm run build:analyze  # Build con @next/bundle-analyzer (ANALYZE=true, forzado a webpack)
npm run lint           # ESLint (flat config, sin argumentos)
npm start              # Servidor de producción
```

Node 20.9.0 (`.nvmrc` y `netlify.toml`). No hay suite de tests ni runner configurado: la verificación es `npm run lint` + `npm run build:local`.

`npm run dev`/`build` **no** cargan variables si no existe `.env.local`; sin `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` la app arranca igual en "modo demo" (ver abajo).

## Arquitectura

Next.js 16 (App Router) + React 19 + TypeScript + TailwindCSS + Supabase. Layout de carpetas poco habitual: **las rutas viven en `src/app/`, pero `components/`, `hooks/`, `lib/`, `utils/` y `types/` están en la raíz**. El alias `@/*` apunta a `./*` (raíz del repo), no a `src/`.

### Todo es cliente, salvo una API route

Prácticamente todas las páginas son `'use client'` y hablan **directo con Supabase desde el navegador** usando la anon key. No hay capa de servicios ni server actions: las queries (`supabase.from('garments')...`) están inline en las páginas. La seguridad la impone **RLS en Postgres**, no el código de la app.

La única ruta de servidor es `src/app/api/analyze-pinterest-outfit/route.ts`, que existe porque `GOOGLE_VISION_API_KEY` no puede exponerse al cliente. Si necesitas otro secreto server-side, ese es el patrón a seguir.

### Modo demo (`lib/supabase.ts`)

Si faltan las credenciales, `lib/supabase.ts` exporta un **cliente dummy** que simula la API de Supabase y devuelve `{ data: null, error: 'Supabase no configurado' }`. El flag `isSupabaseConfigured` se usa en las páginas para mostrar `DemoBanner`/`SupabaseWarning` y saltar fetches. Al tocar código que consulta Supabase, mantén esa rama: si añades un método nuevo del cliente, hay que agregarlo también al dummy o el modo demo revienta con `is not a function`.

El tipo `Database` de `lib/supabase.ts` está **escrito a mano** (no generado por la CLI de Supabase). Cualquier columna nueva en Postgres debe replicarse ahí en `Row`/`Insert`/`Update`.

### Auth y roles (`hooks/useAuth.ts`)

Supabase Auth para la sesión, pero el **rol vive en `public.users.role`** (`'user' | 'admin'`), no en el JWT. `useAuth` mantiene un caché global de perfiles a nivel de módulo (5 min), deduplica llamadas concurrentes por `userId`, reintenta con backoff y aplica timeout de 10 s; ignora `INITIAL_SESSION` duplicados vía `sessionProcessedRef`. Es frágil a cambios ingenuos — el objetivo es evitar tormentas de requests a `users` al montar varias páginas.

`ProtectedRoute` protege **solo** los layouts `/admin` (requiere `role === 'admin'`) y `/dashboard`. Rutas como `/closet` y `/closet/add` **no** están envueltas: comprueban `userProfile` por su cuenta. Si añades una ruta protegida, envuélvela explícitamente.

### Modelo de dominio

Tablas: `users`, `boxes`, `garments`, `outfits`, `usage_history`, `nfc_tags`.

- `garments.status` (`'available' | 'in_use'`) es el eje del flujo **Retirar / Ingresar**: retirar pone `in_use` y actualiza `last_used`/`usage_count`; ingresar vuelve a `available` y asigna `box_id`. `/admin/in-use` lista las prendas fuera de caja y permite forzar el retorno.
- `boxes.max_capacity` (default 15) se valida en el cliente contando prendas con `box_id` — no hay constraint en la BD.
- Una prenda se identifica por **dos vías independientes**: `nfc_tag_id` y `barcode_id`. Casi todo flujo de escaneo soporta ambas más entrada manual.
- `nfc_tags` es una tabla de auditoría/registro paralela a `garments.nfc_tag_id`/`boxes.nfc_tag_id`; `utils/nfc.ts` mantiene ambas en sincronía (`updateEntityNFCTag`, `removeEntityNFCTag`).

### NFC (`hooks/useNFC.ts` + `utils/nfc.ts` + `components/nfc/nfc-scanner.tsx`)

Web NFC (`NDEFReader`): **solo Chrome en Android sobre HTTPS o localhost**. `useNFC` es la parte delicada del repo — construye el payload de NDEF Text Record byte a byte según RTD del NFC Forum, normaliza el id del tag y prioriza el contenido UTF-8 escrito sobre el serial del tag (porque hay tags NTAG con seriales duplicados; ver `FAQ_NFC.md`). El historial de commits está lleno de correcciones a esta lógica: no la reescribas sin poder probar en un Android real.

`utils/nfc.ts` es la capa de persistencia (buscar entidad por tag, registrar, liberar). `NFCScanner` es el componente de UI, con modo `read`/`write` y `continuous` para escaneo en lote.

### Base de datos y migraciones

**No hay herramienta de migraciones.** Los `.sql` de la raíz se aplican a mano en el SQL Editor de Supabase:

- `SUPABASE_SCHEMA_COMPLETE.sql` — esquema canónico e idempotente (tablas + RLS + trigger `handle_new_user` + índices).
- `create-indexes.sql`, `ADD_MAX_CAPACITY_TO_BOXES.sql`, `update-boxes-policies.sql`, `FIX_*.sql`, `SET_ADMIN_ROLE.sql` — parches incrementales posteriores.

Trampa recurrente con RLS: una política sobre `users` que consulta `users` provoca recursión infinita (error 500). La solución adoptada es la función `public.is_admin()` con `SECURITY DEFINER` (`FIX_RLS_RECURSION.sql`); úsala en políticas nuevas que dependan del rol. Las cajas son legibles por todos (`Anyone can view boxes`) y solo escribibles por admins — un error 500 o listas vacías inesperadas suele ser RLS, no el código.

Admin se otorga con SQL: `UPDATE public.users SET role='admin' WHERE email='...'`. `scripts/make-admin.js` solo imprime esas instrucciones.

### Imágenes

Se suben al bucket **`garments`** de Supabase Storage bajo `garments/{userId}/{timestamp}-{random}.jpg`, comprimidas a JPEG en el cliente antes del upload (`src/app/closet/add/page.tsx`, `components/garments/edit-garment-modal.tsx`). `next.config.ts` solo permite `remotePatterns` de `**.supabase.co/storage/v1/object/public/**`.

### Recomendaciones

`utils/outfit-recommendations.ts` es un **scoring heurístico local** (días sin usar, temporada vs. temperatura de OpenWeatherMap, historial), sin IA. `utils/pinterest-outfit-matcher.ts` usa Google Vision (labels + colores dominantes + object localization) y hace matching por tipo/color contra el closet. El README menciona OpenAI GPT-4o-mini y `OPENAI_API_KEY`, pero **no existe ninguna integración de OpenAI en el código**.

## Variables de entorno

Las únicas realmente usadas:

```
NEXT_PUBLIC_SUPABASE_URL        # obligatoria (debe empezar por https://, si no el cliente cae a dummy)
NEXT_PUBLIC_SUPABASE_ANON_KEY   # obligatoria
GOOGLE_VISION_API_KEY           # server-only, para /api/analyze-pinterest-outfit
NEXT_PUBLIC_OPENWEATHER_API_KEY # clima; sin ella getWeatherByCity devuelve null
```

Deploy en Netlify con `@netlify/plugin-nextjs`; las variables se configuran en el dashboard. No usar `output: 'standalone'` — lo gestiona el plugin.

## Convenciones

- **Toda la UI, los comentarios, los logs y los mensajes de commit están en español.** Prefijos de commit `feat:`/`fix:`/`docs:` y descripción en español.
- `CHANGELOG.md` se mantiene al día (formato Keep a Changelog, sección `[Unreleased]`) con entradas detalladas por feature/fix.
- `components/ui/` sigue el estilo shadcn/ui (Radix + `cva` + helper `cn()` de `lib/utils.ts`). Temas vía variables CSS HSL en `src/app/globals.css` + `next-themes`.
- Los componentes pesados se cargan con `dynamic(..., { ssr: false })`: scanners NFC/código de barras, `WeatherCard`, modales de prendas. Los scanners **deben** ir con `ssr: false` (dependen de `window`/`navigator`).
- Los scanners de cámara (`html5-qrcode`) tienen lógica frágil de liberación de recursos (delays, limpieza de `<video>` del DOM, parada de todos los `MediaStream`). Si tocas `barcode-scanner.tsx`, verifica que la cámara se libere y que el input manual siga editable.
- Evita disparar `alert`/`confirm` nativos en flujos automatizados: bloquean el hilo y los escáneres.

## Nota

`Trace-*.json` (~130 MB en total) están versionados en git por error. No agregues más volcados de trazas al repo.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
