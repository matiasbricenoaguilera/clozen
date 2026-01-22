import type { Garment } from '@/types'

export interface PinterestOutfitAnalysis {
  detectedGarments: {
    type: string
    color: string
    confidence: number
  }[]
  dominantColors: string[]
  style: string[]
  labels: string[]
}

export interface SimilarOutfit {
  garments: Garment[]
  similarityScore: number
  reasoning: string
}

/**
 * Convierte RGB a hexadecimal
 * CORREGIDO: Google Vision devuelve valores 0-1, no 0-255
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    // Si el valor es > 1, ya está en escala 0-255, si no, convertir
    const value = n > 1 ? Math.round(n) : Math.round(n * 255)
    const hex = value.toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Mapea tipos de objetos detectados a tipos de prendas del sistema
 * MEJORADO: Más mapeos y más flexible
 */
function mapDetectedTypeToGarmentType(detectedType: string): string | null {
  const typeMap: Record<string, string | null> = {
    // Tipos directos
    'shirt': 'camisa',
    't-shirt': 'camiseta',
    'tshirt': 'camiseta',
    'blouse': 'blusa',
    'pants': 'pantalon',
    'trousers': 'pantalon',
    'jeans': 'pantalon',
    'dress': 'vestido',
    'jacket': 'chaqueta',
    'coat': 'abrigo',
    'sweater': 'suéter',
    'jumper': 'jersey',
    'skirt': 'falda',
    'shorts': 'pantalón corto',
    'shoes': 'zapatos',
    'sneakers': 'zapatillas',
    'boots': 'botas',
    'sandals': 'sandalias',
    'bag': 'bolso',
    'handbag': 'bolso',
    'accessory': 'accesorios',
    // Términos genéricos que Google Vision puede detectar
    'clothing': null, // Genérico, no mapear directamente
    'apparel': null,
    'garment': null,
    'outfit': null
  }

  const lowerType = detectedType.toLowerCase().trim()
  
  // Buscar coincidencia exacta primero
  if (typeMap[lowerType] !== undefined) {
    return typeMap[lowerType]
  }
  
  // Buscar coincidencia parcial
  for (const [key, value] of Object.entries(typeMap)) {
    if (lowerType.includes(key) || key.includes(lowerType)) {
      if (value !== null) {
        return value
      }
    }
  }
  
  return null
}

/**
 * Extrae color de un objeto detectado (simplificado)
 */
function extractColorFromObject(object: any): string {
  // Google Vision no proporciona color directamente del objeto
  // Usaremos los colores dominantes de la imagen completa
  return 'unknown'
}

/**
 * Analiza una imagen de Pinterest usando Google Vision API
 */
