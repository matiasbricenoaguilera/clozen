import { Garment, WeatherData } from '@/types'
import { getClothingRecommendations, getSeasonFromTemperature } from './weather'

export interface OutfitSuggestion {
  garments: Garment[]
  score: number
  reasoning: string
  weatherMatch: boolean
}

/**
 * Recomienda outfits basado en clima y prendas disponibles
 */
export function recommendOutfits(
  garments: Garment[],
  weather: WeatherData | null,
  userId?: string
): OutfitSuggestion[] {
  if (garments.length === 0) {
    return []
  }

  // Filtrar prendas disponibles del usuario (o todas si es admin)
  const availableGarments = garments.filter(g => g.status === 'available')

  if (availableGarments.length === 0) {
    return []
  }

  // Obtener recomendaciones de tipos de ropa basadas en clima
  const clothingRecs = getClothingRecommendations(weather)
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
    // Tomar prendas menos usadas primero
    const sortedShirts = [...shirts].sort((a, b) => (a.usage_count || 0) - (b.usage_count || 0))
    const sortedPants = [...pants].sort((a, b) => (a.usage_count || 0) - (b.usage_count || 0))
    
    const topShirt = sortedShirts[0]
    const topPants = sortedPants[0]
    
    let score = 50
    let reasoning = `Combinación básica: ${topShirt.name} + ${topPants.name}`
    const weatherMatch = clothingRecs.types.includes('camisa') && clothingRecs.types.includes('pantalon')
    
    if (weatherMatch) {
      score += 30
      reasoning += ' - Perfecto para el clima actual'
    }
    
    // Bonus por temporada
    if (topShirt.season === season || topShirt.season === 'all') {
      score += 10
    }
    if (topPants.season === season || topPants.season === 'all') {
      score += 10
    }
    
    // Bonus por prendas poco usadas
    if ((topShirt.usage_count || 0) < 3) score += 5
    if ((topPants.usage_count || 0) < 3) score += 5

    suggestions.push({
      garments: [topShirt, topPants],
      score,
      reasoning,
      weatherMatch
    })
  }

  // Outfit con vestido
  const dresses = garmentsByType.get('vestido') || []
  if (dresses.length > 0 && clothingRecs.types.includes('vestido')) {
    const sortedDresses = [...dresses].sort((a, b) => (a.usage_count || 0) - (b.usage_count || 0))
    const topDress = sortedDresses[0]
    
    let score = 60
    let reasoning = `Vestido: ${topDress.name} - Ideal para el clima actual`
    
    if (topDress.season === season || topDress.season === 'all') {
      score += 20
    }
    
    if ((topDress.usage_count || 0) < 3) score += 10

    suggestions.push({
      garments: [topDress],
      score,
      reasoning,
      weatherMatch: true
    })
  }

  // Outfit con chaqueta/abrigo si hace frío
  if (weather && weather.temperature < 18) {
    const jackets = garmentsByType.get('chaqueta') || []
    const coats = garmentsByType.get('abrigo') || []
    const outerwear = [...jackets, ...coats]
    
    if (outerwear.length > 0 && (shirts.length > 0 || pants.length > 0)) {
      const sortedOuterwear = [...outerwear].sort((a, b) => (a.usage_count || 0) - (b.usage_count || 0))
      const topOuterwear = sortedOuterwear[0]
      
      const baseGarments = suggestions[0]?.garments || []
      if (baseGarments.length > 0) {
        let score = 70
        let reasoning = `Outfit con ${topOuterwear.type}: ${baseGarments.map(g => g.name).join(' + ')} + ${topOuterwear.name}`
        
        if (topOuterwear.season === season || topOuterwear.season === 'all') {
          score += 20
        }
        
        if ((topOuterwear.usage_count || 0) < 3) score += 10

        suggestions.push({
          garments: [...baseGarments, topOuterwear],
          score,
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

