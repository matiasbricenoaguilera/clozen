'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getWeatherByCity } from '@/utils/weather'
import { WeatherData } from '@/types'
import { Cloud, CloudRain, Sun, CloudSun, Wind, Droplets, Thermometer, MapPin, RefreshCw } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

interface WeatherCardProps {
  onWeatherUpdate?: (weather: WeatherData | null) => void
}

export function WeatherCard({ onWeatherUpdate }: WeatherCardProps) {
  const { userProfile, updateProfile } = useAuth()
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editingCity, setEditingCity] = useState(false)
  const [cityInput, setCityInput] = useState(userProfile?.city || '')

  useEffect(() => {
    if (userProfile?.city) {
      fetchWeather(userProfile.city)
    }
  }, [userProfile?.city])

  const fetchWeather = async (city: string) => {
    if (!city || city.trim() === '') {
      setWeather(null)
      return
    }

    setLoading(true)
    setError('')
    
    try {
      const weatherData = await getWeatherByCity(city)
      setWeather(weatherData)
      if (onWeatherUpdate) {
        onWeatherUpdate(weatherData)
      }
      
      if (!weatherData) {
        setError(`No se pudo obtener el clima para "${city}". Verifica que la ciudad esté escrita correctamente.`)
      }
    } catch (err) {
      console.error('Error fetching weather:', err)
      setError('Error al obtener el clima')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveCity = async () => {
    if (!userProfile) return

    const city = cityInput.trim()
    if (!city) {
      setError('Por favor ingresa una ciudad')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Actualizar ciudad en el perfil
      const { error: updateError } = await updateProfile({ city })
      
      if (updateError) {
        throw updateError
      }

      // Obtener clima de la nueva ciudad
      await fetchWeather(city)
      setEditingCity(false)
    } catch (err) {
      console.error('Error updating city:', err)
      setError('Error al actualizar la ciudad')
    } finally {
      setLoading(false)
    }
  }

  const getWeatherIcon = (icon?: string) => {
    if (!icon) return <Sun className="h-5 w-5" />
    
    if (icon.includes('01')) return <Sun className="h-5 w-5 text-yellow-500" />
    if (icon.includes('02')) return <CloudSun className="h-5 w-5" />
    if (icon.includes('03') || icon.includes('04')) return <Cloud className="h-5 w-5" />
    if (icon.includes('09') || icon.includes('10')) return <CloudRain className="h-5 w-5 text-blue-500" />
    if (icon.includes('11')) return <CloudRain className="h-5 w-5 text-purple-500" />
    if (icon.includes('13')) return <CloudRain className="h-5 w-5 text-gray-400" />
    if (icon.includes('50')) return <Wind className="h-5 w-5 text-gray-400" />
    
    return <Sun className="h-5 w-5" />
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Clima Local
            </CardTitle>
            <CardDescription>
              {userProfile?.city || 'Configura tu ciudad para ver el clima'}
            </CardDescription>
          </div>
          {weather && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => userProfile?.city && fetchWeather(userProfile.city)}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {editingCity ? (
          <div className="space-y-2">
            <Label htmlFor="city">Ciudad</Label>
            <div className="flex gap-2">
              <Input
                id="city"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                placeholder="Ej: Santiago, Madrid, Buenos Aires"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveCity()
                  }
                }}
              />
              <Button onClick={handleSaveCity} disabled={loading}>
                Guardar
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditingCity(false)
                  setCityInput(userProfile?.city || '')
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {userProfile?.city ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingCity(true)}
                className="w-full"
              >
                <MapPin className="h-4 w-4 mr-2" />
                {userProfile.city} - Cambiar ciudad
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingCity(true)}
                className="w-full"
              >
                <MapPin className="h-4 w-4 mr-2" />
                Configurar ciudad
              </Button>
            )}
          </div>
        )}

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
            {error}
          </div>
        )}

        {loading && !weather && (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {weather && (
          <div className="flex items-center justify-between gap-3 py-1">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {getWeatherIcon(weather.icon)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">{weather.temperature}°C</span>
                  <span className="text-xs text-muted-foreground capitalize truncate">
                    {weather.description}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-1">
                    <Droplets className="h-3 w-3" />
                    {weather.humidity}%
                  </span>
                  <span className="truncate">{weather.city}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

