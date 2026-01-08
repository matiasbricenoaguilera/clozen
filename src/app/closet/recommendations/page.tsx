'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { WeatherCard } from '@/components/weather/weather-card'
import { GarmentLocationModal } from '@/components/garments/garment-location-modal'
import { recommendOutfits } from '@/utils/outfit-recommendations'
import { getWeatherByCity } from '@/utils/weather'
import { WeatherData, Garment, Box } from '@/types'
import { Shirt, Sparkles, Cloud, Package, Hand, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function RecommendationsPage() {
  const { userProfile, loading: authLoading } = useAuth()
  const router = useRouter()
  const [garments, setGarments] = useState<Garment[]>([])
  const [boxes, setBoxes] = useState<Box[]>([])
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [recommendations, setRecommendations] = useState<ReturnType<typeof recommendOutfits>>([])
  const [loading, setLoading] = useState(true)
  const [loadingRecommendations, setLoadingRecommendations] = useState(false)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [selectedOutfit, setSelectedOutfit] = useState<Garment[] | null>(null)

  useEffect(() => {
    if (!authLoading && userProfile) {
      loadData()
    } else if (!authLoading && !userProfile) {
      router.push('/auth/login')
    }
  }, [userProfile, authLoading])

  const loadData = async () => {
    if (!isSupabaseConfigured || !userProfile) return

    setLoading(true)
    try {
      // Cargar prendas disponibles
      const isAdmin = userProfile.role === 'admin'
      
      let query = supabase
        .from('garments')
        .select(`
          *,
          users:user_id (
            id,
            email,
            full_name
          )
        `)
        .eq('status', 'available')
        .limit(200)

      if (!isAdmin) {
        query = query.eq('user_id', userProfile.id)
      }

      const { data: garmentsData, error: garmentsError } = await query

      if (garmentsError) throw garmentsError
      setGarments(garmentsData || [])

      // Cargar cajas
      const { data: boxesData, error: boxesError } = await supabase
        .from('boxes')
        .select('*')
        .order('name', { ascending: true })

      if (boxesError) throw boxesError
      setBoxes(boxesData || [])

      // Cargar clima si hay ciudad configurada
      if (userProfile.city) {
        const weatherData = await getWeatherByCity(userProfile.city)
        setWeather(weatherData)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (garments.length > 0 && weather) {
      generateRecommendations()
    } else if (garments.length > 0 && !weather && userProfile?.city) {
      // Intentar obtener clima si aún no se tiene
      getWeatherByCity(userProfile.city).then(setWeather)
    }
  }, [garments, weather, userProfile])

  const generateRecommendations = () => {
    setLoadingRecommendations(true)
    try {
      const recs = recommendOutfits(garments, weather, userProfile?.id)
      setRecommendations(recs)
    } catch (error) {
      console.error('Error generating recommendations:', error)
    } finally {
      setLoadingRecommendations(false)
    }
  }

  const handleWeatherUpdate = (newWeather: WeatherData | null) => {
    setWeather(newWeather)
  }

  // Función para manejar el clic en "Usar este Outfit" - muestra ubicación primero
  const handleUseOutfitClick = (outfitGarments: Garment[]) => {
    setSelectedOutfit(outfitGarments)
    setShowLocationModal(true)
  }

  // Función para confirmar el uso del outfit después de mostrar ubicación
  const confirmUseOutfit = async () => {
    if (!selectedOutfit || !userProfile) return

    try {
      setLoadingRecommendations(true)

      const updates = selectedOutfit.map(async (garment) => {
        // 1. Obtener el valor actual de usage_count
        const { data: currentGarment, error: fetchError } = await supabase
          .from('garments')
          .select('usage_count')
          .eq('id', garment.id)
          .single()

        if (fetchError) throw fetchError

        // 2. Incrementar y actualizar
        const newUsageCount = (currentGarment?.usage_count || 0) + 1

        const { error: updateError } = await supabase
          .from('garments')
          .update({
            status: 'in_use',
            last_used: new Date().toISOString(),
            usage_count: newUsageCount
          })
          .eq('id', garment.id)

        if (updateError) throw updateError

        // 3. Registrar en historial de uso
        await supabase
          .from('usage_history')
          .insert({
            user_id: garment.user_id,
            garment_id: garment.id,
            usage_type: 'recommendation',
            created_at: new Date().toISOString()
          })
      })

      await Promise.all(updates)
      await loadData()
      setRecommendations([])
      setShowLocationModal(false)
      setSelectedOutfit(null)
      router.push('/closet')
      console.log('✅ Outfit utilizado exitosamente')
    } catch (error) {
      console.error('❌ Error al usar outfit:', error)
    } finally {
      setLoadingRecommendations(false)
    }
  }

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando recomendaciones...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 sm:h-8 sm:w-8" />
          Recomendaciones de Outfits
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
          Sugerencias personalizadas basadas en el clima y tus prendas disponibles
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Clima */}
        <div className="lg:col-span-1">
          <WeatherCard onWeatherUpdate={handleWeatherUpdate} />
        </div>

        {/* Recomendaciones */}
        <div className="lg:col-span-2 space-y-4">
          {!userProfile?.city ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Cloud className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  Configura tu ciudad para obtener recomendaciones
                </h3>
                <p className="text-muted-foreground">
                  Las recomendaciones se basan en el clima local de tu ciudad
                </p>
              </CardContent>
            </Card>
          ) : !weather ? (
            <Card>
              <CardContent className="py-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Obteniendo información del clima...</p>
              </CardContent>
            </Card>
          ) : garments.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Shirt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No hay prendas disponibles
                </h3>
                <p className="text-muted-foreground mb-4">
                  Agrega prendas a tu closet para recibir recomendaciones
                </p>
              </CardContent>
            </Card>
          ) : recommendations.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  Generando recomendaciones...
                </h3>
                <p className="text-muted-foreground">
                  Analizando tus prendas y el clima actual
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">
                  {recommendations.length} Recomendaciones Disponibles
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateRecommendations}
                  disabled={loadingRecommendations}
                >
                  Actualizar
                </Button>
              </div>

              {recommendations.map((rec, index) => (
                <Card key={index} className={rec.weatherMatch ? 'border-primary' : ''}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <span>#{index + 1}</span>
                          {rec.weatherMatch && (
                            <Badge variant="default" className="ml-2">
                              🌤️ Ideal para el clima
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="mt-2">
                          {rec.reasoning}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary">
                        Score: {rec.score}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                      {rec.garments.map((garment) => (
                        <div
                          key={garment.id}
                          className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                        >
                          <div className="aspect-square bg-muted rounded-lg mb-2 flex items-center justify-center">
                            {garment.image_url ? (
                              <img
                                src={garment.image_url}
                                alt={garment.name}
                                className="w-full h-full object-cover rounded-lg"
                                loading="lazy"
                              />
                            ) : (
                              <Shirt className="h-8 w-8 text-muted-foreground" />
                            )}
                          </div>
                          <div className="space-y-1">
                            <h4 className="font-semibold text-sm line-clamp-1">
                              {garment.name}
                            </h4>
                            <div className="flex flex-wrap gap-1">
                              <Badge variant="outline" className="text-xs">
                                {garment.type}
                              </Badge>
                              {garment.color && (
                                <Badge variant="outline" className="text-xs">
                                  {garment.color}
                                </Badge>
                              )}
                            </div>
                            {garment.box_id && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Package className="h-3 w-3" />
                                En caja
                              </div>
                            )}
                            {userProfile?.role === 'admin' && (garment as any).users && (
                              <div className="text-xs text-muted-foreground">
                                👤 {(garment as any).users.full_name || (garment as any).users.email}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => handleUseOutfitClick(rec.garments)}
                      >
                        <Hand className="h-4 w-4 mr-2" />
                        Usar este Outfit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Modal de ubicación de prendas */}
      <GarmentLocationModal
        open={showLocationModal}
        onOpenChange={setShowLocationModal}
        garments={selectedOutfit || []}
        boxes={boxes}
        onConfirm={confirmUseOutfit}
        confirmLabel="Confirmar Outfit"
      />
    </div>
  )
}

