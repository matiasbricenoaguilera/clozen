'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Shirt, Package, Smartphone, Scan, CheckCircle, AlertCircle, Search, X } from 'lucide-react'
import type { Garment, Box } from '@/types'

export default function AdminOrganizePage() {
  const { userProfile } = useAuth()
  const [garments, setGarments] = useState<Garment[]>([])
  const [boxes, setBoxes] = useState<Box[]>([])
  const [loading, setLoading] = useState(true)
  const [scanMode, setScanMode] = useState<'nfc' | 'barcode' | null>(null)
  const [scanInput, setScanInput] = useState('')
  const [foundGarment, setFoundGarment] = useState<Garment | null>(null)
  const [organizingGarment, setOrganizingGarment] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedBox, setSelectedBox] = useState<Box | null>(null)
  const [boxGarments, setBoxGarments] = useState<Garment[]>([])
  const [loadingBoxGarments, setLoadingBoxGarments] = useState(false)
  const [showBoxModal, setShowBoxModal] = useState(false)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [garmentToMove, setGarmentToMove] = useState<Garment | null>(null)
  const [selectedBoxId, setSelectedBoxId] = useState<string>('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Cargar todas las prendas disponibles (solo las que están disponibles, no las en uso)
      const { data: garmentsData, error: garmentsError } = await supabase
        .from('garments')
        .select('id, name, type, color, season, style, image_url, box_id, nfc_tag_id, barcode_id, status, user_id, created_at')
        .eq('status', 'available') // Solo prendas disponibles
        .order('created_at', { ascending: false })

      if (garmentsError) throw garmentsError

      // Cargar todas las cajas
      const { data: boxesData, error: boxesError } = await supabase
        .from('boxes')
        .select('*')
        .order('name')

      if (boxesError) throw boxesError

      // Obtener conteo real de prendas disponibles por caja
      const boxesWithCount = await Promise.all(
        (boxesData || []).map(async (box: any) => {
          const { count, error: countError } = await supabase
            .from('garments')
            .select('*', { count: 'exact', head: true })
            .eq('box_id', box.id)
            .eq('status', 'available') // Solo contar prendas disponibles
          
          if (countError) {
            console.error('Error counting garments for box:', box.id, countError)
            return {
              ...box,
              garment_count: 0
            }
          }
          
          return {
            ...box,
            garment_count: count || 0
          }
        })
      )

      setGarments(garmentsData || [])
      setBoxes(boxesWithCount)
    } catch (error) {
      console.error('Error loading data:', error)
      setError('Error al cargar los datos')
    } finally {
      setLoading(false)
    }
  }

  const findGarment = async () => {
    if (!scanInput.trim()) {
      setError('Ingresa un código para buscar')
      return
    }

    setError('')
    setFoundGarment(null)

    try {
      let query = supabase.from('garments').select('*')

      if (scanMode === 'nfc') {
        query = query.eq('nfc_tag_id', scanInput.trim())
      } else if (scanMode === 'barcode') {
        query = query.eq('barcode_id', scanInput.trim())
      }

      const { data, error } = await query.single()

      if (error) {
        if (error.code === 'PGRST116') {
          setError(`No se encontró ninguna prenda con ese código ${scanMode === 'nfc' ? 'NFC' : 'de barras'}`)
        } else {
          throw error
        }
        return
      }

      setFoundGarment(data)
      setSuccess(`Prenda encontrada: ${data.name}`)
    } catch (error) {
      console.error('Error finding garment:', error)
      setError('Error al buscar la prenda')
    }
  }

  // Función para obtener cajas recomendadas (< 60% = 9 prendas de 15)
  const getRecommendedBoxes = () => {
    return boxes
      .filter(box => (box.garment_count || 0) < 9)
      .sort((a, b) => (a.garment_count || 0) - (b.garment_count || 0))
  }

  // Función para cargar prendas de una caja (solo disponibles)
  const loadBoxGarments = async (boxId: string) => {
    setLoadingBoxGarments(true)
    try {
      const { data, error } = await supabase
        .from('garments')
        .select(`
          *,
          users:user_id (
            id,
            email,
            full_name
          )
        `)
        .eq('box_id', boxId)
        .eq('status', 'available') // Solo mostrar prendas disponibles
        .order('created_at', { ascending: false })

      if (error) throw error
      setBoxGarments(data || [])
    } catch (error) {
      console.error('Error loading box garments:', error)
      setError('Error al cargar prendas de la caja')
    } finally {
      setLoadingBoxGarments(false)
    }
  }

  // Función para abrir modal de caja
  const handleBoxClick = async (box: Box) => {
    setSelectedBox(box)
    setShowBoxModal(true)
    await loadBoxGarments(box.id)
  }

  // Función para mover prenda entre cajas
  const moveGarment = async (garmentId: string, targetBoxId: string | null) => {
    try {
      const { error } = await supabase
        .from('garments')
        .update({
          box_id: targetBoxId,
          updated_at: new Date().toISOString()
        })
        .eq('id', garmentId)

      if (error) throw error

      setSuccess(`✅ Prenda ${targetBoxId ? 'movida' : 'removida'} exitosamente`)
      
      // Recargar datos
      if (selectedBox) {
        await loadBoxGarments(selectedBox.id)
      }
      await loadData()
      
      setShowMoveModal(false)
      setGarmentToMove(null)
    } catch (error) {
      console.error('Error moving garment:', error)
      setError('Error al mover la prenda')
    }
  }

  // Función para quitar prenda de caja
  const removeFromBox = async (garmentId: string) => {
    await moveGarment(garmentId, null)
  }

  // Función mejorada para asignar prenda a caja (con selector manual)
  const assignToBox = async (garmentId: string, boxId?: string) => {
    setOrganizingGarment(true)
    setError('')
    setSuccess('')

    try {
      const targetBoxId = boxId || selectedBoxId

      if (!targetBoxId) {
        setError('Debes seleccionar una caja')
        return
      }

      // Verificar capacidad de la caja
      const targetBox = boxes.find(b => b.id === targetBoxId)
      if (targetBox && (targetBox.garment_count || 0) >= 15) {
        setError('Esta caja está llena (máximo 15 prendas)')
        return
      }

      const { error: updateError } = await supabase
        .from('garments')
        .update({
          box_id: targetBoxId,
          status: 'available',
          updated_at: new Date().toISOString()
        })
        .eq('id', garmentId)

      if (updateError) throw updateError

      const boxName = targetBox?.name || 'caja'
      setSuccess(`✅ Prenda organizada en "${boxName}"`)

      // Limpiar y recargar
      setFoundGarment(null)
      setScanInput('')
      setSelectedBoxId('')
      await loadData()

    } catch (error) {
      console.error('Error organizing garment:', error)
      setError('Error al organizar la prenda')
    } finally {
      setOrganizingGarment(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando sistema de organización...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">🏗️ Organizar Ropa Lavada</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Escanea prendas después de lavarlas y asigna automáticamente a la caja más apropiada
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Escáner de Prendas - Sección Principal */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-2xl">🔍 Incorporar Prenda Lavada</CardTitle>
          <CardDescription className="text-base">
            Escanea el código NFC o de barras de la prenda que acabas de lavar para incorporarla a una caja
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!scanMode ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <Button 
                onClick={() => setScanMode('nfc')} 
                variant="outline" 
                size="lg"
                className="h-auto sm:h-20 flex-col gap-2 py-4 sm:py-0"
              >
                <Smartphone className="h-5 w-5 sm:h-6 sm:w-6" />
                <span className="text-base sm:text-lg font-semibold">Escanear NFC</span>
                <span className="text-xs text-muted-foreground hidden sm:inline">Usa tu teléfono para leer el tag NFC</span>
              </Button>
              <Button 
                onClick={() => setScanMode('barcode')} 
                variant="outline" 
                size="lg"
                className="h-auto sm:h-20 flex-col gap-2 py-4 sm:py-0"
              >
                <Scan className="h-5 w-5 sm:h-6 sm:w-6" />
                <span className="text-base sm:text-lg font-semibold">Código de Barras</span>
                <span className="text-xs text-muted-foreground hidden sm:inline">Ingresa o escanea el código de barras</span>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  {scanMode === 'nfc' ? '📱 Código NFC' : '📊 Código de Barras'}
                </label>
                <Input
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      findGarment()
                    }
                  }}
                  placeholder={scanMode === 'nfc' ? 'Ej: AA:BB:CC:DD:EE:FF o pega el código aquí' : 'Ej: 1234567890123 o escanea el código'}
                  className="font-mono text-lg h-12"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {scanMode === 'nfc' 
                    ? 'Pega el código NFC que leíste con tu aplicación o escáner'
                    : 'Ingresa el código de barras manualmente o usa un escáner'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={findGarment} size="lg" className="flex-1">
                  <Search className="h-4 w-4 mr-2" />
                  Buscar Prenda
                </Button>
                <Button 
                  onClick={() => { 
                    setScanMode(null)
                    setScanInput('')
                    setFoundGarment(null)
                    setError('')
                    setSuccess('')
                  }} 
                  variant="outline" 
                  size="lg"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Estado de Cajas */}
      <Card>
        <CardHeader>
          <CardTitle>📦 Estado de Cajas</CardTitle>
          <CardDescription>Distribución actual de prendas en cajas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {boxes.map(box => {
              const occupancyPercent = Math.round(((box.garment_count || 0) / 15) * 100)
              return (
                <div 
                  key={box.id} 
                  className="p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleBoxClick(box)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{box.name}</h3>
                    <Badge variant={occupancyPercent >= 100 ? "destructive" : occupancyPercent >= 60 ? "default" : "secondary"}>
                      {box.garment_count || 0}/15
                    </Badge>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 mb-2">
                    <div 
                      className={`h-2 rounded-full transition-all ${
                        occupancyPercent >= 100 ? 'bg-red-500' : 
                        occupancyPercent >= 60 ? 'bg-yellow-500' : 
                        'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(occupancyPercent, 100)}%` }}
                    />
                  </div>
                  {box.location && (
                    <p className="text-sm text-muted-foreground">{box.location}</p>
                  )}
                  {box.description && (
                    <p className="text-sm text-muted-foreground mt-1">{box.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">Click para ver prendas</p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Prenda Encontrada */}
      {foundGarment && (
        <Card>
          <CardHeader>
            <CardTitle>👕 Prenda Encontrada</CardTitle>
            <CardDescription>
              Revisa los detalles y confirma la organización automática
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
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
              <div>
                <h3 className="font-semibold text-lg">{foundGarment.name}</h3>
                <p className="text-muted-foreground">{foundGarment.type}</p>
                {foundGarment.color && (
                  <Badge variant="outline" className="mt-1">{foundGarment.color}</Badge>
                )}
                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                  <Package className="h-4 w-4" />
                  {foundGarment.box_id ? 'Ya tiene caja asignada' : 'Sin caja asignada'}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Seleccionar Caja
                </label>
                
                    {/* Cajas Recomendadas */}
                {getRecommendedBoxes().length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground mb-2">
                      💡 Recomendadas (menos del 60% ocupadas):
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {getRecommendedBoxes().slice(0, 4).map(box => {
                        const occupancyPercent = Math.round(((box.garment_count || 0) / 15) * 100)
                        return (
                          <Button
                            key={box.id}
                            variant={selectedBoxId === box.id ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedBoxId(box.id)}
                            className="justify-start"
                          >
                            <div className="flex items-center justify-between w-full">
                              <span>{box.name}</span>
                              <Badge variant="secondary" className="ml-2">
                                {box.garment_count || 0}/15 ({occupancyPercent}%)
                              </Badge>
                            </div>
                          </Button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Selector de todas las cajas */}
                <Select value={selectedBoxId} onValueChange={setSelectedBoxId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una caja" />
                  </SelectTrigger>
                  <SelectContent>
                    {boxes.map(box => {
                      const occupancyPercent = Math.round(((box.garment_count || 0) / 15) * 100)
                      const isFull = (box.garment_count || 0) >= 15
                      return (
                        <SelectItem
                          key={box.id}
                          value={box.id}
                          disabled={isFull}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span>{box.name}</span>
                            <Badge variant="secondary" className="ml-2">
                              {box.garment_count || 0}/15
                              {isFull && ' (Llena)'}
                            </Badge>
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={() => assignToBox(foundGarment.id)}
                disabled={organizingGarment || !selectedBoxId}
                className="w-full"
              >
                {organizingGarment ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Organizando...
                  </>
                ) : (
                  <>
                    <Package className="h-4 w-4 mr-2" />
                    Guardar en Caja Seleccionada
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de Prendas en Caja */}
      {showBoxModal && selectedBox && (
        <Dialog open={showBoxModal} onOpenChange={setShowBoxModal}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>📦 Prendas en {selectedBox.name}</DialogTitle>
              <DialogDescription>
                {selectedBox.garment_count || 0} de 15 prendas ({Math.round(((selectedBox.garment_count || 0) / 15) * 100)}% ocupado)
              </DialogDescription>
            </DialogHeader>

            {loadingBoxGarments ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : boxGarments.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Esta caja está vacía</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {boxGarments.map((garment: any) => (
                  <Card key={garment.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                          {garment.image_url ? (
                            <img
                              src={garment.image_url}
                              alt={garment.name}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            <Shirt className="h-8 w-8 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold truncate">{garment.name}</h4>
                          <p className="text-sm text-muted-foreground">{garment.type}</p>
                          {garment.users && (
                            <p className="text-xs text-muted-foreground mt-1">
                              👤 {garment.users.full_name || garment.users.email}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setGarmentToMove(garment)
                              setShowMoveModal(true)
                            }}
                          >
                            Mover
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => removeFromBox(garment.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Modal para Mover Prenda */}
      {showMoveModal && garmentToMove && (
        <Dialog open={showMoveModal} onOpenChange={setShowMoveModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mover Prenda</DialogTitle>
              <DialogDescription>
                Selecciona la caja destino para "{garmentToMove.name}"
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Cajas Disponibles</label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {boxes
                    .filter(b => b.id !== selectedBox?.id)
                    .map(box => {
                      const occupancyPercent = Math.round(((box.garment_count || 0) / 15) * 100)
                      const isFull = (box.garment_count || 0) >= 15
                      return (
                        <Button
                          key={box.id}
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => {
                            moveGarment(garmentToMove.id, box.id)
                          }}
                          disabled={isFull}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span>{box.name}</span>
                            <Badge variant={isFull ? "destructive" : "secondary"}>
                              {box.garment_count || 0}/15 {isFull && '(Llena)'}
                            </Badge>
                          </div>
                        </Button>
                      )
                    })}
                </div>
              </div>

              <Button
                variant="outline"
                onClick={() => {
                  moveGarment(garmentToMove.id, null)
                }}
                className="w-full"
              >
                <X className="h-4 w-4 mr-2" />
                Quitar de Caja (Sin asignar)
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
