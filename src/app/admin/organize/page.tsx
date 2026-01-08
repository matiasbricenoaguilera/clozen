'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Shirt, Package, Smartphone, Scan, CheckCircle, AlertCircle } from 'lucide-react'
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

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Cargar todas las prendas (de todos los usuarios) que están siendo lavadas o disponibles
      const { data: garmentsData, error: garmentsError } = await supabase
        .from('garments')
        .select('id, name, type, color, season, style, image_url, box_id, nfc_tag_id, barcode_id, status, user_id, created_at')
        .in('status', ['available', 'in_use']) // Incluir prendas que podrían estar siendo lavadas
        .order('created_at', { ascending: false })

      if (garmentsError) throw garmentsError

      // Cargar cajas con conteo de prendas
      const { data: boxesData, error: boxesError } = await supabase
        .from('boxes')
        .select(`
          *,
          garments(count)
        `)
        .order('name')

      if (boxesError) throw boxesError

      // Procesar datos de cajas
      const processedBoxes = (boxesData || []).map(box => ({
        ...box,
        garment_count: box.garments?.[0]?.count || 0
      }))

      setGarments(garmentsData || [])
      setBoxes(processedBoxes)
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

  const assignToBestBox = async (garmentId: string) => {
    setOrganizingGarment(true)
    setError('')
    setSuccess('')

    try {
      // Encontrar la caja con menos prendas
      const bestBox = boxes.reduce((prev, current) =>
        (prev.garment_count || 0) <= (current.garment_count || 0) ? prev : current
      )

      if (!bestBox) {
        setError('No hay cajas disponibles')
        return
      }

      // Actualizar la prenda con la nueva caja y marcar como available
      const { error: updateError } = await supabase
        .from('garments')
        .update({
          box_id: bestBox.id,
          status: 'available',
          updated_at: new Date().toISOString()
        })
        .eq('id', garmentId)

      if (updateError) throw updateError

      // Registrar en historial de organización
      await supabase
        .from('usage_history')
        .insert({
          garment_id: garmentId,
          usage_type: 'organized',
          created_at: new Date().toISOString()
        })

      setSuccess(`✅ Prenda organizada en "${bestBox.name}" (${bestBox.garment_count + 1} prendas ahora)`)

      // Limpiar y recargar
      setFoundGarment(null)
      setScanInput('')
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">🏗️ Organizar Ropa Lavada</h1>
        <p className="text-muted-foreground">
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

      {/* Estado de Cajas */}
      <Card>
        <CardHeader>
          <CardTitle>📦 Estado de Cajas</CardTitle>
          <CardDescription>Distribución actual de prendas en cajas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {boxes.map(box => (
              <div key={box.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">{box.name}</h3>
                  <Badge variant="secondary">
                    {box.garment_count || 0} prendas
                  </Badge>
                </div>
                {box.location && (
                  <p className="text-sm text-muted-foreground">{box.location}</p>
                )}
                {box.description && (
                  <p className="text-sm text-muted-foreground mt-1">{box.description}</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Escáner de Prendas */}
      <Card>
        <CardHeader>
          <CardTitle>🔍 Buscar Prenda</CardTitle>
          <CardDescription>
            Escanea o ingresa el código de la prenda que acabas de lavar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!scanMode ? (
            <div className="flex gap-4">
              <Button onClick={() => setScanMode('nfc')} variant="outline">
                <Smartphone className="h-4 w-4 mr-2" />
                Escanear NFC
              </Button>
              <Button onClick={() => setScanMode('barcode')} variant="outline">
                <Scan className="h-4 w-4 mr-2" />
                Código de Barras
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">
                  {scanMode === 'nfc' ? 'Código NFC' : 'Código de Barras'}
                </label>
                <Input
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  placeholder={scanMode === 'nfc' ? 'AA:BB:CC:DD:EE:FF' : '1234567890123'}
                  className="font-mono mt-1"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={findGarment}>
                  <Search className="h-4 w-4 mr-2" />
                  Buscar Prenda
                </Button>
                <Button onClick={() => { setScanMode(null); setScanInput(''); }} variant="outline">
                  Cancelar
                </Button>
              </div>
            </div>
          )}
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

            <Button
              onClick={() => assignToBestBox(foundGarment.id)}
              disabled={organizingGarment}
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
                  Asignar a Caja Óptima
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
