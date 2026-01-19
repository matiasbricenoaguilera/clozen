import { Garment, WeatherData } from '@/types'
import { getClothingRecommendations, getSeasonFromTemperature } from './weather'
import { supabase } from '@/lib/supabase'

export interface OutfitSuggestion {
  garments: Garment[]
  score: number
  reasoning: string
  weatherMatch: boolean
}

interface UsageHistoryItem {
  garment_id: string
  usage_type: 'outfit' | 'manual' | 'recommendation'
  weather_at_use: { temperature?: number } | null
  created_at: string
}

/**
 * Calcula los días desde el último uso de una prenda
 */
function getDaysSinceLastUse(lastUsed: string | null | undefined): number {
  if (!lastUsed) return 999 // Nunca usada = máximo bonus
  
  const lastUsedDate = new Date(lastUsed)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - lastUsedDate.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  return diffDays
}

/**
 * Calcula el score de recomendación para una prenda basado en múltiples factores
 */
function calculateGarmentScore(
  garment: Garment,
  weather: WeatherData | null,
  usageHistory: UsageHistoryItem[],
  season: string
): { score: number; reasons: string[] } {
  let score = 50 // Score base
  const reasons: string[] = []

  // 1. ✅ DÍAS SIN USAR: Bonus por tiempo sin usar
  const daysSinceLastUse = getDaysSinceLastUse(garment.last_used)
  if (daysSinceLastUse >= 60) {
    score += 20
    reasons.push(`No usada en ${daysSinceLastUse} días`)
  } else if (daysSinceLastUse >= 30) {
    score += 15
    reasons.push(`No usada en ${daysSinceLastUse} días`)
  } else if (daysSinceLastUse > 0) {
    score += 10 - Math.min(10, Math.floor(daysSinceLastUse / 3))
    reasons.push(`Usada hace ${daysSinceLastUse} día${daysSinceLastUse > 1 ? 's' : ''}`)
  } else {
    // Nunca usada = máximo bonus
    score += 25
    reasons.push('Nunca usada - ¡Dale una oportunidad!')
  }

  // 2. ✅ USAGE_COUNT: Bonus por poco uso
  const usageCount = garment.usage_count || 0
  if (usageCount === 0) {
    score += 20
    reasons.push('Nueva prenda')
  } else if (usageCount < 3) {
    score += 10
    reasons.push(`Solo ${usageCount} uso${usageCount > 1 ? 's' : ''}`)
  } else if (usageCount < 5) {
    score += 5
  }

  // 3. ✅ CLIMA HISTÓRICO vs CLIMA ACTUAL: Analizar usage_history
  if (weather && usageHistory.length > 0) {
    const garmentHistory = usageHistory.filter(h => h.garment_id === garment.id)
    
    if (garmentHistory.length > 0) {
      // Contar cuántas veces se usó en clima similar
      const similarWeatherUses = garmentHistory.filter(h => {
        if (!h.weather_at_use?.temperature) return false
        const tempDiff = Math.abs(h.weather_at_use.temperature - weather.temperature)
        return tempDiff < 5 // Diferencia de ±5°C
      }).length

      if (similarWeatherUses > 0) {
        score += 15
        reasons.push(`Ya usada ${similarWeatherUses} vez${similarWeatherUses > 1 ? 'es' : ''} en clima similar`)
      }

      // Analizar frecuencia de uso reciente (últimos 30 días)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const recentUses = garmentHistory.filter(h => 
        new Date(h.created_at) > thirtyDaysAgo
      ).length

      if (recentUses === 0) {
        score += 10
        reasons.push('No usada en el último mes')
      } else if (recentUses < 2) {
        score += 5
      }
      // Si recentUses >= 2, no dar bonus (ya se usó mucho)

      // Tipo de uso: recomendaciones tienen más valor
      const recommendedUses = garmentHistory.filter(h => 
        h.usage_type === 'recommendation'
      ).length
      
      if (recommendedUses > 0) {
        score += 5
        reasons.push('Previamente recomendada')
      }
    }
  }

  // 4. ✅ TEMPORADA: Bonus por coincidir con temporada
  if (garment.season === season || garment.season === 'all') {
    score += 10
    reasons.push('Temporada adecuada')
  }

  // 5. ✅ CLIMA ACTUAL: Match con recomendaciones de clima
  if (weather) {
    const clothingRecs = getClothingRecommendations(weather)
    const garmentType = garment.type.toLowerCase()
    if (clothingRecs.types.includes(garmentType)) {
      score += 15
      reasons.push('Ideal para el clima actual')
    }
  }

  return { score, reasons }
}

/**
 * Recomienda outfits basado en clima, estadísticas de uso y prendas disponibles
 */
