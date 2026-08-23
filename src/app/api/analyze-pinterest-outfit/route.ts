import { NextRequest, NextResponse } from 'next/server'
import { analyzePinterestImage, findSimilarOutfits } from '@/utils/pinterest-outfit-matcher'
import { authenticateRequest, isAuthError } from '@/lib/supabase-server'
import type { PinterestOutfitAnalysis } from '@/types'

// Límites de la petición (defensa contra abuso de la cuota de Google Vision)
const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10 MB, igual que el validador del cliente
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// Rate limit best-effort: es por instancia de servidor, así que en Netlify
// no es una garantía global. Frena el abuso trivial; para un límite real
// hace falta un almacén compartido (Upstash, Supabase, etc.).
const RATE_LIMIT_MAX = 10          // peticiones
const RATE_LIMIT_WINDOW_MS = 60_000 // por minuto y usuario
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

/**
 * Valida que la URL de imagen sea pública y por HTTPS.
 * Google Vision es quien descarga la URL, pero se filtran igualmente los
 * destinos internos para no usar el endpoint como sonda de red.
 */
function isSafeImageUrl(rawUrl: string): boolean {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return false
  }

  if (url.protocol !== 'https:') return false

  const host = url.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '::1' ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^0\./.test(host)
  ) {
    return false
  }

  return true
}

export async function POST(request: NextRequest) {
  try {
    // ✅ 1. AUTENTICACIÓN: el userId ya NO se acepta desde el formData.
    // Se deriva del token de sesión, así que nadie puede pedir el closet ajeno.
    const auth = await authenticateRequest(request)
    if (isAuthError(auth)) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      )
    }
    const { supabase, user } = auth
    const userId = user.id

    // ✅ 2. RATE LIMIT por usuario autenticado
    if (isRateLimited(userId)) {
      return NextResponse.json(
        { success: false, error: 'Demasiadas peticiones. Espera un minuto e inténtalo de nuevo.' },
        { status: 429 }
      )
    }

    const formData = await request.formData()
    const imageFile = formData.get('image') as File | null
    const imageUrl = formData.get('imageUrl') as string | null

    if (!imageFile && !imageUrl) {
      return NextResponse.json(
        { success: false, error: 'Se requiere una imagen o URL de imagen' },
        { status: 400 }
      )
    }

    // ✅ 3. VALIDACIÓN DE ENTRADA (tamaño, tipo y destino de la URL)
    let imageData: string | Buffer
    if (imageFile) {
      if (imageFile.size > MAX_IMAGE_BYTES) {
        return NextResponse.json(
          { success: false, error: 'La imagen no puede superar 10MB' },
          { status: 413 }
        )
      }

      if (!ALLOWED_MIME_TYPES.includes(imageFile.type)) {
        return NextResponse.json(
          { success: false, error: 'Formato no permitido. Usa JPEG, PNG o WebP.' },
          { status: 415 }
        )
      }

      const arrayBuffer = await imageFile.arrayBuffer()
      imageData = Buffer.from(arrayBuffer)
    } else {
      if (!isSafeImageUrl(imageUrl!)) {
        return NextResponse.json(
          { success: false, error: 'URL de imagen no válida. Debe ser una URL pública HTTPS.' },
          { status: 400 }
        )
      }
      imageData = imageUrl!
    }

    // 4. Analizar imagen con Google Vision
    let analysis: PinterestOutfitAnalysis
    try {
      console.log('🔍 [SERVER] Iniciando análisis de imagen con Google Vision...')
      analysis = await analyzePinterestImage(imageData)
      console.log('✅ [SERVER] Análisis completado:', {
        detectedGarments: analysis.detectedGarments.length,
        dominantColors: analysis.dominantColors.length,
        styles: analysis.style.length
      })
      if (analysis.detectedGarments.length > 0) {
        console.log('   [SERVER] Prendas detectadas:', analysis.detectedGarments.map(g => g.type))
      }
    } catch (error: any) {
      console.error('❌ [SERVER] Error analizando imagen:', error)
      return NextResponse.json(
        {
          success: false,
          error: `Error al analizar imagen: ${error.message || 'Error desconocido'}`
        },
        { status: 500 }
      )
    }

    // 5. Obtener prendas del usuario.
    // El cliente lleva el token del usuario, así que RLS resuelve auth.uid()
    // correctamente (antes se usaba el cliente anónimo sin sesión y las
    // políticas devolvían 0 filas siempre).
    const { data: garments, error: garmentsError } = await supabase
      .from('garments')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'available')

    if (garmentsError) {
      console.error('❌ [SERVER] Error obteniendo prendas:', garmentsError)
      return NextResponse.json(
        { success: false, error: 'Error al obtener prendas del usuario' },
        { status: 500 }
      )
    }

    console.log(`👕 [SERVER] Prendas disponibles en closet: ${garments?.length || 0}`)

    // 6. Encontrar outfits similares
    const similarOutfits = findSimilarOutfits(analysis, garments || [])
    console.log(`✅ [SERVER] Outfits similares encontrados: ${similarOutfits.length}`)

    return NextResponse.json({
      success: true,
      analysis,
      similarOutfits,
      debug: {
        totalGarments: garments?.length || 0,
        garmentTypes: garments ? [...new Set(garments.map((g: any) => g.type))] : [],
        detectedTypes: analysis.detectedGarments.map((g: any) => g.type)
      }
    })
  } catch (error: any) {
    console.error('Error en analyze-pinterest-outfit:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error al procesar la solicitud'
      },
      { status: 500 }
    )
  }
}
