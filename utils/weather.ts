import { WeatherData } from '@/types'

const OPENWEATHER_API_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY
const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5'

/**
 * Obtiene el clima actual de una ciudad usando OpenWeatherMap API
 */
export async function getWeatherByCity(city: string): Promise<WeatherData | null> {
  if (!OPENWEATHER_API_KEY) {
    console.warn('⚠️ OpenWeatherMap API key no configurada')
    return null
  }

  if (!city || city.trim() === '') {
    console.warn('⚠️ Ciudad no especificada')
    return null
  }

  try {
    const url = `${OPENWEATHER_BASE_URL}/weather?q=${encodeURIComponent(city)}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=es`
    
    const response = await fetch(url)
    
    if (!response.ok) {
      if (response.status === 404) {
        console.error(`❌ Ciudad "${city}" no encontrada`)
        return null
      }
      throw new Error(`Error al obtener clima: ${response.statusText}`)
    }

    const data = await response.json()

    return {
      temperature: Math.round(data.main.temp),
      humidity: data.main.humidity,
      description: data.weather[0].description,
      icon: data.weather[0].icon,
      city: data.name
    }
  } catch (error) {
    console.error('❌ Error obteniendo clima:', error)
    return null
  }
}

/**
 * Determina la temporada basada en la temperatura
 */
export function getSeasonFromTemperature(temp: number): 'verano' | 'invierno' | 'otoño' | 'primavera' | 'all' {
  if (temp >= 25) return 'verano'
  if (temp <= 10) return 'invierno'
  if (temp >= 15 && temp < 25) return 'primavera'
  return 'otoño'
}

/**
 * Obtiene recomendaciones de tipo de ropa basadas en el clima
 */
export function getClothingRecommendations(weather: WeatherData | null): {
  types: string[]
  notes: string[]
} {
  if (!weather) {
    return {
      types: [],
      notes: ['No hay información del clima disponible']
    }
  }

  const { temperature, description } = weather
  const recommendations: string[] = []
  const notes: string[] = []

  // Recomendaciones basadas en temperatura
  if (temperature >= 25) {
    recommendations.push('camisa', 'pantalon corto', 'vestido', 'falda', 'ropa interior')
    notes.push('🌞 Día caluroso - Usa ropa ligera y fresca')
  } else if (temperature >= 18 && temperature < 25) {
    recommendations.push('camisa', 'pantalon', 'vestido', 'chaqueta ligera')
    notes.push('🌤️ Temperatura agradable - Ropa de temporada media')
  } else if (temperature >= 10 && temperature < 18) {
    recommendations.push('camisa', 'pantalon', 'chaqueta', 'abrigo ligero')
    notes.push('🌥️ Día fresco - Usa capas adicionales')
  } else {
    recommendations.push('abrigo', 'chaqueta', 'pantalon', 'accesorios')
    notes.push('❄️ Día frío - Abrígate bien')
  }

  // Recomendaciones basadas en descripción del clima
  const descLower = description.toLowerCase()
  if (descLower.includes('lluvia') || descLower.includes('rain')) {
    recommendations.push('chaqueta', 'abrigo')
    notes.push('🌧️ Lluvia - Lleva algo impermeable')
  }
  if (descLower.includes('viento') || descLower.includes('wind')) {
    notes.push('💨 Viento - Usa ropa que no vuele')
  }
  if (descLower.includes('sol') || descLower.includes('sun')) {
    notes.push('☀️ Soleado - Protección solar recomendada')
  }

  return {
    types: [...new Set(recommendations)], // Eliminar duplicados
    notes
  }
}