export async function recommendOutfits(
  garments: Garment[],
  weather: WeatherData | null,
  userId?: string
): Promise<OutfitSuggestion[]> {
  if (garments.length === 0) {
    return []
  }

  // Filtrar prendas disponibles
  const availableGarments = garments.filter(g => g.status === 'available')

  if (availableGarments.length === 0) {
    return []
  }

  // ✅ CONSULTAR USAGE_HISTORY para análisis detallado
  let usageHistory: UsageHistoryItem[] = []
  if (userId) {
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const { data, error } = await supabase
        .from('usage_history')
        .select('garment_id, usage_type, weather_at_use, created_at')
        .eq('user_id', userId)
        .gte('created_at', thirtyDaysAgo.toISOString())

      if (!error && data) {
        usageHistory = data as UsageHistoryItem[]
      }
    } catch (error) {
      console.warn('Error fetching usage history for recommendations:', error)
      // Continuar sin historial si falla
    }
  }

  // Obtener recomendaciones de tipos de ropa basadas en clima
  const season = weather ? getSeasonFromTemperature(weather.temperature) : 'all'

  // Clasificar prendas por tipo
  const garmentsByType = new Map<string, Garment[]>()
  availableGarments.forEach(garment => {
    const type = garment.type.toLowerCase()
    if (!garmentsByType.has(type)) {
      garmentsByType.set(type, [])
    }
    garmentsByType.get(type)!.push(garment)
  })

  // Generar combinaciones de outfits
  const suggestions: OutfitSuggestion[] = []

  // Outfit básico: camisa + pantalón
  const shirts = garmentsByType.get('camisa') || []
  const pants = garmentsByType.get('pantalon') || []
  
  if (shirts.length > 0 && pants.length > 0) {
    // ✅ ORDENAR por score calculado (no solo usage_count)
    const shirtsWithScores = shirts.map(shirt => ({
      garment: shirt,
      ...calculateGarmentScore(shirt, weather, usageHistory, season)
    }))
    const pantsWithScores = pants.map(pant => ({
      garment: pant,
      ...calculateGarmentScore(pant, weather, usageHistory, season)
    }))

    // Ordenar por score descendente (mayor score = mejor recomendación)
    shirtsWithScores.sort((a, b) => b.score - a.score)
    pantsWithScores.sort((a, b) => b.score - a.score)
    
    const topShirt = shirtsWithScores[0]
    const topPants = pantsWithScores[0]
    
    // Score combinado del outfit
    let outfitScore = 50 + Math.floor((topShirt.score + topPants.score) / 4)
    const allReasons = [...topShirt.reasons, ...topPants.reasons]
    let reasoning = `Combinación básica: ${topShirt.garment.name} + ${topPants.garment.name}`
    
    const clothingRecs = getClothingRecommendations(weather)
    const weatherMatch = clothingRecs.types.includes('camisa') && clothingRecs.types.includes('pantalon')
    
    if (weatherMatch) {
      outfitScore += 20
      reasoning += ' - Perfecto para el clima actual'
    }
    
    // Agregar razones de recomendación
    if (allReasons.length > 0) {
      reasoning += `. Razones: ${allReasons.slice(0, 3).join(', ')}`
    }

    suggestions.push({
      garments: [topShirt.garment, topPants.garment],
      score: outfitScore,
      reasoning,
      weatherMatch
    })
  }

  // Outfit con vestido
  const dresses = garmentsByType.get('vestido') || []
  if (dresses.length > 0) {
    const clothingRecs = getClothingRecommendations(weather)
    if (clothingRecs.types.includes('vestido')) {
      const dressesWithScores = dresses.map(dress => ({
        garment: dress,
        ...calculateGarmentScore(dress, weather, usageHistory, season)
      }))
      
      dressesWithScores.sort((a, b) => b.score - a.score)
      const topDress = dressesWithScores[0]
    
      let outfitScore = 60 + Math.floor(topDress.score / 3)
      let reasoning = `Vestido: ${topDress.garment.name} - Ideal para el clima actual`
    
      if (topDress.reasons.length > 0) {
        reasoning += `. ${topDress.reasons.slice(0, 2).join(', ')}`
      }

    suggestions.push({
        garments: [topDress.garment],
        score: outfitScore,
      reasoning,
      weatherMatch: true
    })
    }
  }

  // Outfit con chaqueta/abrigo si hace frío
  if (weather && weather.temperature < 18) {
    const jackets = garmentsByType.get('chaqueta') || []
    const coats = garmentsByType.get('abrigo') || []
    const outerwear = [...jackets, ...coats]
    
    if (outerwear.length > 0 && (shirts.length > 0 || pants.length > 0)) {
      const outerwearWithScores = outerwear.map(item => ({
        garment: item,
        ...calculateGarmentScore(item, weather, usageHistory, season)
      }))
      
      outerwearWithScores.sort((a, b) => b.score - a.score)
      const topOuterwear = outerwearWithScores[0]
      
      const baseGarments = suggestions[0]?.garments || []
      if (baseGarments.length > 0) {
        let outfitScore = 70 + Math.floor(topOuterwear.score / 3)
        let reasoning = `Outfit con ${topOuterwear.garment.type}: ${baseGarments.map(g => g.name).join(' + ')} + ${topOuterwear.garment.name}`
        
        if (topOuterwear.reasons.length > 0) {
          reasoning += `. ${topOuterwear.reasons.slice(0, 2).join(', ')}`
        }

        suggestions.push({
          garments: [...baseGarments, topOuterwear.garment],
          score: outfitScore,
          reasoning,
          weatherMatch: true
        })
      }
    }
  }

  // Ordenar por score y retornar top 5
  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
}