export async function analyzePinterestImage(
  imageUrl: string | Buffer
): Promise<PinterestOutfitAnalysis> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_VISION_API_KEY no está configurada')
  }

  // Preparar la imagen para la API
  let imageContent: string
  if (typeof imageUrl === 'string') {
    // Si es una URL, necesitamos descargarla o usar la URL directamente
    // Google Vision puede aceptar URLs si están públicamente accesibles
    imageContent = imageUrl
  } else {
    // Si es un Buffer, convertirlo a base64
    imageContent = Buffer.from(imageUrl).toString('base64')
  }

  // Llamar a Google Vision API
  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [
          {
            image: typeof imageUrl === 'string'
              ? { source: { imageUri: imageUrl } }
              : { content: imageContent },
            features: [
              { type: 'LABEL_DETECTION', maxResults: 20 },
              { type: 'IMAGE_PROPERTIES' },
              { type: 'OBJECT_LOCALIZATION', maxResults: 10 },
              { type: 'TEXT_DETECTION' }
            ]
          }
        ]
      })
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Error en Google Vision API: ${error}`)
  }

  const result = await response.json()
  const annotations = result.responses[0]

  // ✅ LOG: Ver qué devuelve Google Vision
  console.log('📸 [SERVER] Respuesta de Google Vision:', {
    hasObjects: !!annotations.localizedObjectAnnotations,
    objectCount: annotations.localizedObjectAnnotations?.length || 0,
    hasLabels: !!annotations.labelAnnotations,
    labelCount: annotations.labelAnnotations?.length || 0,
    hasColors: !!annotations.imagePropertiesAnnotation?.dominantColors,
    colorCount: annotations.imagePropertiesAnnotation?.dominantColors?.colors?.length || 0
  })

  if (annotations.localizedObjectAnnotations && annotations.localizedObjectAnnotations.length > 0) {
    console.log('🎯 [SERVER] Objetos detectados:')
    annotations.localizedObjectAnnotations.forEach((obj: any, idx: number) => {
      console.log(`   ${idx + 1}. ${obj.name} (${Math.round((obj.score || 0) * 100)}% confianza)`)
    })
  }

  if (annotations.labelAnnotations && annotations.labelAnnotations.length > 0) {
    console.log('🏷️ [SERVER] Labels detectados (top 10):')
    annotations.labelAnnotations.slice(0, 10).forEach((label: any, idx: number) => {
      console.log(`   ${idx + 1}. ${label.description} (${Math.round((label.score || 0) * 100)}% confianza)`)
    })
  }

  // Extraer prendas detectadas
  const detectedGarments: PinterestOutfitAnalysis['detectedGarments'] = []
  
  if (annotations.localizedObjectAnnotations) {
    annotations.localizedObjectAnnotations.forEach((obj: any) => {
      const garmentType = mapDetectedTypeToGarmentType(obj.name)
      if (garmentType) {
        detectedGarments.push({
          type: garmentType,
          color: extractColorFromObject(obj),
          confidence: obj.score || 0
        })
      }
    })
  }

  // También buscar en labels por si no detecta objetos
  // MEJORADO: Buscar siempre en labels, no solo si no hay objetos
  if (annotations.labelAnnotations) {
    const clothingKeywords = [
      'shirt', 'pants', 'dress', 'jacket', 'coat', 'sweater', 'skirt', 'shoes',
      'clothing', 'apparel', 'garment', 'outfit', 'fashion', 'wardrobe',
      't-shirt', 'tshirt', 'blouse', 'trousers', 'jeans', 'shorts', 'sneakers',
      'boots', 'sandals', 'bag', 'handbag', 'accessory',
      // Agregar más términos que Google Vision puede detectar
      'top', 'bottom', 'outerwear', 'underwear', 'lingerie',
      'suit', 'blazer', 'cardigan', 'hoodie', 'pullover',
      'leggings', 'tights', 'stockings', 'socks',
      'heels', 'flats', 'loafers', 'oxfords'
    ]
    
    annotations.labelAnnotations.forEach((label: any) => {
      const labelName = label.description.toLowerCase()
      
      // Buscar keyword directo
      const matchedKeyword = clothingKeywords.find(keyword => labelName.includes(keyword))
      if (matchedKeyword) {
        const garmentType = mapDetectedTypeToGarmentType(matchedKeyword)
        if (garmentType && !detectedGarments.find(g => g.type === garmentType)) {
          detectedGarments.push({
            type: garmentType,
            color: 'unknown',
            confidence: label.score || 0
          })
        }
      }
      
      // Si el label es "Fashion" o similar, intentar inferir del contexto
      // Por ejemplo, si hay "Fashion" y otros labels relacionados, inferir tipo
      if (labelName === 'fashion' || labelName === 'fashion design') {
        // Buscar otros labels que puedan indicar el tipo
        const relatedLabels = annotations.labelAnnotations
          ?.filter((l: any) => l !== label)
          .map((l: any) => l.description.toLowerCase()) || []
        
        // Inferir tipo basado en otros labels
        if (relatedLabels.some((l: string) => l.includes('dress') || l.includes('gown'))) {
          if (!detectedGarments.find(g => g.type === 'vestido')) {
            detectedGarments.push({
              type: 'vestido',
              color: 'unknown',
              confidence: label.score || 0.5
            })
          }
        } else if (relatedLabels.some((l: string) => l.includes('skirt'))) {
          if (!detectedGarments.find(g => g.type === 'falda')) {
            detectedGarments.push({
              type: 'falda',
              color: 'unknown',
              confidence: label.score || 0.5
            })
          }
        } else if (relatedLabels.some((l: string) => l.includes('top') || l.includes('shirt') || l.includes('blouse'))) {
          if (!detectedGarments.find(g => g.type === 'blusa')) {
            detectedGarments.push({
              type: 'blusa',
              color: 'unknown',
              confidence: label.score || 0.5
            })
          }
        } else if (relatedLabels.some((l: string) => l.includes('pants') || l.includes('trousers') || l.includes('jeans'))) {
          if (!detectedGarments.find(g => g.type === 'pantalon')) {
            detectedGarments.push({
              type: 'pantalon',
              color: 'unknown',
              confidence: label.score || 0.5
            })
          }
        }
      }
    })
  }

  // Extraer colores dominantes
  const dominantColors: string[] = []
  if (annotations.imagePropertiesAnnotation?.dominantColors?.colors) {
    annotations.imagePropertiesAnnotation.dominantColors.colors
      .slice(0, 5)
      .forEach((color: any) => {
        if (color.color) {
          const hex = rgbToHex(
            color.color.red || 0,
            color.color.green || 0,
            color.color.blue || 0
          )
          dominantColors.push(hex)
        }
      })
  }

  // Extraer estilo de labels
  const styleKeywords = ['casual', 'formal', 'sporty', 'elegant', 'vintage', 'modern', 'classic', 'trendy']
  const style: string[] = []
  if (annotations.labelAnnotations) {
    annotations.labelAnnotations.forEach((label: any) => {
      const labelName = label.description.toLowerCase()
      const matchedStyle = styleKeywords.find(keyword => labelName.includes(keyword))
      if (matchedStyle && !style.includes(matchedStyle)) {
        style.push(matchedStyle)
      }
    })
  }

  // Extraer todos los labels relevantes
  const labels = annotations.labelAnnotations
    ?.map((label: any) => label.description)
    .slice(0, 10) || []

  return {
    detectedGarments,
    dominantColors,
    style,
    labels
  }
}

/**
 * Convierte nombre de color a hex aproximado (mejora para comparación)
 * MEJORADO: Retorna el color base para comparación
 */
function colorNameToHex(colorName: string): string | null {
  const colorMap: Record<string, string> = {
    // Rojo: usar rojo estándar como base
    'rojo': '#FF0000',
    'red': '#FF0000',
    'azul': '#0000FF',
    'blue': '#0000FF',
    'verde': '#00FF00',
    'green': '#00FF00',
    'amarillo': '#FFFF00',
    'yellow': '#FFFF00',
    'negro': '#000000',
    'black': '#000000',
    'blanco': '#FFFFFF',
    'white': '#FFFFFF',
    'gris': '#808080',
    'gray': '#808080',
    'grey': '#808080',
    'rosa': '#FFC0CB',
    'pink': '#FFC0CB',
    'morado': '#800080',
    'purple': '#800080',
    'naranja': '#FFA500',
    'orange': '#FFA500',
    'marron': '#A52A2A',
    'brown': '#A52A2A',
    'beige': '#F5F5DC',
    'crema': '#FFFDD0',
    'cream': '#FFFDD0'
  }
  
  const lowerColor = colorName.toLowerCase().trim()
  return colorMap[lowerColor] || null
}

/**
 * Compara dos colores hex y retorna similitud 0-100
 * MEJORADO: Más tolerante con variaciones de tono del mismo color base
 */
function compareHexColors(hex1: string, hex2: string): number {
  const hexToRgb = (hex: string) => {
    if (!hex.startsWith('#')) return null
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        }
      : null
  }

  const rgb1 = hexToRgb(hex1)
  const rgb2 = hexToRgb(hex2)

  if (!rgb1 || !rgb2) return 0

  // Calcular distancia euclidiana en espacio RGB
  const distance = Math.sqrt(
    Math.pow(rgb1.r - rgb2.r, 2) +
    Math.pow(rgb1.g - rgb2.g, 2) +
    Math.pow(rgb1.b - rgb2.b, 2)
  )

  // Normalizar a 0-100 (distancia máxima en RGB es ~441)
  // MEJORADO: Ser más tolerante con variaciones de tono
  // Si la distancia es < 100 (colores similares), dar bonus
  const baseSimilarity = Math.max(0, 100 - (distance / 441) * 100)
  
  if (distance < 100) {
    // Colores muy similares (misma familia de color), dar bonus
    return Math.min(100, baseSimilarity + 15)
  }
  
  // Verificar si son del mismo color base (mismo matiz)
  // Por ejemplo: rojo oscuro (#cd222e) vs rojo puro (#FF0000)
  const hue1 = getColorHue(rgb1)
  const hue2 = getColorHue(rgb2)
  const hueDiff = Math.abs(hue1 - hue2)
  
  // Si el matiz es similar (mismo color base) pero diferente saturación/luminosidad
  if (hueDiff < 30 || hueDiff > 330) { // Colores cercanos en el círculo cromático
    // Mismo color base, dar bonus por similitud de matiz
    return Math.min(100, baseSimilarity + 10)
  }
  
  return baseSimilarity
}

/**
 * Obtiene el matiz (hue) de un color RGB en grados (0-360)
 */
function getColorHue(rgb: { r: number; g: number; b: number }): number {
  const r = rgb.r / 255
  const g = rgb.g / 255
  const b = rgb.b / 255
  
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  
  if (delta === 0) return 0 // Gris, sin matiz
  
  let hue = 0
  if (max === r) {
    hue = ((g - b) / delta) % 6
  } else if (max === g) {
    hue = (b - r) / delta + 2
  } else {
    hue = (r - g) / delta + 4
  }
  
  hue = hue * 60
  if (hue < 0) hue += 360
  
  return hue
}

/**
 * Calcula similitud entre un color detectado y un color de prenda
 * MEJORADO: Más tolerante con variaciones de tono del mismo color base
 */
function colorSimilarity(color1: string, color2: string): number {
  if (!color1 || !color2 || color1 === 'unknown' || color2 === 'unknown') {
    return 0
  }

  // Convertir nombres de color a hex si es necesario
  let hex1 = color1.startsWith('#') ? color1 : colorNameToHex(color1) || color1
  let hex2 = color2.startsWith('#') ? color2 : colorNameToHex(color2) || color2

  // Si ambos son nombres de color y coinciden
  if (!color1.startsWith('#') && !color2.startsWith('#')) {
    if (color1.toLowerCase() === color2.toLowerCase()) {
      return 100
    }
    // Verificar si uno contiene al otro
    if (color1.toLowerCase().includes(color2.toLowerCase()) || 
        color2.toLowerCase().includes(color1.toLowerCase())) {
      return 80
    }
  }

  // Si uno es nombre y otro es hex, comparar con variaciones
  if (!color1.startsWith('#') && color2.startsWith('#')) {
    // Comparar el hex detectado con el color nombre convertido
    const baseHex = hex1
    const detectedHex = hex2
    const similarity = compareHexColors(baseHex, detectedHex)
    // Si la similitud es > 50%, considerarlo como el mismo color básico
    // Esto ayuda con casos como "rojo" (#FF0000) vs rojo oscuro detectado (#cd222e)
    if (similarity > 50) {
      return Math.min(100, similarity + 20) // Bonus por ser el mismo color básico
    }
    return similarity
  }

  if (color1.startsWith('#') && !color2.startsWith('#')) {
    // Mismo caso pero invertido
    const baseHex = hex2
    const detectedHex = hex1
    const similarity = compareHexColors(baseHex, detectedHex)
    if (similarity > 50) {
      return Math.min(100, similarity + 20)
    }
    return similarity
  }

  // Comparación normal de hex a hex
  return compareHexColors(hex1, hex2)
}

/**
 * Normaliza texto removiendo acentos para comparación
 */
function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Calcula similitud entre una prenda detectada y una prenda del closet
 * MEJORADO: Normaliza acentos para comparar "pantalon" con "pantalón"
 */
function calculateGarmentSimilarity(
  detected: { type: string; color: string },
  garment: Garment,
  dominantColors: string[]
): number {
  let score = 0

  // Similitud de tipo (50 puntos) - MÁS FLEXIBLE CON NORMALIZACIÓN DE ACENTOS
  const garmentType = garment.type.toLowerCase().trim()
  const detectedType = detected.type.toLowerCase().trim()
  
  // Normalizar acentos para comparación (pantalon = pantalón)
  const normalizedGarmentType = normalizeText(garmentType)
  const normalizedDetectedType = normalizeText(detectedType)
  
  if (normalizedGarmentType === normalizedDetectedType) {
    score += 50
  } else if (normalizedGarmentType.includes(normalizedDetectedType) || normalizedDetectedType.includes(normalizedGarmentType)) {
    score += 30
  } else {
    // Verificar si hay palabras comunes
    const garmentWords = normalizedGarmentType.split(/[\s-]+/)
    const detectedWords = normalizedDetectedType.split(/[\s-]+/)
    const commonWords = garmentWords.filter(w => detectedWords.includes(w))
    if (commonWords.length > 0) {
      score += 20
    }
  }

  // Similitud de color (30 puntos) - MEJORADO
  if (garment.color && dominantColors.length > 0) {
    const colorMatches = dominantColors.map(color =>
      colorSimilarity(garment.color || '', color)
    )
    const maxColorMatch = Math.max(...colorMatches)
    score += (maxColorMatch / 100) * 30
    
    // Bonus si el color coincide exactamente
    if (maxColorMatch > 90) {
      score += 10
    }
  } else if (garment.color) {
    // Si no hay colores dominantes pero la prenda tiene color, dar puntos base
    score += 5
  }

  // Bonus por temporada si coincide (10 puntos)
  // Se puede mejorar más adelante

  return score
}

/**
 * Encuentra outfits similares en el closet del usuario
 * MEJORADO: Umbral más bajo y mejor búsqueda
 */
export function findSimilarOutfits(
  analysis: PinterestOutfitAnalysis,
  userGarments: Garment[]
): SimilarOutfit[] {
  const matches: SimilarOutfit[] = []
  
  // DEBUG: Log para ver qué se está analizando
  console.log('🔍 Análisis de imagen:', {
    detectedGarments: analysis.detectedGarments,
    dominantColors: analysis.dominantColors,
    totalGarments: userGarments.length,
    garmentTypes: [...new Set(userGarments.map(g => g.type))]
  })

  // Si no hay prendas detectadas, usar colores dominantes
  if (analysis.detectedGarments.length === 0 && analysis.dominantColors.length > 0) {
    // Buscar prendas por color - UMBRAL MÁS BAJO
    const colorMatches = userGarments
      .map(garment => {
        if (!garment.color) return null
        const similarity = analysis.dominantColors
          .map(color => colorSimilarity(garment.color || '', color))
          .reduce((max, sim) => Math.max(max, sim), 0)
        
        return similarity > 15 ? { garment, similarity } : null // Bajado de 20 a 15
      })
      .filter((match): match is { garment: Garment; similarity: number } => match !== null)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5)

    if (colorMatches.length > 0) {
      matches.push({
        garments: colorMatches.map(m => m.garment),
        similarityScore: colorMatches[0].similarity,
        reasoning: `Prendas con colores similares a la imagen (${analysis.dominantColors[0]})`
      })
    }
  }

  // Buscar prendas por tipo detectado - UMBRAL MÁS BAJO
  for (const detected of analysis.detectedGarments) {
    console.log(`🔍 [SERVER] Buscando prendas para tipo: "${detected.type}"`)
    
    const similarGarments = userGarments
      .map(garment => {
        const similarity = calculateGarmentSimilarity(
          detected,
          garment,
          analysis.dominantColors
        )
        // Log detallado para debugging
        if (similarity > 5) { // Solo loggear si hay algo de similitud
          console.log(`   [SERVER] "${garment.name}" (${garment.type}, ${garment.color || 'sin color'}): ${Math.round(similarity)}%`)
        }
        return { garment, similarity }
      })
      .filter(match => match.similarity > 15) // Bajado de 30 a 15
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5) // Aumentado de 3 a 5
      .map(match => match.garment)

    if (similarGarments.length > 0) {
      const avgSimilarity = similarGarments.reduce((sum, g) => {
        return sum + calculateGarmentSimilarity(detected, g, analysis.dominantColors)
      }, 0) / similarGarments.length

      matches.push({
        garments: similarGarments,
        similarityScore: avgSimilarity,
        reasoning: `Similar a ${detected.type} detectado en la imagen (${Math.round(detected.confidence * 100)}% confianza)`
      })
    } else {
      // DEBUG: Si no encuentra matches, mostrar qué se buscó
      console.log(`⚠️ [SERVER] No se encontraron prendas para tipo: ${detected.type}`)
      console.log(`   [SERVER] Tipos disponibles en closet:`, [...new Set(userGarments.map(g => g.type))])
      
      // Mostrar el score más alto que se obtuvo
      const allScores = userGarments.map(garment => ({
        name: garment.name,
        type: garment.type,
        color: garment.color,
        score: calculateGarmentSimilarity(detected, garment, analysis.dominantColors)
      })).sort((a, b) => b.score - a.score).slice(0, 3)
      
      console.log(`   [SERVER] Top 3 scores obtenidos:`)
      allScores.forEach((s, idx) => {
        console.log(`      ${idx + 1}. ${s.name} (${s.type}, ${s.color || 'sin color'}): ${Math.round(s.score)}%`)
      })
    }
  }

  // Si aún no hay matches, buscar por cualquier tipo similar (más permisivo)
  if (matches.length === 0 && analysis.detectedGarments.length > 0) {
    const allSimilarGarments = userGarments
      .map(garment => ({
        garment,
        similarity: analysis.detectedGarments
          .map(detected => calculateGarmentSimilarity(detected, garment, analysis.dominantColors))
          .reduce((max, sim) => Math.max(max, sim), 0)
      }))
      .filter(match => match.similarity > 10) // Umbral muy bajo para encontrar algo
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5)
      .map(match => match.garment)

    if (allSimilarGarments.length > 0) {
      matches.push({
        garments: allSimilarGarments,
        similarityScore: 25, // Score base
        reasoning: `Prendas similares encontradas (búsqueda ampliada)`
      })
    }
  }

  // Crear combinaciones de outfits si hay múltiples prendas detectadas
  if (analysis.detectedGarments.length >= 2) {
    const topTypes = analysis.detectedGarments
      .slice(0, 2)
      .map(d => d.type)

    const outfitGarments: Garment[] = []
    for (const type of topTypes) {
      const bestMatch = userGarments
        .map(garment => ({
          garment,
          similarity: calculateGarmentSimilarity(
            { type, color: 'unknown' },
            garment,
            analysis.dominantColors
          )
        }))
        .filter(match => match.similarity > 20) // Bajado de 40 a 20
        .sort((a, b) => b.similarity - a.similarity)[0]

      if (bestMatch) {
        outfitGarments.push(bestMatch.garment)
      }
    }

    if (outfitGarments.length >= 2) {
      const avgScore = outfitGarments.reduce((sum, g) => {
        const detected = analysis.detectedGarments.find(d => 
          mapDetectedTypeToGarmentType(d.type) === g.type.toLowerCase()
        )
        return sum + (detected 
          ? calculateGarmentSimilarity(detected, g, analysis.dominantColors)
          : 50)
      }, 0) / outfitGarments.length

      matches.push({
        garments: outfitGarments,
        similarityScore: avgScore,
        reasoning: `Outfit completo similar: ${outfitGarments.map(g => g.name).join(' + ')}`
      })
    }
  }

  // Ordenar por score de similitud
  const sortedMatches = matches.sort((a, b) => b.similarityScore - a.similarityScore).slice(0, 5)
  
  // DEBUG: Log de resultados
  console.log('✅ Outfits encontrados:', sortedMatches.length)
  sortedMatches.forEach((match, idx) => {
    console.log(`   ${idx + 1}. Score: ${Math.round(match.similarityScore)}% - ${match.reasoning}`)
    console.log(`      Prendas: ${match.garments.map(g => `${g.name} (${g.type})`).join(', ')}`)
  })
  
  return sortedMatches
}
