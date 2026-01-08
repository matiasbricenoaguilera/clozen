'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DemoBanner } from '@/components/ui/demo-banner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { NFCScanner } from '@/components/nfc/nfc-scanner'
import { Plus, Search, Shirt, Package, Filter, Smartphone, Scan, Hand, Sparkles } from 'lucide-react'
import { findEntityByNFCTag } from '@/utils/nfc'
import { WeatherCard } from '@/components/weather/weather-card'
import { GarmentLocationModal } from '@/components/garments/garment-location-modal'
import { GarmentSelectionCart } from '@/components/garments/garment-selection-cart'
import { GarmentSearchList } from '@/components/garments/garment-search-list'
import { EditGarmentModal } from '@/components/garments/edit-garment-modal'
import type { Garment, Box, WeatherData } from '@/types'

export default function ClosetPage() {
  const { userProfile, loading: authLoading } = useAuth()
  const [garments, setGarments] = useState<Garment[]>([])
  const [boxes, setBoxes] = useState<Box[]>([])
  const [boxesMap, setBoxesMap] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [loadingGarments, setLoadingGarments] = useState(false)
  const [loadingBoxes, setLoadingBoxes] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBox, setSelectedBox] = useState<string>('')
  const [showNFCScanner, setShowNFCScanner] = useState(false)
  const [foundGarment, setFoundGarment] = useState<Garment | null>(null)
  const [nfcError, setNfcError] = useState('')
  const [forgottenGarments, setForgottenGarments] = useState<Garment[]>([])
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [selectedGarmentForWithdraw, setSelectedGarmentForWithdraw] = useState<Garment | null>(null)
  const [selectedGarments, setSelectedGarments] = useState<Garment[]>([])
  const [showSearchList, setShowSearchList] = useState(false)
  const [editingGarment, setEditingGarment] = useState<Garment | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)

  useEffect(() => {
    // En modo demo (sin Supabase), mostrar interfaz vacía inmediatamente
    if (!isSupabaseConfigured) {
      setGarments([])
      setBoxes([])
      setBoxesMap(new Map())
      setLoading(false)
      return
    }

    // En modo real, esperar a que la autenticación se resuelva
    if (!authLoading && userProfile) {
      // Ejecutar consultas en paralelo para mejor rendimiento
      Promise.all([fetchGarments(), fetchBoxes(), fetchForgottenGarments()]).finally(() => {
        setLoading(false)
      })
    } else if (!authLoading && !userProfile) {
      // Usuario no autenticado en modo real
      setGarments([])
      setBoxes([])
      setBoxesMap(new Map())
      setForgottenGarments([])
      setLoading(false)
    }
  }, [userProfile, authLoading, isSupabaseConfigured])

  const fetchGarments = async () => {
    setLoadingGarments(true)

    // En modo demo, devolver array vacío
    if (!isSupabaseConfigured) {
      setGarments([])
      setLoadingGarments(false)
      return
    }

    try {
      // Si es admin, mostrar todas las prendas disponibles de todos los usuarios
      // Si es usuario normal, mostrar solo sus prendas
      const isAdmin = userProfile?.role === 'admin'
      
      let query = supabase
        .from('garments')
        .select(`
          id, 
          name, 
          type, 
          color, 
          season, 
          style, 
          image_url, 
          box_id, 
          nfc_tag_id, 
          barcode_id, 
          status, 
          usage_count, 
          last_used, 
          created_at,
          user_id,
          users:user_id (
            id,
            email,
            full_name
          )
        `)
        .eq('status', 'available') // Solo mostrar prendas disponibles
        .order('last_used', { ascending: true, nullsFirst: false }) // Priorizar prendas menos usadas
        .limit(200) // Aumentar límite para admins

      // Si no es admin, filtrar por su user_id
      if (!isAdmin) {
        query = query.eq('user_id', userProfile?.id)
      }

      const { data, error } = await query

      if (error) throw error
      setGarments(data || [])
    } catch (error) {
      console.error('Error fetching garments:', error)
      // En caso de error, mostrar array vacío
      setGarments([])
    } finally {
      setLoadingGarments(false)
    }
  }

  const fetchBoxes = async () => {
    setLoadingBoxes(true)

    // En modo demo, devolver array vacío
    if (!isSupabaseConfigured) {
      setBoxes([])
      setBoxesMap(new Map())
      setLoadingBoxes(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('boxes')
        .select('id, name')
        .order('name')

      if (error) throw error

      const boxesData: Box[] = data || []
      setBoxes(boxesData)

      // Crear mapa para acceso O(1) a nombres de cajas
      const boxesMapData = new Map<string, string>()
      boxesData.forEach((box: Box) => {
        boxesMapData.set(box.id, box.name)
      })
      setBoxesMap(boxesMapData)
    } catch (error) {
      console.error('Error fetching boxes:', error)
      // En caso de error, mostrar array vacío
      setBoxes([])
      setBoxesMap(new Map())
    } finally {
      setLoadingBoxes(false)
    }
  }

  const filteredGarments = garments.filter(garment => {
    const matchesSearch = garment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         garment.type.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesBox = !selectedBox || garment.box_id === selectedBox
    return matchesSearch && matchesBox
  })

  const getBoxName = (boxId: string | null) => {
    if (!boxId) return 'Sin caja'
    return boxesMap.get(boxId) || 'Caja desconocida'
  }

  // Función para recargar datos (útil para refresh)
  const refreshData = async () => {
    setLoading(true)
    await Promise.all([fetchGarments(), fetchBoxes()])
    setLoading(false)
  }

  // Función para obtener prendas olvidadas (recomendaciones inteligentes)
  const fetchForgottenGarments = async () => {
    if (!userProfile) return

    try {
      const isAdmin = userProfile.role === 'admin'
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      let query = supabase
        .from('garments')
        .select('id, name, type, color, season, style, image_url, box_id, nfc_tag_id, barcode_id, status, usage_count, last_used, created_at')
        .eq('status', 'available')
        .or(`last_used.is.null,last_used.lt.${thirtyDaysAgo.toISOString()},usage_count.lt.3`)
        .order('last_used', { ascending: true, nullsFirst: true })
        .limit(6) // Mostrar top 6 prendas olvidadas

      // Si no es admin, filtrar por su user_id
      if (!isAdmin) {
        query = query.eq('user_id', userProfile.id)
      }

      const { data, error } = await query

      if (error) throw error
      setForgottenGarments(data || [])
    } catch (error) {
      console.error('Error fetching forgotten garments:', error)
      setForgottenGarments([])
    }
  }

  // Función para agregar prenda a la lista de búsqueda
  const handleAddToSearchList = (garmentId: string) => {
    const garment = garments.find(g => g.id === garmentId)
    if (garment && !selectedGarments.find(g => g.id === garmentId)) {
      setSelectedGarments(prev => [...prev, garment])
    }
  }

  // Función para quitar prenda de la lista de búsqueda
  const handleRemoveFromSearchList = (garmentId: string) => {
    setSelectedGarments(prev => prev.filter(g => g.id !== garmentId))
  }

  // Función para confirmar retiro de múltiples prendas
  const handleConfirmMultipleWithdraw = async (garmentIds: string[]) => {
    if (!userProfile) return

    try {
      const updates = garmentIds.map(async (garmentId) => {
        const garment = selectedGarments.find(g => g.id === garmentId)
        if (!garment) return

        const isAdmin = userProfile.role === 'admin'
        
        // Verificar permisos
        if (!isAdmin && garment.user_id !== userProfile.id) {
          console.error('❌ No tienes permiso para retirar esta prenda')
          return
        }

        // Obtener usage_count actual
        const { data: currentGarment, error: fetchError } = await supabase
          .from('garments')
          .select('usage_count, user_id')
          .eq('id', garmentId)
          .single()

        if (fetchError) throw fetchError

        const newUsageCount = (currentGarment?.usage_count || 0) + 1
        const garmentOwnerId = currentGarment?.user_id || userProfile.id

        // Actualizar prenda
        const { error: updateError } = await supabase
          .from('garments')
          .update({
            status: 'in_use',
            last_used: new Date().toISOString(),
            usage_count: newUsageCount
          })
          .eq('id', garmentId)

        if (updateError) throw updateError

        // Registrar en historial
        await supabase
          .from('usage_history')
          .insert({
            user_id: garmentOwnerId,
            garment_id: garmentId,
            usage_type: 'manual',
            created_at: new Date().toISOString()
          })
      })

      await Promise.all(updates)
      
      // Limpiar selección y recargar datos
      setSelectedGarments([])
      setShowSearchList(false)
      await Promise.all([fetchGarments(), fetchForgottenGarments()])
      
      console.log('✅ Prendas retiradas exitosamente')
    } catch (error) {
      console.error('❌ Error al retirar prendas:', error)
    }
  }

  // Función para manejar el clic en "Retirar" - muestra ubicación primero (mantener para compatibilidad)
  const handleWithdrawClick = (garmentId: string) => {
    const garment = garments.find(g => g.id === garmentId)
    if (garment) {
      setSelectedGarmentForWithdraw(garment)
      setShowLocationModal(true)
    }
  }

  // Función para confirmar el retiro después de mostrar ubicación (mantener para compatibilidad)
  const confirmWithdraw = async () => {
    if (selectedGarmentForWithdraw) {
      await withdrawGarment(selectedGarmentForWithdraw.id)
      setShowLocationModal(false)
      setSelectedGarmentForWithdraw(null)
    }
  }

  // Función para retirar una prenda (marcar como in_use)
  const withdrawGarment = async (garmentId: string) => {
    if (!userProfile) return

    try {
      const isAdmin = userProfile.role === 'admin'
      
      // 1. Obtener el valor actual de usage_count y user_id de la prenda
      const { data: currentGarment, error: fetchError } = await supabase
        .from('garments')
        .select('usage_count, user_id')
        .eq('id', garmentId)
        .single()

      if (fetchError) throw fetchError

      // Si no es admin, verificar que la prenda pertenezca al usuario
      if (!isAdmin && currentGarment?.user_id !== userProfile.id) {
        console.error('❌ No tienes permiso para retirar esta prenda')
        return
      }

      // 2. Incrementar y actualizar
      const newUsageCount = (currentGarment?.usage_count || 0) + 1
      const garmentOwnerId = currentGarment?.user_id || userProfile.id

      const { error: updateError } = await supabase
        .from('garments')
        .update({
          status: 'in_use',
          last_used: new Date().toISOString(),
          usage_count: newUsageCount
        })
        .eq('id', garmentId)

      if (updateError) throw updateError

      // 3. Registrar en historial de uso (usar el dueño de la prenda, no el admin)
      await supabase
        .from('usage_history')
        .insert({
          user_id: garmentOwnerId,
          garment_id: garmentId,
          usage_type: 'manual',
          created_at: new Date().toISOString()
        })

      // 4. Refrescar datos para actualizar la vista
      await Promise.all([
        fetchGarments(),
        fetchForgottenGarments() // Actualizar lista de prendas olvidadas
      ])

      console.log('✅ Prenda retirada exitosamente')
    } catch (error) {
      console.error('❌ Error al retirar prenda:', error)
      // Aquí podríamos mostrar un toast de error
    }
  }

  const handleNFCScanSuccess = async (tagId: string) => {
    try {
      const result = await findEntityByNFCTag(tagId)
      if (result && result.entityType === 'garment') {
        setFoundGarment(result.entity as Garment)
        setShowNFCScanner(false)
        setNfcError('')
      } else if (result && result.entityType === 'box') {
        setNfcError(`Este tag pertenece a la caja "${result.entityName}". Solo puedes escanear prendas desde aquí.`)
      } else {
        setNfcError('No se encontró ninguna prenda asociada a este tag NFC.')
      }
    } catch (error) {
      console.error('Error finding garment by NFC:', error)
      setNfcError('Error al buscar la prenda. Inténtalo de nuevo.')
    }
  }

  const handleNFCScanError = (error: string) => {
    setNfcError(error)
  }

  const closeFoundGarmentDialog = () => {
    setFoundGarment(null)
    setNfcError('')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <div className="space-y-2">
            <p className="font-medium">Cargando tu closet...</p>
            <div className="flex justify-center space-x-4 text-sm text-muted-foreground">
              {loadingGarments && (
                <span className="flex items-center">
                  <div className="animate-spin rounded-full h-3 w-3 border-b border-current mr-1"></div>
                  Prendas
                </span>
              )}
              {loadingBoxes && (
                <span className="flex items-center">
                  <div className="animate-spin rounded-full h-3 w-3 border-b border-current mr-1"></div>
                  Cajas
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {!isSupabaseConfigured && <DemoBanner />}

      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            {userProfile?.role === 'admin' ? 'Closet Familiar' : 'Mi Closet'}
          </h1>
          {userProfile?.role === 'admin' && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Vista de todas las prendas disponibles de todos los usuarios
            </p>
          )}
          <div className="flex flex-wrap gap-2 sm:gap-4 mt-2">
            <div className="text-xs sm:text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{filteredGarments.length}</span> prendas disponibles
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{forgottenGarments.length}</span> prendas olvidadas
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{boxes.length}</span> cajas compartidas
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/closet/recommendations" className="flex-1 sm:flex-none">
            <Button variant="outline" className="w-full sm:w-auto">
              <Sparkles className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Recomendaciones</span>
              <span className="sm:hidden">Recom.</span>
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={() => setShowNFCScanner(true)}
            className="flex-1 sm:flex-none"
          >
            <Scan className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Escanear Prenda</span>
            <span className="sm:hidden">Escanear</span>
          </Button>
          {/* Solo mostrar botón de agregar si es admin */}
          {userProfile?.role === 'admin' && (
            <Link href="/closet/add" className="flex-1 sm:flex-none">
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Agregar Prenda</span>
                <span className="sm:hidden">Agregar</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Weather and Forgotten Garments Section */}
      {userProfile && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-1">
            <WeatherCard onWeatherUpdate={setWeather} />
          </div>
          <div className="lg:col-span-2">
            {/* Forgotten Garments Section */}
            {forgottenGarments.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full flex-shrink-0"></div>
                  <h3 className="font-semibold text-sm sm:text-base text-yellow-900 dark:text-yellow-100">
                    🧠 Prendas que quizás olvidaste
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-yellow-700 dark:text-yellow-300 mb-2 sm:mb-3">
                  Estas prendas no se han usado recientemente. ¡Es hora de darles una segunda oportunidad!
                </p>
                <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
                  {forgottenGarments.map(garment => (
                    <div key={garment.id} className="bg-white dark:bg-gray-800 rounded-lg p-2 sm:p-3 border shadow-sm">
                      <div className="aspect-square bg-muted rounded mb-1 sm:mb-2 flex items-center justify-center overflow-hidden">
                        {garment.image_url ? (
                          <img
                            src={garment.image_url}
                            alt={garment.name}
                            className="w-full h-full object-cover rounded"
                            loading="lazy"
                          />
                        ) : (
                          <Shirt className="h-4 w-4 sm:h-6 sm:w-6 text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-xs font-medium truncate">{garment.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{garment.type}</p>
                      <Button
                        size="sm"
                        variant={selectedGarments.find(g => g.id === garment.id) ? "default" : "outline"}
                        onClick={() => {
                          if (selectedGarments.find(g => g.id === garment.id)) {
                            handleRemoveFromSearchList(garment.id)
                          } else {
                            handleAddToSearchList(garment.id)
                          }
                        }}
                        className="w-full mt-1 sm:mt-2 text-xs h-7 sm:h-8"
                      >
                        {selectedGarments.find(g => g.id === garment.id) ? (
                          <>
                            <Package className="h-3 w-3 mr-1" />
                            <span className="hidden sm:inline">En Lista</span>
                            <span className="sm:hidden">Lista</span>
                          </>
                        ) : (
                          <>
                            <Plus className="h-3 w-3 mr-1" />
                            <span className="hidden sm:inline">Agregar</span>
                            <span className="sm:hidden">+</span>
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar prendas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full"
          />
        </div>
        <select
          value={selectedBox}
          onChange={(e) => setSelectedBox(e.target.value)}
          className="px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring w-full sm:w-auto sm:min-w-[180px]"
        >
          <option value="">Todas las cajas</option>
          {boxes.map(box => (
            <option key={box.id} value={box.id}>{box.name}</option>
          ))}
        </select>
      </div>

      {/* Garments Grid */}
      {filteredGarments.length === 0 ? (
        <div className="text-center py-12">
          <Shirt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {searchTerm || selectedBox ? 'No se encontraron prendas' : 'Tu closet está vacío'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm || selectedBox
              ? 'Intenta con otros filtros de búsqueda'
              : 'Comienza agregando tu primera prenda'
            }
          </p>
          {!searchTerm && !selectedBox && userProfile?.role === 'admin' && (
            <Link href="/closet/add">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Agregar Primera Prenda
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {filteredGarments.map(garment => (
            <Card 
              key={garment.id} 
              className={`group hover:shadow-lg transition-shadow ${
                userProfile?.role === 'admin' ? 'cursor-pointer' : ''
              }`}
              onClick={() => {
                if (userProfile?.role === 'admin') {
                  setEditingGarment(garment)
                  setShowEditModal(true)
                }
              }}
            >
              <CardHeader className="pb-3">
                <div className="aspect-square bg-muted rounded-lg mb-3 flex items-center justify-center">
                  {garment.image_url ? (
                    <img
                      src={garment.image_url}
                      alt={garment.name}
                      className="w-full h-full object-cover rounded-lg"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        // Fallback si la imagen falla
                        e.currentTarget.style.display = 'none'
                        e.currentTarget.nextElementSibling?.classList.remove('hidden')
                      }}
                    />
                  ) : null}
                  {/* Fallback icon - visible cuando no hay imagen o falla la carga */}
                  <Shirt className={`h-8 w-8 text-muted-foreground ${garment.image_url ? 'hidden' : ''}`} />
                </div>
                <CardTitle className="text-lg line-clamp-1">{garment.name}</CardTitle>
                <CardDescription className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    <span className="font-medium">{getBoxName(garment.box_id)}</span>
                    {garment.box_id && boxes.find(b => b.id === garment.box_id)?.location && (
                      <span className="text-xs text-muted-foreground ml-2">
                        ({boxes.find(b => b.id === garment.box_id)?.location})
                      </span>
                    )}
                  </div>
                  {/* Mostrar dueño si es admin */}
                  {userProfile?.role === 'admin' && (garment as any).users && (
                    <div className="flex items-center gap-1 text-xs">
                      <span>👤</span>
                      <span>{(garment as any).users.full_name || (garment as any).users.email}</span>
                    </div>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{garment.type}</Badge>
                  {garment.nfc_tag_id && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Smartphone className="h-3 w-3" />
                      NFC
                    </Badge>
                  )}
                  {garment.barcode_id && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      📱 Barcode
                    </Badge>
                  )}
                  {garment.color && (
                    <Badge variant="outline">{garment.color}</Badge>
                  )}
                  {garment.season && (
                    <Badge variant="outline">{garment.season}</Badge>
                  )}
                </div>

                {/* Información de uso */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-2">
                  <div className="text-xs text-muted-foreground">
                    {garment.usage_count > 0 && (
                      <span className="block sm:inline">Usada {garment.usage_count} {garment.usage_count === 1 ? 'vez' : 'veces'}</span>
                    )}
                    {garment.last_used && (
                      <span className="block sm:inline sm:ml-2">
                        Último uso: {new Date(garment.last_used).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {/* Botón de agregar a lista */}
                  {selectedGarments.find(g => g.id === garment.id) ? (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleRemoveFromSearchList(garment.id)}
                      className="text-xs w-full sm:w-auto"
                    >
                      <Hand className="h-3 w-3 mr-1" />
                      <span className="hidden sm:inline">En Lista</span>
                      <span className="sm:hidden">Lista</span>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddToSearchList(garment.id)}
                      className="text-xs w-full sm:w-auto"
                    >
                      <Hand className="h-3 w-3 mr-1" />
                      <span className="hidden sm:inline">Agregar</span>
                      <span className="sm:hidden">Agregar</span>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* NFC Scanner Dialog */}
      <Dialog open={showNFCScanner} onOpenChange={setShowNFCScanner}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Escanear Prenda NFC</DialogTitle>
            <DialogDescription>
              Acércate un tag NFC de una prenda para identificarla
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <NFCScanner
              mode="read"
              onSuccess={handleNFCScanSuccess}
              onError={handleNFCScanError}
              title="Escanear Tag NFC"
              description="Acércate el tag NFC de la prenda que quieres identificar"
            />
            {nfcError && (
              <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-700 dark:text-red-300">{nfcError}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Found Garment Dialog */}
      <Dialog open={!!foundGarment} onOpenChange={closeFoundGarmentDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              ¡Prenda Encontrada!
            </DialogTitle>
            <DialogDescription>
              Esta prenda está asociada al tag NFC escaneado
            </DialogDescription>
          </DialogHeader>
          {foundGarment && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="aspect-square w-24 bg-muted rounded-lg flex items-center justify-center">
                  {foundGarment.image_url ? (
                    <img
                      src={foundGarment.image_url}
                      alt={foundGarment.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <Shirt className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className="font-semibold text-lg">{foundGarment.name}</h3>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{foundGarment.type}</Badge>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Smartphone className="h-3 w-3" />
                      NFC: {foundGarment.nfc_tag_id}
                    </Badge>
                    {foundGarment.color && (
                      <Badge variant="outline">{foundGarment.color}</Badge>
                    )}
                    {foundGarment.season && (
                      <Badge variant="outline">{foundGarment.season}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    En: {getBoxName(foundGarment.box_id)}
                  </p>
                  {foundGarment.usage_count > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Usada {foundGarment.usage_count} {foundGarment.usage_count === 1 ? 'vez' : 'veces'}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={closeFoundGarmentDialog} className="flex-1">
                  Cerrar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de ubicación de prendas (compatibilidad) */}
      <GarmentLocationModal
        open={showLocationModal}
        onOpenChange={setShowLocationModal}
        garments={selectedGarmentForWithdraw ? [selectedGarmentForWithdraw] : []}
        boxes={boxes}
        onConfirm={confirmWithdraw}
        confirmLabel="Confirmar Retiro"
      />

      {/* Panel flotante de selección */}
      <GarmentSelectionCart
        selectedGarments={selectedGarments}
        boxes={boxes}
        onOpenList={() => setShowSearchList(true)}
        onRemoveGarment={handleRemoveFromSearchList}
      />

      {/* Panel lateral de lista de búsqueda */}
      <GarmentSearchList
        open={showSearchList}
        onOpenChange={setShowSearchList}
        selectedGarments={selectedGarments}
        boxes={boxes}
        onConfirm={handleConfirmMultipleWithdraw}
        onRemoveGarment={handleRemoveFromSearchList}
        confirmLabel="Confirmar Retiro"
      />

      {/* Modal de edición de prenda */}
      {userProfile?.role === 'admin' && (
        <EditGarmentModal
          open={showEditModal}
          onOpenChange={setShowEditModal}
          garment={editingGarment}
          boxes={boxes}
          onSuccess={() => {
            fetchGarments()
            setEditingGarment(null)
          }}
        />
      )}
    </div>
  )
}
