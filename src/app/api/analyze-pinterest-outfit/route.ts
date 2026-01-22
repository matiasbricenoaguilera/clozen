import { NextRequest, NextResponse } from 'next/server'
import { analyzePinterestImage, findSimilarOutfits } from '@/utils/pinterest-outfit-matcher'
import { supabase } from '@/lib/supabase'
import type { SimilarOutfit, PinterestOutfitAnalysis } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const imageFile = formData.get('image') as File | null
    const imageUrl = formData.get('imageUrl') as string | null
    const userId = formData.get('userId') as string | null

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Usuario no autenticado' },
        { status: 401 }
      )
    }

    if (!imageFile && !imageUrl) {
      return NextResponse.json(
        { success: false, error: 'Se requiere una imagen o URL de imagen' },
        { status: 400 }
      )
    }

    // Convertir File a Buffer si es necesario
    let imageData: string | Buffer
    if (imageFile) {
      const arrayBuffer = await imageFile.arrayBuffer()
      imageData = Buffer.from(arrayBuffer)
    } else if (imageUrl) {
      imageData = imageUrl
    } else {
      return NextResponse.json(
        { success: false, error: 'Error al procesar la imagen' },
        { status: 400 }
      )
    }

    // 1. Analizar imagen con Google Vision
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

    // 2. Obtener prendas del usuario
    console.log(`👤 [SERVER] Buscando prendas para userId: ${userId}`)
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

    // Verificar también sin filtro de status
    if (!garments || garments.length === 0) {
      console.log('⚠️ [SERVER] No se encontraron prendas con status="available"')
      const { data: allGarments } = await supabase
        .from('garments')
        .select('*')
        .eq('user_id', userId)
      console.log(`   [SERVER] Total prendas (cualquier status): ${allGarments?.length || 0}`)
      if (allGarments && allGarments.length > 0) {
        console.log(`   [SERVER] Status de las prendas:`, [...new Set(allGarments.map((g: any) => g.status))])
      }
    }

    console.log(`👕 [SERVER] Prendas disponibles en closet: ${garments?.length || 0}`)
    if (garments && garments.length > 0) {
      const types = [...new Set(garments.map((g: any) => g.type))]
      console.log(`   [SERVER] Tipos de prendas: ${types.join(', ')}`)
    }

    // 3. Encontrar outfits similares
    const similarOutfits = findSimilarOutfits(analysis, garments || [])
    console.log(`✅ [SERVER] Outfits similares encontrados: ${similarOutfits.length}`)

    return NextResponse.json({
      success: true,
      analysis,
      similarOutfits,
      // ✅ Agregar información de debug
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
