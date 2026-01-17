'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Image from 'next/image'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { NFCScanner } from '@/components/nfc/nfc-scanner'
import { Shirt, Package, Smartphone, Scan, CheckCircle, AlertCircle, Search, X } from 'lucide-react'
import type { Garment, Box } from '@/types'

export default function AdminOrganizePage() {
  const { userProfile } = useAuth()
  const [garments, setGarments] = useState<Garment[]>([])
  const [boxes, setBoxes] = useState<Box[]>([])
  const [loading, setLoading] = useState(true)
  const [scanMode, setScanMode] = useState<'nfc' | 'barcode' | null>(null)
  const [scanInput, setScanInput] = useState('')
  const [nfcScanMode, setNfcScanMode] = useState<'scanner' | 'manual' | null>(null) // Controlar si mostrar scanner o input manual
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
  
  // ✅ AGREGAR: Estados para búsqueda en lote
  const [batchCodes, setBatchCodes] = useState<string>('')
  const [foundGarmentsBatch, setFoundGarmentsBatch] = useState<Garment[]>([])
  const [searchingBatch, setSearchingBatch] = useState(false)
  const [selectedBoxForBatch, setSelectedBoxForBatch] = useState<string>('')
  const [assigningBox, setAssigningBox] = useState(false)
  const [batchError, setBatchError] = useState('')
  const [hasEnoughSpace, setHasEnoughSpace] = useState(true)
  const [selectedBoxInfo, setSelectedBoxInfo] = useState<{ name: string; location?: string; currentCount: number; availableSpace: number } | null>(null)
  
  // Refs para optimizar escritura rápida de Scanner Keyboard
  const batchCodesRef = useRef<string>('')

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

      // OPTIMIZACIÓN CRÍTICA: Usar queries agregadas (count) en paralelo
      // en lugar de traer TODOS los box_id (puede ser miles de registros)
      const boxIds = (boxesData || []).map((box: { id: string; name: string }) => box.id)
      
      // Si no hay cajas, continuar sin conteos
      let countMap = new Map<string, number>()
      if (boxIds.length > 0) {
        // OPTIMIZACIÓN: Hacer counts en paralelo por cada caja usando count(*)
        // Esto es MUCHO más eficiente que traer todos los registros
        const countQueries = boxIds.map((boxId: string) =>
          supabase
            .from('garments')
            .select('*', { count: 'exact', head: true })
            .eq('box_id', boxId)
            .eq('status', 'available')
        )

        const countResults = await Promise.all(countQueries)

        // Crear mapa de conteos
        boxIds.forEach((boxId: string, index: number) => {
          countMap.set(boxId, countResults[index].count || 0)
        })
      }

      // Combinar datos con conteos
      const boxesWithCount = (boxesData || []).map((box: any) => ({
        ...box,
        garment_count: countMap.get(box.id) || 0
      }))

      setGarments(garmentsData || [])
      setBoxes(boxesWithCount)
    } catch (error) {
      console.error('Error loading data:', error)
      setError('Error al cargar los datos')
    } finally {
      setLoading(false)
    }
  }

  // ✅ ACTUALIZAR: Función para manejar la lectura NFC exitosa (agregar a lote)
  const handleNFCRead = async (tagId: string) => {
    // Normalizar el código NFC (limpiar espacios y convertir a mayúsculas)
    const normalizedTagId = tagId.trim().toUpperCase()
    console.log('📱 Código NFC leído:', { original: tagId, normalized: normalizedTagId })
    
    // Agregar al batchCodes (separado por /)
    const newBatchCodes = batchCodes 
      ? `${batchCodes}/${normalizedTagId}`
      : normalizedTagId
    
    setBatchCodes(newBatchCodes)
    batchCodesRef.current = newBatchCodes
    
    // Cerrar el scanner después de leer exitosamente
    setNfcScanMode(null)
    
    // NO buscar automáticamente - el usuario puede agregar más códigos antes de buscar
  }

  // ✅ AGREGAR: Función para buscar prenda por código (extracto de findGarment)
  const findGarmentByCode = async (code: string, mode: 'nfc' | 'barcode') => {
    if (!code.trim()) {
      setError('Ingresa un código para buscar')
      return
    }

    setError('')
    setFoundGarment(null)

    try {
      let query = supabase.from('garments').select('*')

      // Normalizar código NFC (mayúsculas y sin espacios)
      if (mode === 'nfc') {
        const normalizedCode = code.trim().toUpperCase()
        query = query.eq('nfc_tag_id', normalizedCode)
      } else if (mode === 'barcode') {
        query = query.eq('barcode_id', code.trim())
      }

      const { data, error } = await query.single()

      if (error) {
        if (error.code === 'PGRST116') {
          setError(`No se encontró ninguna prenda con ese código ${mode === 'nfc' ? 'NFC' : 'de barras'}`)
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

  // ✅ ACTUALIZAR: Función findGarment para usar findGarmentByCode
  const findGarment = async () => {
    if (!scanInput.trim()) {
      setError('Ingresa un código para buscar')
      return
    }

    await findGarmentByCode(scanInput, scanMode || 'nfc')
  }

  // ✅ AGREGAR: Función para normalizar códigos
  const normalizeCode = (code: string): string => {
    return code.trim().toUpperCase()
  }

  // ✅ AGREGAR: Función optimizada para buscar múltiples prendas por códigos
  const searchBatchGarments = useCallback(async () => {
    const codesToUse = batchCodesRef.current || batchCodes
    
    if (!codesToUse.trim()) {
      setBatchError('Ingresa al menos un código')
      return
    }

    setSearchingBatch(true)
    setBatchError('')
    setFoundGarmentsBatch([])

    try {
      // Separar códigos por "/", espacios, comas, saltos de línea, etc.
      const codes = codesToUse
        .split(/[/,\n\r\t; ]+/)
        .map(code => normalizeCode(code))
        .filter(code => code.length > 0)

      if (codes.length === 0) {
        setBatchError('No se encontraron códigos válidos')
        setSearchingBatch(false)
        return
      }

      // Limitar cantidad de códigos para evitar consultas muy grandes
      const maxCodes = 50
      const codesToSearch = codes.slice(0, maxCodes)
      if (codes.length > maxCodes) {
        setBatchError(`⚠️ Se buscarán solo los primeros ${maxCodes} códigos de ${codes.length} ingresados`)
      }

      console.log('🔍 Buscando códigos:', codesToSearch.length)

      // OPTIMIZACIÓN: Si hay pocos códigos (≤10), usar búsquedas individuales
      // Si hay muchos, usar .in() dividido en chunks
      let garmentsByNfc: Garment[] = []
      let garmentsByBarcode: Garment[] = []
      
      if (codesToSearch.length <= 10) {
        // Para pocos códigos: búsquedas individuales en paralelo
        const nfcQueries = codesToSearch.map(code => 
          supabase
            .from('garments')
            .select('id, name, type, color, season, style, image_url, box_id, nfc_tag_id, barcode_id, status, user_id, created_at')
            .eq('nfc_tag_id', code)
            .maybeSingle()
        )
        
        const barcodeQueries = codesToSearch.map(code =>
          supabase
            .from('garments')
            .select('id, name, type, color, season, style, image_url, box_id, nfc_tag_id, barcode_id, status, user_id, created_at')
            .eq('barcode_id', code)
            .maybeSingle()
        )
        
        const [nfcResults, barcodeResults] = await Promise.all([
          Promise.all(nfcQueries),
          Promise.all(barcodeQueries)
        ])
        
        garmentsByNfc = nfcResults
          .map(r => r.data)
          .filter(Boolean) as Garment[]
        garmentsByBarcode = barcodeResults
          .map(r => r.data)
          .filter(Boolean) as Garment[]
      } else {
        // Para muchos códigos: usar .in() con chunks
        const chunkSize = 20
        const nfcChunks: Promise<{ data: Garment[] | null; error: any }>[] = []
        const barcodeChunks: Promise<{ data: Garment[] | null; error: any }>[] = []
        
        for (let i = 0; i < codesToSearch.length; i += chunkSize) {
          const chunk = codesToSearch.slice(i, i + chunkSize)
          nfcChunks.push(
            supabase
              .from('garments')
              .select('id, name, type, color, season, style, image_url, box_id, nfc_tag_id, barcode_id, status, user_id, created_at')
              .in('nfc_tag_id', chunk)
          )
          barcodeChunks.push(
            supabase
              .from('garments')
              .select('id, name, type, color, season, style, image_url, box_id, nfc_tag_id, barcode_id, status, user_id, created_at')
              .in('barcode_id', chunk)
          )
        }
        
        const [nfcChunkResults, barcodeChunkResults] = await Promise.all([
          Promise.all(nfcChunks),
          Promise.all(barcodeChunks)
        ])
        
        garmentsByNfc = nfcChunkResults
          .flatMap(r => r.data || [])
        garmentsByBarcode = barcodeChunkResults
          .flatMap(r => r.data || [])
      }

      // Combinar resultados y eliminar duplicados
      const allFoundGarments = new Map<string, Garment>()
      
      garmentsByNfc.forEach((garment: Garment) => {
        allFoundGarments.set(garment.id, garment)
      })
      
      garmentsByBarcode.forEach((garment: Garment) => {
        allFoundGarments.set(garment.id, garment)
      })

      const foundGarments = Array.from(allFoundGarments.values())
      
      // Crear un mapa de códigos encontrados
      const foundCodesMap = new Map<string, boolean>()
      foundGarments.forEach(garment => {
        if (garment.nfc_tag_id && codes.includes(garment.nfc_tag_id)) {
          foundCodesMap.set(garment.nfc_tag_id, true)
        }
        if (garment.barcode_id && codes.includes(garment.barcode_id)) {
          foundCodesMap.set(garment.barcode_id, true)
        }
      })

      const notFoundCodes = codes.filter(code => !foundCodesMap.has(code))

      setFoundGarmentsBatch(foundGarments)

      // Mostrar mensajes informativos
      if (notFoundCodes.length > 0 && foundGarments.length === 0) {
        setBatchError(`❌ No se encontraron prendas para los códigos: ${notFoundCodes.join(', ')}`)
      } else if (notFoundCodes.length > 0) {
        setBatchError(`⚠️ Se encontraron ${foundGarments.length} prendas. No se encontraron: ${notFoundCodes.join(', ')}`)
      } else if (foundGarments.length > 0) {
        const inUseCount = foundGarments.filter(g => g.status === 'in_use').length
        if (inUseCount > 0) {
          setBatchError(`ℹ️ Se encontraron ${foundGarments.length} prendas (${inUseCount} en uso - se restaurarán al asignar caja)`)
        } else {
          setBatchError('')
        }
      } else {
        setBatchError('')
      }
    } catch (error) {
      console.error('❌ Error searching batch garments:', error)
      setBatchError(`Error al buscar las prendas: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    } finally {
      setSearchingBatch(false)
    }
  }, [batchCodes])

  // ✅ AGREGAR: Función para asignar caja a todo el lote
  const assignBoxToBatch = async () => {
    if (!selectedBoxForBatch || foundGarmentsBatch.length === 0) {
      setBatchError('Selecciona una caja')
      return
    }

    setAssigningBox(true)
    setBatchError('')

    try {
      // Obtener conteo actualizado de prendas disponibles en la caja seleccionada
      const { count: currentCount } = await supabase
        .from('garments')
        .select('*', { count: 'exact', head: true })
        .eq('box_id', selectedBoxForBatch)
        .eq('status', 'available')

      const currentBoxCount = currentCount || 0
      const garmentsToAssign = foundGarmentsBatch.length
      const newCount = currentBoxCount + garmentsToAssign

      // Si la caja se llenará, buscar la más vacía
      let targetBoxId = selectedBoxForBatch
      if (newCount > 15) {
        // Buscar caja más vacía
        const availableBoxes = boxes
          .filter(box => (box.garment_count || 0) < 15)
          .sort((a, b) => (a.garment_count || 0) - (b.garment_count || 0))
        
        if (availableBoxes.length > 0) {
          targetBoxId = availableBoxes[0].id
        }
      }

      const garmentIds = foundGarmentsBatch.map(g => g.id)
      const inUseGarments = foundGarmentsBatch.filter(g => g.status === 'in_use')

      // Actualizar todas las prendas
      const { error: updateError } = await supabase
        .from('garments')
        .update({
          box_id: targetBoxId,
          status: 'available'
        })
        .in('id', garmentIds)

      if (updateError) throw updateError

      const targetBox = boxes.find(b => b.id === targetBoxId)
      const boxName = targetBox?.name || 'caja desconocida'
      const boxLocation = targetBox?.location

      // Recargar datos
      await loadData()

      // Limpiar estados
      batchCodesRef.current = ''
      setBatchCodes('')
      setFoundGarmentsBatch([])
      setSelectedBoxForBatch('')
      setNfcScanMode(null)
      setScanMode(null)

      setSuccess(
        `✅ ${foundGarmentsBatch.length} prenda(s) asignada(s) a la caja "${boxName}"${boxLocation ? ` (📍 ${boxLocation})` : ''}${inUseGarments.length > 0 ? `. ${inUseGarments.length} restaurada(s).` : ''}`
      )
    } catch (error) {
      console.error('Error assigning box to batch:', error)
      setBatchError(`Error al asignar caja: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    } finally {
      setAssigningBox(false)
    }
  }

  // ✅ AGREGAR: Manejar cambios en el input de códigos
  const handleBatchCodesChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setBatchCodes(newValue)
    batchCodesRef.current = newValue
  }, [])

  // ✅ AGREGAR: Manejar pegado de códigos
  const handleBatchCodesPaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    e.stopPropagation()
    
    const pastedText = e.clipboardData.getData('text')
    const codes = pastedText
      .split(/[\n\r\t,; ]+/)
      .map(code => code.trim())
      .filter(code => code.length > 0)
    
    let newValue: string
    if (codes.length > 1) {
      newValue = batchCodes 
        ? `${batchCodes}/${codes.join('/')}`
        : codes.join('/')
    } else if (codes.length === 1) {
      newValue = batchCodes && codes[0]
        ? `${batchCodes}/${codes[0]}`
        : codes[0] || ''
    } else {
      newValue = batchCodes
    }
    
    batchCodesRef.current = newValue
    setBatchCodes(newValue)
  }, [batchCodes])

  // ✅ AGREGAR: Contador de códigos detectados
  const detectedCodesCount = useMemo(() => {
    if (!batchCodes.trim()) return 0
    return batchCodes.split(/[/,\n\r\t; ]+/).filter(c => c.trim().length > 0).length
  }, [batchCodes])

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

  // Función para encontrar la caja más vacía disponible
  const findMostEmptyBox = (): Box | null => {
    if (!boxes || boxes.length === 0) return null
    
    // Filtrar cajas que no están llenas y ordenar por cantidad de prendas (ascendente)
    const availableBoxes = boxes
      .filter(box => (box.garment_count || 0) < 15)
      .sort((a, b) => (a.garment_count || 0) - (b.garment_count || 0))
    
    return availableBoxes.length > 0 ? availableBoxes[0] : null
  }

  // Función para mover prenda entre cajas
  const moveGarment = async (garmentId: string, targetBoxId: string | null) => {
    try {
      // Si se está moviendo a una caja (no removiendo), verificar capacidad
      if (targetBoxId) {
        const targetBox = boxes.find(b => b.id === targetBoxId)
        if (targetBox && (targetBox.garment_count || 0) >= 15) {
          const mostEmptyBox = findMostEmptyBox()
          if (mostEmptyBox) {
            setError(`❌ Esta caja está llena (máximo 15 prendas). Te recomendamos usar la caja "${mostEmptyBox.name}" que tiene ${mostEmptyBox.garment_count || 0} prendas.`)
          } else {
            setError('❌ Esta caja está llena (máximo 15 prendas) y no hay otras cajas disponibles.')
          }
          return
        }
      }

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
        const mostEmptyBox = findMostEmptyBox()
        if (mostEmptyBox) {
          setError(`❌ Esta caja está llena (máximo 15 prendas). Te recomendamos usar la caja "${mostEmptyBox.name}" que tiene ${mostEmptyBox.garment_count || 0} prendas.`)
        } else {
          setError('❌ Esta caja está llena (máximo 15 prendas) y no hay otras cajas disponibles.')
        }
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
          ) : scanMode === 'nfc' ? (
            // ✅ ACTUALIZAR: Input de múltiples códigos con opción de escanear
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  📱 Códigos NFC o Barcode (separados por "/")
                </label>
                <div className="flex gap-2">
                  <Input
                    value={batchCodes}
                    onChange={handleBatchCodesChange}
                    onPaste={handleBatchCodesPaste}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        if (batchCodesRef.current.trim() && !searchingBatch) {
                          searchBatchGarments()
                        }
                      }
                    }}
                    placeholder="Ej: AA:11:22:BB:EE / 123456789 / CC:33:44:DD:FF"
                    className="font-mono text-sm flex-1"
                    autoFocus
                  />
                  <Button
                    variant="outline"
                    onClick={() => setNfcScanMode('scanner')}
                    size="lg"
                    title="Escanear con teléfono"
                  >
                    <Smartphone className="h-5 w-5" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  💡 Puedes pegar múltiples códigos separados por "/", comas, espacios o saltos de línea. También puedes escanear con el botón 📱.
                </p>
                {batchCodes && (
                  <div className="text-xs text-muted-foreground p-2 bg-muted rounded mt-2">
                    <strong>Códigos detectados:</strong> {detectedCodesCount}
                  </div>
                )}
              </div>

              {batchError && (
                <div className={`p-3 rounded-lg border ${
                  batchError.includes('❌') 
                    ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                    : 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800'
                }`}>
                  <p className={`text-sm ${
                    batchError.includes('❌')
                      ? 'text-red-700 dark:text-red-300'
                      : 'text-yellow-700 dark:text-yellow-300'
                  }`}>{batchError}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button 
                  onClick={searchBatchGarments} 
                  size="lg" 
                  className="flex-1"
                  disabled={searchingBatch || !batchCodes.trim()}
                >
                  {searchingBatch ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Buscando...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Buscar Prendas
                    </>
                  )}
                </Button>
                <Button 
                  onClick={() => { 
                    setScanMode(null)
                    setNfcScanMode(null)
                    setBatchCodes('')
                    batchCodesRef.current = ''
                    setFoundGarmentsBatch([])
                    setSelectedBoxForBatch('')
                    setBatchError('')
                    setError('')
                    setSuccess('')
                  }} 
                  variant="outline" 
                  size="lg"
                >
                  Cancelar
                </Button>
              </div>

              {/* Scanner NFC (si está activo) */}
              {nfcScanMode === 'scanner' && (
                <div className="border-t pt-4">
                  <NFCScanner
                    mode="read"
                    onSuccess={handleNFCRead}
                    onError={(error) => {
                      setBatchError(`Error NFC: ${error}`)
                    }}
                    title="Escanear Tag NFC"
                    description="Acércate un tag NFC para agregarlo a la lista de códigos"
                  />
                  <Button 
                    onClick={() => { 
                      setNfcScanMode(null)
                      setBatchError('')
                    }} 
                    variant="outline" 
                    size="lg"
                    className="w-full mt-2"
                  >
                    Cerrar Scanner
                  </Button>
                </div>
              )}

              {/* Lista de prendas encontradas */}
              {foundGarmentsBatch.length > 0 && (
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">
                      Prendas Encontradas ({foundGarmentsBatch.length})
                    </h3>
                  </div>
                  
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {foundGarmentsBatch.map(garment => {
                      const isInUse = garment.status === 'in_use'
                      return (
                        <Card 
                          key={garment.id} 
                          className={`p-3 ${isInUse ? 'border-yellow-400 dark:border-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20' : ''}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                              {garment.image_url ? (
                                <Image
                                  src={garment.image_url}
                                  alt={garment.name}
                                  width={64}
                                  height={64}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Shirt className="h-6 w-6 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium truncate">{garment.name}</p>
                                {isInUse && (
                                  <Badge variant="destructive" className="text-xs">
                                    En Uso
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">{garment.type}</p>
                              {garment.nfc_tag_id && (
                                <p className="text-xs text-muted-foreground font-mono">NFC: {garment.nfc_tag_id}</p>
                              )}
                              {garment.barcode_id && (
                                <p className="text-xs text-muted-foreground font-mono">Barcode: {garment.barcode_id}</p>
                              )}
                            </div>
                          </div>
                        </Card>
                      )
                    })}
                  </div>

                  {/* Selector de caja para asignar al lote */}
                  {foundGarmentsBatch.length > 0 && (
                    <div className="space-y-3 border-t pt-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          Asignar caja a todo el lote
                        </label>
                        {foundGarmentsBatch.filter(g => g.status === 'in_use').length > 0 && (
                          <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-2">
                            ⚠️ {foundGarmentsBatch.filter(g => g.status === 'in_use').length} prenda(s) se restaurarán
                          </p>
                        )}
                        <Select
                          value={selectedBoxForBatch}
                          onValueChange={(value) => {
                            setSelectedBoxForBatch(value)
                            const box = boxes.find(b => b.id === value)
                            if (box) {
                              const availableSpace = 15 - (box.garment_count || 0)
                              const willFit = foundGarmentsBatch.length <= availableSpace
                              setSelectedBoxInfo({
                                name: box.name,
                                location: box.location || undefined,
                                currentCount: box.garment_count || 0,
                                availableSpace
                              })
                              setHasEnoughSpace(willFit)
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona una caja" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin caja</SelectItem>
                            {boxes.map((box) => {
                              const availableSpace = 15 - (box.garment_count || 0)
                              const isFull = (box.garment_count || 0) >= 15
                              const willFit = foundGarmentsBatch.length <= availableSpace
                              return (
                                <SelectItem 
                                  key={box.id} 
                                  value={box.id}
                                  disabled={isFull || !willFit}
                                >
                                  {box.name} {box.location ? `(${box.location})` : ''} - {box.garment_count || 0}/15
                                  {!isFull && !willFit && ` - NO CABEN ${foundGarmentsBatch.length} prendas`}
                                </SelectItem>
                              )
                            })}
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedBoxInfo && selectedBoxForBatch && selectedBoxForBatch !== 'none' && (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            {hasEnoughSpace
                              ? `✅ Asignarás ${foundGarmentsBatch.length} prenda(s) a la caja "${selectedBoxInfo.name}"${selectedBoxInfo.location ? ` (📍 ${selectedBoxInfo.location})` : ''}. Quedarán ${selectedBoxInfo.availableSpace - foundGarmentsBatch.length} espacios disponibles.`
                              : `❌ No hay suficiente espacio. Disponible: ${selectedBoxInfo.availableSpace} prendas, Necesitas: ${foundGarmentsBatch.length} prendas`
                            }
                          </AlertDescription>
                        </Alert>
                      )}

                      <Button
                        onClick={assignBoxToBatch}
                        disabled={assigningBox || !selectedBoxForBatch || selectedBoxForBatch === 'none' || !hasEnoughSpace}
                        size="lg"
                        className="w-full"
                      >
                        {assigningBox ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Asignando...
                          </>
                        ) : (
                          <>
                            <Package className="h-4 w-4 mr-2" />
                            Asignar Caja al Lote
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            // ✅ MANTENER: Input para código de barras
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  📊 Código de Barras
                </label>
                <Input
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      findGarment()
                    }
                  }}
                  placeholder="Ej: 1234567890123 o escanea el código"
                  className="font-mono text-lg h-12"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Ingresa el código de barras manualmente o usa un escáner
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
                    setNfcScanMode(null)
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
                  <Image
                    src={foundGarment.image_url}
                    alt={foundGarment.name}
                    width={64}
                    height={64}
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
                            <Image
                              src={garment.image_url}
                              alt={garment.name}
                              width={64}
                              height={64}
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
