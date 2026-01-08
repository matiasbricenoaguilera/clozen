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
import { Plus, Search, Shirt, Package, Filter, Smartphone, Scan, Hand } from 'lucide-react'
import { findEntityByNFCTag } from '@/utils/nfc'
import type { Garment, Box } from '@/types'

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
      // Optimización: incluir nuevos campos y filtrar por status available
      const { data, error } = await supabase
        .from('garments')
        .select('id, name, type, color, season, style, image_url, box_id, nfc_tag_id, barcode_id, status, usage_count, last_used, created_at')
        .eq('user_id', userProfile?.id)
        .eq('status', 'available') // Solo mostrar prendas disponibles
        .order('last_used', { ascending: true, nullsFirst: false }) // Priorizar prendas menos usadas
        .limit(100)

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
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { data, error } = await supabase
        .from('garments')
        .select('id, name, type, color, season, style, image_url, box_id, nfc_tag_id, barcode_id, status, usage_count, last_used, created_at')
        .eq('user_id', userProfile.id)
        .eq('status', 'available')
        .or(`last_used.lt.${thirtyDaysAgo.toISOString()},usage_count.lt.3`)
        .order('last_used', { ascending: true, nullsFirst: true })
        .limit(6) // Mostrar top 6 prendas olvidadas

      if (error) throw error
      setForgottenGarments(data || [])
    } catch (error) {
      console.error('Error fetching forgotten garments:', error)
      setForgottenGarments([])
    }
  }

  // Función para retirar una prenda (marcar como in_use)
  const withdrawGarment = async (garmentId: string) => {
    if (!userProfile) return

    try {
      // 1. Obtener el valor actual de usage_count
      const { data: currentGarment, error: fetchError } = await supabase
        .from('garments')
        .select('usage_count')
        .eq('id', garmentId)
        .eq('user_id', userProfile.id)
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
        .eq('id', garmentId)
        .eq('user_id', userProfile.id)

      if (updateError) throw updateError

      // 3. Registrar en historial de uso
      await supabase
        .from('usage_history')
        .insert({
          user_id: userProfile.id,
          garment_id: garmentId,
          usage_type: 'manual',
          created_at: new Date().toISOString()
        })

      // 4. Refrescar datos para actualizar la vista
      await fetchGarments()

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Mi Closet</h1>
          <div className="flex flex-wrap gap-4 mt-2">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{filteredGarments.length}</span> prendas disponibles
            </div>
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{forgottenGarments.length}</span> prendas olvidadas
            </div>
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{boxes.length}</span> cajas compartidas
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowNFCScanner(true)}
          >
            <Scan className="h-4 w-4 mr-2" />
            Escanear Prenda
          </Button>
          {/* Solo mostrar botón de agregar si es admin */}
          {userProfile?.role === 'admin' && (
            <Link href="/closet/add">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Agregar Prenda
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Forgotten Garments Section */}
      {forgottenGarments.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">
              🧠 Prendas que quizás olvidaste
            </h3>
          </div>
          <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
            Estas prendas no se han usado recientemente. ¡Es hora de darles una segunda oportunidad!
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {forgottenGarments.map(garment => (
              <div key={garment.id} className="bg-white dark:bg-gray-800 rounded-lg p-3 border shadow-sm">
                <div className="aspect-square bg-muted rounded mb-2 flex items-center justify-center">
                  {garment.image_url ? (
                    <img
                      src={garment.image_url}
                      alt={garment.name}
                      className="w-full h-full object-cover rounded"
                      loading="lazy"
                    />
                  ) : (
                    <Shirt className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <p className="text-xs font-medium truncate">{garment.name}</p>
                <p className="text-xs text-muted-foreground">{garment.type}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => withdrawGarment(garment.id)}
                  className="w-full mt-2 text-xs"
                >
                  <Hand className="h-3 w-3 mr-1" />
                  Usar
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar prendas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={selectedBox}
          onChange={(e) => setSelectedBox(e.target.value)}
          className="px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredGarments.map(garment => (
            <Card key={garment.id} className="group cursor-pointer hover:shadow-lg transition-shadow">
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
                <CardDescription className="flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  {getBoxName(garment.box_id)}
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
                <div className="flex items-center justify-between mt-2">
                  <div className="text-xs text-muted-foreground">
                    {garment.usage_count > 0 && (
                      <span>Usada {garment.usage_count} {garment.usage_count === 1 ? 'vez' : 'veces'}</span>
                    )}
                    {garment.last_used && (
                      <span className="ml-2">
                        Último uso: {new Date(garment.last_used).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {/* Botón de retirar */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => withdrawGarment(garment.id)}
                    className="text-xs"
                  >
                    <Hand className="h-3 w-3 mr-1" />
                    Retirar
                  </Button>
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
    </div>
  )
}
