import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { authenticateRequest, isAuthError } from '@/lib/supabase-server'
import { GARMENT_TYPES, SEASONS, STYLES } from '@/lib/garment-taxonomy'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

// Rate limit best-effort por instancia (ver nota en analyze-pinterest-outfit)
const RATE_LIMIT_MAX = 60           // prendas por minuto y usuario: catalogar es intensivo
const RATE_LIMIT_WINDOW_MS = 60_000
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const bucket = rateLimitBuckets.get(userId)
  if (!bucket || now > bucket.resetAt) {
    rateLimitBuckets.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }
  bucket.count += 1
  return bucket.count > RATE_LIMIT_MAX
}

// El esquema obliga al modelo a elegir de la taxonomía del proyecto:
// no puede inventarse un tipo o un estilo que el formulario no acepte.
const SuggestionSchema = z.object({
  name: z
    .string()
    .describe(
      'Nombre corto y descriptivo en español, 2 a 5 palabras, que ayude a reconocer la prenda ' +
      'entre otras parecidas. Incluye color y un rasgo distintivo (estampado, corte, material). ' +
      'Ejemplos: "Camisa celeste a rayas", "Jersey gris de cuello alto". Sin comillas ni punto final.'
    ),
  type: z.enum(GARMENT_TYPES).describe('Tipo de prenda'),
  color: z.string().describe('Color dominante en español, una o dos palabras (ej: "azul marino")'),
  season: z
    .enum(SEASONS.map(s => s.value) as [string, ...string[]])
    .describe('Temporada más adecuada según tejido y grosor; "all" si sirve todo el año'),
  style: z
    .array(z.enum(STYLES))
    .min(1)
    .max(3)
    .describe('Entre 1 y 3 estilos que encajen con la prenda')
})

const SYSTEM_PROMPT =
  'Eres un asistente que cataloga prendas de ropa a partir de fotografías para un armario digital. ' +
  'Observa la prenda principal de la imagen e identifícala. Ignora el fondo, perchas, maniquíes o ' +
  'personas. Si la foto muestra una etiqueta con la marca visible y legible, puedes incluirla en el ' +
  'nombre. Responde siempre en español.'

export async function POST(request: NextRequest) {
  try {
    // Mismo control de acceso que el resto de endpoints: el usuario sale del token
    const auth = await authenticateRequest(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    if (isRateLimited(auth.user.id)) {
      return NextResponse.json(
        { success: false, error: 'Demasiadas imágenes seguidas. Espera un momento.' },
        { status: 429 }
      )
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'La sugerencia automática no está configurada en el servidor.' },
        { status: 503 }
      )
    }

    const formData = await request.formData()
    const imageFile = formData.get('image') as File | null

    if (!imageFile) {
      return NextResponse.json(
        { success: false, error: 'Se requiere una imagen' },
        { status: 400 }
      )
    }
    if (imageFile.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { success: false, error: 'La imagen no puede superar 10MB' },
        { status: 413 }
      )
    }
    if (!ALLOWED_MIME_TYPES.includes(imageFile.type as typeof ALLOWED_MIME_TYPES[number])) {
      return NextResponse.json(
        { success: false, error: 'Formato no permitido. Usa JPEG, PNG o WebP.' },
        { status: 415 }
      )
    }

    const base64 = Buffer.from(await imageFile.arrayBuffer()).toString('base64')

    const client = new Anthropic()

    const response = await client.messages.parse({
      model: 'claude-opus-5',
      max_tokens: 2048,
      // Clasificar una prenda es una tarea sencilla: poco esfuerzo, respuesta rápida
      output_config: {
        effort: 'low',
        format: zodOutputFormat(SuggestionSchema)
      },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: imageFile.type as 'image/jpeg' | 'image/png' | 'image/webp',
                data: base64
              }
            },
            { type: 'text', text: 'Cataloga esta prenda.' }
          ]
        }
      ]
    })

    const suggestion = response.parsed_output
    if (!suggestion) {
      return NextResponse.json(
        { success: false, error: 'No se pudo interpretar la imagen. Rellena los datos a mano.' },
        { status: 422 }
      )
    }

    return NextResponse.json({ success: true, suggestion })
  } catch (error: unknown) {
    // Errores tipados del SDK: distinguimos lo recuperable de lo que no lo es
    if (error instanceof Anthropic.AuthenticationError) {
      console.error('[analyze-garment] Credencial de Anthropic inválida')
      return NextResponse.json(
        { success: false, error: 'La sugerencia automática no está bien configurada.' },
        { status: 503 }
      )
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { success: false, error: 'Servicio saturado. Inténtalo en unos segundos.' },
        { status: 429 }
      )
    }
    if (error instanceof Anthropic.APIError) {
      console.error('[analyze-garment] Error de API:', error.status, error.message)
      return NextResponse.json(
        { success: false, error: 'No se pudo analizar la imagen.' },
        { status: 502 }
      )
    }

    console.error('[analyze-garment] Error inesperado:', error)
    return NextResponse.json(
      { success: false, error: 'No se pudo analizar la imagen.' },
      { status: 500 }
    )
  }
}
