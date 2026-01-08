'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DemoBanner } from '@/components/ui/demo-banner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { NFCScanner } from '@/components/nfc/nfc-scanner'
import { Plus, Search, Shirt, Package, Filter, Smartphone, Scan, Hand, Sparkles, CheckCircle, AlertCircle } from 'lucide-react'
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
  const [batchCodes, setBatchCodes] = useState<string>('')
  const [foundGarmentsBatch, setFoundGarmentsBatch] = useState<Garment[]>([])
  const [searchingBatch, setSearchingBatch] = useState(false)
  const [selectedBoxForBatch, setSelectedBoxForBatch] = useState<string>('')
  const [assigningBox, setAssigningBox] = useState(false)
  const [hasEnoughSpace, setHasEnoughSpace] = useState(true)
  const [selectedBoxInfo, setSelectedBoxInfo] = useState<{ name: string; location?: string; currentCount: number; availableSpace: number } | null>(null)

  // Refs para optimizar escritura rápida de Scanner Keyboard
  const batchCodesRef = useRef<string>('')
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastChangeTimeRef = useRef<number>(0)

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

      // OPTIMIZACIÓN: Obtener todos los conteos en una sola consulta
      const { data: garmentsData } = await supabase
        .from('garments')
        .select('box_id')
        .eq('status', 'available')
        .not('box_id', 'is', null)

      // Crear mapa de conteos
      const countMap = new Map<string, number>()
      if (garmentsData) {
        garmentsData.forEach((item: any) => {
          if (item.box_id) {
            countMap.set(item.box_id, (countMap.get(item.box_id) || 0) + 1)
          }
        })
      }

      // Combinar datos con conteos
      const boxesWithCount = (data || []).map((box: any) => ({
        ...box,
        garment_count: countMap.get(box.id) || 0
      }))

      const boxesData: Box[] = boxesWithCount
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

  // Función para normalizar códigos (igual que cuando se guardan)
  const normalizeCode = (code: string): string => {
    return code.trim().toUpperCase()
  }

  // Función optimizada para buscar múltiples prendas por códigos
  const searchBatchGarments = async () => {
    // Usar el valor del ref si está más actualizado (para Scanner Keyboard)
    const codesToUse = batchCodesRef.current || batchCodes
    
    if (!codesToUse.trim()) {
      setNfcError('Ingresa al menos un código')
      return
    }

    setSearchingBatch(true)
    setNfcError('')
    setFoundGarmentsBatch([])

    try {
      // Separar códigos por "/", espacios, comas, saltos de línea, etc.
      const codes = codesToUse
        .split(/[/,\n\r\t; ]+/)
        .map(code => normalizeCode(code))
        .filter(code => code.length > 0)

      if (codes.length === 0) {
        setNfcError('No se encontraron códigos válidos')
        setSearchingBatch(false)
        return
      }

      // Limitar cantidad de códigos para evitar consultas muy grandes
      const maxCodes = 50
      const codesToSearch = codes.slice(0, maxCodes)
      if (codes.length > maxCodes) {
        setNfcError(`⚠️ Se buscarán solo los primeros ${maxCodes} códigos de ${codes.length} ingresados`)
      }

      console.log('🔍 Buscando códigos (optimizado):', codesToSearch.length)
      console.time('🔍 Tiempo de búsqueda total')

      // OPTIMIZACIÓN: Si hay pocos códigos (≤10), usar búsquedas individuales (más rápido con índices)
      // Si hay muchos, usar .in() dividido en chunks para mejor uso de índices
      let garmentsByNfc: Garment[] = []
      let garmentsByBarcode: Garment[] = []
      
      if (codesToSearch.length <= 10) {
        // Para pocos códigos: búsquedas individuales en paralelo (más rápido con índices)
        console.log('⚡ Usando búsquedas individuales (optimizado para pocos códigos)')
        
        const nfcQueries = codesToSearch.map(code => 
          supabase
            .from('garments')
            .select('id, name, type, color, season, style, image_url, box_id, nfc_tag_id, barcode_id, status, usage_count, last_used, created_at, user_id')
            .eq('nfc_tag_id', code)
            .maybeSingle()
        )
        
        const barcodeQueries = codesToSearch.map(code =>
          supabase
            .from('garments')
            .select('id, name, type, color, season, style, image_url, box_id, nfc_tag_id, barcode_id, status, usage_count, last_used, created_at, user_id')
            .eq('barcode_id', code)
            .maybeSingle()
        )
        
        console.time('⚡ Búsquedas paralelas')
        const [nfcResults, barcodeResults] = await Promise.all([
          Promise.all(nfcQueries),
          Promise.all(barcodeQueries)
        ])
        console.timeEnd('⚡ Búsquedas paralelas')
        
        garmentsByNfc = nfcResults
          .map(r => r.data)
          .filter(Boolean) as Garment[]
        garmentsByBarcode = barcodeResults
          .map(r => r.data)
          .filter(Boolean) as Garment[]
      } else {
        // Para muchos códigos: usar .in() con chunks más pequeños para mejor rendimiento
        console.log('⚡ Usando búsquedas en lote con chunks (optimizado para muchos códigos)')
        
        // Dividir en chunks de 20 para mejorar el uso de índices
        const chunkSize = 20
        const nfcChunks: Promise<{ data: Garment[] | null; error: any }>[] = []
        const barcodeChunks: Promise<{ data: Garment[] | null; error: any }>[] = []
        
        for (let i = 0; i < codesToSearch.length; i += chunkSize) {
          const chunk = codesToSearch.slice(i, i + chunkSize)
          nfcChunks.push(
            supabase
              .from('garments')
              .select('id, name, type, color, season, style, image_url, box_id, nfc_tag_id, barcode_id, status, usage_count, last_used, created_at, user_id')
              .in('nfc_tag_id', chunk)
          )
          barcodeChunks.push(
            supabase
              .from('garments')
              .select('id, name, type, color, season, style, image_url, box_id, nfc_tag_id, barcode_id, status, usage_count, last_used, created_at, user_id')
              .in('barcode_id', chunk)
          )
        }
        
        console.time('⚡ Búsquedas en chunks')
        const [nfcChunkResults, barcodeChunkResults] = await Promise.all([
          Promise.all(nfcChunks),
          Promise.all(barcodeChunks)
        ])
        console.timeEnd('⚡ Búsquedas en chunks')
        
        // Verificar errores en los resultados
        nfcChunkResults.forEach((result, index) => {
          if (result.error) {
            console.error(`Error en chunk NFC ${index}:`, result.error)
          }
        })
        barcodeChunkResults.forEach((result, index) => {
          if (result.error) {
            console.error(`Error en chunk Barcode ${index}:`, result.error)
          }
        })
        
        garmentsByNfc = nfcChunkResults
          .flatMap(r => r.data || [])
        garmentsByBarcode = barcodeChunkResults
          .flatMap(r => r.data || [])
      }

      console.timeEnd('🔍 Tiempo de búsqueda total')

      // Combinar resultados y eliminar duplicados
      const allFoundGarments = new Map<string, Garment>()
      
      garmentsByNfc.forEach((garment: Garment) => {
        allFoundGarments.set(garment.id, garment)
      })
      
      garmentsByBarcode.forEach((garment: Garment) => {
        allFoundGarments.set(garment.id, garment)
      })

      const foundGarments = Array.from(allFoundGarments.values())
      
      // Crear un mapa de códigos encontrados para identificar cuáles no se encontraron
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

      console.log('📊 Resumen de búsqueda (optimizado):', {
        totalCodes: codes.length,
        found: foundGarments.length,
        notFound: notFoundCodes.length,
        nfcFound: garmentsByNfc.length,
        barcodeFound: garmentsByBarcode.length
      })

      setFoundGarmentsBatch(foundGarments)

      // Mostrar mensajes informativos
      if (notFoundCodes.length > 0 && foundGarments.length === 0) {
        setNfcError(`❌ No se encontraron prendas para los códigos: ${notFoundCodes.join(', ')}`)
      } else if (notFoundCodes.length > 0) {
        setNfcError(`⚠️ Se encontraron ${foundGarments.length} prendas. No se encontraron: ${notFoundCodes.join(', ')}`)
      } else if (foundGarments.length > 0) {
        const inUseCount = foundGarments.filter(g => g.status === 'in_use').length
        if (inUseCount > 0) {
          setNfcError(`ℹ️ Se encontraron ${foundGarments.length} prendas (${inUseCount} en uso - se restaurarán al asignar caja)`)
        } else {
          setNfcError('')
        }
      } else {
        setNfcError('')
      }
    } catch (error) {
      console.error('❌ Error searching batch garments:', error)
      setNfcError(`Error al buscar las prendas: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    } finally {
      setSearchingBatch(false)
    }
  }

  // Función para encontrar la caja más vacía disponible
  const findMostEmptyBox = async (): Promise<Box | null> => {
    if (!boxes || boxes.length === 0) return null
    
    // Obtener conteos actualizados de todas las cajas
    const boxesWithCount = await Promise.all(
      boxes.map(async (box) => {
        const { count, error: countError } = await supabase
          .from('garments')
          .select('*', { count: 'exact', head: true })
          .eq('box_id', box.id)
          .eq('status', 'available')
        
        if (countError) {
          console.error('Error counting garments for box:', box.id, countError)
          return { ...box, garment_count: 0 }
        }
        
        return { ...box, garment_count: count || 0 }
      })
    )
    
    // Filtrar cajas que no están llenas y ordenar por cantidad de prendas (ascendente)
    const availableBoxes = boxesWithCount
      .filter(box => (box.garment_count || 0) < 15)
      .sort((a, b) => (a.garment_count || 0) - (b.garment_count || 0))
    
    return availableBoxes.length > 0 ? availableBoxes[0] : null
  }

  // Función para asignar caja a todo el lote (y restaurar prendas en uso)
  const assignBoxToBatch = async () => {
    if (!selectedBoxForBatch || foundGarmentsBatch.length === 0) {
      setNfcError('Selecciona una caja')
      return
    }

    setAssigningBox(true)
    setNfcError('')

    try {
      // Obtener conteo actualizado de prendas disponibles en la caja seleccionada
      const { count: currentCount } = await supabase
        .from('garments')
        .select('*', { count: 'exact', head: true })
        .eq('box_id', selectedBoxForBatch)
        .eq('status', 'available')

      const currentBoxCount = currentCount || 0
      // Contar todas las prendas que se van a asignar (incluyendo las que están en uso)
      const garmentsToAssign = foundGarmentsBatch.length
      const newCount = currentBoxCount + garmentsToAssign

      // Determinar la caja a usar
      let targetBoxId = selectedBoxForBatch
      let boxChanged = false

      // Si la caja seleccionada está llena o se llenará, buscar la más vacía
      if (newCount > 15) {
        console.log(`⚠️ Caja seleccionada se llenará (${newCount} > 15), buscando caja más vacía...`)
        const mostEmptyBox = await findMostEmptyBox()
        
        if (mostEmptyBox) {
          // Verificar que la caja más vacía tenga espacio
          const { count: emptyBoxCount } = await supabase
            .from('garments')
            .select('*', { count: 'exact', head: true })
            .eq('box_id', mostEmptyBox.id)
            .eq('status', 'available')
          
          const emptyBoxCurrentCount = emptyBoxCount || 0
          const emptyBoxNewCount = emptyBoxCurrentCount + garmentsToAssign
          
          if (emptyBoxNewCount <= 15) {
            targetBoxId = mostEmptyBox.id
            boxChanged = true
            console.log(`✅ Cambiando a caja más vacía: "${mostEmptyBox.name}" (${emptyBoxCurrentCount} prendas)`)
          } else {
            // Si incluso la más vacía se llenaría, dividir entre múltiples cajas o mostrar error
            setNfcError(`❌ No hay cajas con suficiente espacio. Se necesitan ${garmentsToAssign} espacios pero la caja más vacía solo tiene ${15 - emptyBoxCurrentCount} espacios disponibles.`)
            setAssigningBox(false)
            return
          }
        } else {
          setNfcError('❌ No hay cajas disponibles con espacio suficiente.')
          setAssigningBox(false)
          return
        }
      }

      const garmentIds = foundGarmentsBatch.map(g => g.id)
      const inUseGarments = foundGarmentsBatch.filter(g => g.status === 'in_use')
      
      // Actualizar todas las prendas: asignar caja y restaurar las que están en uso
      // IMPORTANTE: No modificar nfc_tag_id ni barcode_id, solo box_id y status
      const { error } = await supabase
        .from('garments')
        .update({
          box_id: targetBoxId,
          status: 'available', // Restaurar todas las prendas a 'available'
          updated_at: new Date().toISOString()
        })
        .in('id', garmentIds)

      if (error) {
        console.error('Error updating garments:', error)
        throw error
      }

      // Verificar que los códigos no se perdieron
      const { data: updatedGarments } = await supabase
        .from('garments')
        .select('id, nfc_tag_id, barcode_id, name')
        .in('id', garmentIds)

      // Verificar que los códigos se mantuvieron
      const lostCodes = updatedGarments?.filter((g: Garment) => {
        const original = foundGarmentsBatch.find((og: Garment) => og.id === g.id)
        if (!original) return false
        return (original.nfc_tag_id && !g.nfc_tag_id) || (original.barcode_id && !g.barcode_id)
      })

      if (lostCodes && lostCodes.length > 0) {
        console.error('❌ ERROR: Se perdieron códigos en las prendas:', lostCodes)
        setNfcError(`⚠️ Advertencia: Algunas prendas perdieron sus códigos. Por favor verifica.`)
      }

      const targetBox = boxes.find(b => b.id === targetBoxId)
      const boxName = targetBox?.name || 'caja seleccionada'
      const boxLocation = (targetBox as any)?.location

      console.log(`✅ ${foundGarmentsBatch.length} prendas actualizadas (${inUseGarments.length} restauradas de "en uso") en "${boxName}"`)

      // Recargar datos
      await fetchGarments()
      await fetchBoxes()

      // Limpiar estados
      batchCodesRef.current = ''
      setBatchCodes('')
      setFoundGarmentsBatch([])
      setSelectedBoxForBatch('')
      setSelectedBoxInfo(null)
      setHasEnoughSpace(true)
      setShowNFCScanner(false)
      setNfcError('')
      
      // Mostrar mensaje de éxito mejorado y claro
      const alertMessage = `✅ ASIGNACIÓN COMPLETADA\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📦 CAJA: ${boxName}\n` +
        (boxLocation ? `📍 UBICACIÓN: ${boxLocation}\n` : '') +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `✅ ${foundGarmentsBatch.length} prenda(s) asignada(s)\n` +
        (inUseGarments.length > 0 ? `✅ ${inUseGarments.length} prenda(s) restaurada(s) del estado "en uso"\n` : '') +
        (boxChanged ? `\n⚠️ Nota: Se asignó automáticamente a la caja más vacía disponible` : '')
      
      alert(alertMessage)
      
      // También mostrar en la UI con un mensaje persistente y claro
      setNfcError(`✅ ${foundGarmentsBatch.length} prenda(s) asignada(s) a la caja "${boxName}"${boxLocation ? ` (📍 ${boxLocation})` : ''}${inUseGarments.length > 0 ? `. ${inUseGarments.length} restaurada(s).` : ''}`)
    } catch (error) {
      console.error('Error assigning box to batch:', error)
      setNfcError(`Error al asignar la caja: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    } finally {
      setAssigningBox(false)
    }
  }

  // Manejar cambios en el input con optimización para Scanner Keyboard
  const handleBatchCodesChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    
    // SIEMPRE actualizar el estado inmediatamente para que el input muestre todos los caracteres
    // Esto es crítico para Scanner Keyboard que escribe rápido
    setBatchCodes(newValue)
    
    // Actualizar la referencia inmediatamente con el valor completo del input
    batchCodesRef.current = newValue
    
    // Limpiar cualquier debounce pendiente cuando hay cambios
    // El debounce solo se usaría para optimizar cálculos pesados, no para actualizar el input
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    
    lastChangeTimeRef.current = Date.now()
  }, [])

  // Manejar pegado de códigos con separador automático (optimizado)
  const handleBatchCodesPaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    e.stopPropagation()
    
    const pastedText = e.clipboardData.getData('text')
    
    // Limpiar cualquier debounce pendiente cuando hay un pegado real
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    
    // Procesar el texto pegado
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
    lastChangeTimeRef.current = Date.now()
  }, [batchCodes])

  // Optimizar el cálculo de códigos detectados
  const detectedCodesCount = useMemo(() => {
    if (!batchCodes.trim()) return 0
    return batchCodes.split(/[/,\n\r\t; ]+/).filter(c => c.trim().length > 0).length
  }, [batchCodes])

  // Limpiar timer al desmontar
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

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
                      <div className="h-20 sm:h-24 bg-muted rounded mb-1 sm:mb-2 flex items-center justify-center overflow-hidden">
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
                        onClick={(e) => {
                          e.stopPropagation()
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
          {filteredGarments.map(garment => {
            const hasNoBox = !garment.box_id
            return (
            <Card 
              key={garment.id} 
              className={`group hover:shadow-lg transition-shadow ${
                userProfile?.role === 'admin' ? 'cursor-pointer' : ''
              } ${
                hasNoBox ? 'border-2 border-yellow-400 dark:border-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20' : ''
              }`}
              onClick={() => {
                if (userProfile?.role === 'admin') {
                  setEditingGarment(garment)
                  setShowEditModal(true)
                }
              }}
            >
              <CardHeader className="pb-3">
                <div className="h-32 bg-muted rounded-lg mb-3 flex items-center justify-center overflow-hidden">
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
                  <div className="flex items-center gap-1 flex-wrap">
                    <Package className="h-3 w-3" />
                    <span className="font-medium">{getBoxName(garment.box_id)}</span>
                    {hasNoBox && (
                      <Badge variant="destructive" className="ml-1 bg-yellow-500 hover:bg-yellow-600 text-yellow-950 dark:text-yellow-100 border-yellow-600">
                        Sin caja
                      </Badge>
                    )}
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
                    <Badge variant="outline" className="flex items-center gap-1 font-mono text-xs">
                      <Smartphone className="h-3 w-3" />
                      NFC: {garment.nfc_tag_id}
                    </Badge>
                  )}
                  {garment.barcode_id && (
                    <Badge variant="outline" className="flex items-center gap-1 font-mono text-xs">
                      📱 Barcode: {garment.barcode_id}
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
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveFromSearchList(garment.id)
                      }}
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
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAddToSearchList(garment.id)
                      }}
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
            )
          })}
        </div>
      )}

      {/* NFC Scanner Dialog */}
      <Dialog open={showNFCScanner} onOpenChange={(open) => {
        setShowNFCScanner(open)
        if (!open) {
          batchCodesRef.current = ''
          setBatchCodes('')
          setFoundGarmentsBatch([])
          setSelectedBoxForBatch('')
          setNfcError('')
          // Limpiar cualquier debounce pendiente
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
            debounceTimerRef.current = null
          }
        }
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {userProfile?.role === 'admin' ? 'Buscar Prendas por Código' : 'Escanear Prenda NFC'}
            </DialogTitle>
            <DialogDescription>
              {userProfile?.role === 'admin' 
                ? 'Ingresa códigos NFC o barcode separados por "/" para buscar múltiples prendas'
                : 'Acércate un tag NFC de una prenda para identificarla'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {userProfile?.role === 'admin' ? (
              <>
                {/* Entrada manual de múltiples códigos para admin */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Códigos (NFC o Barcode) - Separa con "/", comas o espacios
                  </label>
                  <Input
                    value={batchCodes}
                    onChange={handleBatchCodesChange}
                    onPaste={handleBatchCodesPaste}
                    onKeyDown={(e) => {
                      // Prevenir Enter automático si Scanner Keyboard lo envía
                      // Solo permitir búsqueda con Enter si el usuario lo presiona explícitamente después de escribir
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        // Si hay texto y no está buscando, buscar inmediatamente usando el ref
                        // El ref siempre tiene el valor más actualizado
                        if (batchCodesRef.current.trim() && !searchingBatch) {
                          // Forzar actualización final del estado antes de buscar
                          if (debounceTimerRef.current) {
                            clearTimeout(debounceTimerRef.current)
                            debounceTimerRef.current = null
                          }
                          // Sincronizar el estado con el ref antes de buscar
                          if (batchCodesRef.current !== batchCodes) {
                            setBatchCodes(batchCodesRef.current)
                            // Esperar un momento para que el estado se actualice
                            setTimeout(() => {
                              searchBatchGarments()
                            }, 10)
                          } else {
                            // Si ya está sincronizado, buscar inmediatamente
                            searchBatchGarments()
                          }
                        }
                      }
                    }}
                    placeholder="Ej: AA:11:22:BB:EE / 123456789 / CC:33:44:DD:FF"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    💡 Puedes pegar múltiples códigos separados por "/", comas, espacios o saltos de línea. Se normalizarán automáticamente.
                  </p>
                  {batchCodes && (
                    <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
                      <strong>Códigos detectados:</strong> {detectedCodesCount}
                    </div>
                  )}
                </div>

                <Button
                  onClick={searchBatchGarments}
                  disabled={searchingBatch || !batchCodes.trim()}
                  className="w-full"
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

                {nfcError && (
                  <div className={`p-3 rounded-lg border ${
                    nfcError.includes('❌') 
                      ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                      : 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800'
                  }`}>
                    <p className={`text-sm ${
                      nfcError.includes('❌')
                        ? 'text-red-700 dark:text-red-300'
                        : 'text-yellow-700 dark:text-yellow-300'
                    }`}>{nfcError}</p>
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
                                  <img
                                    src={garment.image_url}
                                    alt={garment.name}
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
                                <div className="flex gap-2 mt-1 flex-wrap">
                                  {garment.nfc_tag_id && (
                                    <Badge variant="outline" className="text-xs font-mono">
                                      NFC: {garment.nfc_tag_id}
                                    </Badge>
                                  )}
                                  {garment.barcode_id && (
                                    <Badge variant="outline" className="text-xs font-mono">
                                      📱 {garment.barcode_id}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="text-sm text-muted-foreground text-right">
                                <div>{getBoxName(garment.box_id)}</div>
                                {isInUse && (
                                  <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                                    Se restaurará
                                  </div>
                                )}
                              </div>
                            </div>
                          </Card>
                        )
                      })}
                    </div>

                    {/* Selector de caja para asignar al lote */}
                    <div className="space-y-2 border-t pt-4">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">
                          Asignar caja a todo el lote
                        </label>
                        {foundGarmentsBatch.filter(g => g.status === 'in_use').length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {foundGarmentsBatch.filter(g => g.status === 'in_use').length} prenda(s) se restaurarán
                          </Badge>
                        )}
                      </div>
                      <Select
                        value={selectedBoxForBatch}
                        onValueChange={async (value) => {
                          setSelectedBoxForBatch(value)
                          
                          if (value && value !== 'none') {
                            // Verificar capacidad de la caja seleccionada
                            const { count } = await supabase
                              .from('garments')
                              .select('*', { count: 'exact', head: true })
                              .eq('box_id', value)
                              .eq('status', 'available')
                            
                            const currentCount = count || 0
                            const garmentsToAssign = foundGarmentsBatch.length
                            const availableSpace = 15 - currentCount
                            const willFit = garmentsToAssign <= availableSpace
                            
                            const box = boxes.find(b => b.id === value)
                            setSelectedBoxInfo(box ? {
                              name: box.name,
                              location: (box as any).location,
                              currentCount,
                              availableSpace
                            } : null)
                            setHasEnoughSpace(willFit)
                            
                            // Si no cabe, buscar la caja más vacía automáticamente
                            if (!willFit) {
                              const mostEmptyBox = await findMostEmptyBox()
                              if (mostEmptyBox) {
                                const { count: emptyCount } = await supabase
                                  .from('garments')
                                  .select('*', { count: 'exact', head: true })
                                  .eq('box_id', mostEmptyBox.id)
                                  .eq('status', 'available')
                                
                                const emptyCurrentCount = emptyCount || 0
                                const emptyAvailableSpace = 15 - emptyCurrentCount
                                
                                if (garmentsToAssign <= emptyAvailableSpace) {
                                  setSelectedBoxForBatch(mostEmptyBox.id)
                                  setSelectedBoxInfo({
                                    name: mostEmptyBox.name,
                                    location: (mostEmptyBox as any).location,
                                    currentCount: emptyCurrentCount,
                                    availableSpace: emptyAvailableSpace
                                  })
                                  setHasEnoughSpace(true)
                                }
                              }
                            }
                          } else {
                            setSelectedBoxInfo(null)
                            setHasEnoughSpace(true)
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una caja (opcional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin caja</SelectItem>
                          {boxes.map(box => {
                            const count = (box as any).garment_count ?? 0
                            const isFull = count >= 15
                            const availableSpace = 15 - count
                            const willFit = foundGarmentsBatch.length <= availableSpace
                            
                            return (
                              <SelectItem 
                                key={box.id} 
                                value={box.id}
                                disabled={isFull || !willFit}
                                className={isFull || !willFit ? 'opacity-50' : ''}
                              >
                                {box.name} {count > 0 && `(${count}/15)`} 
                                {isFull && ' - LLENA'}
                                {!isFull && !willFit && ` - NO CABEN ${foundGarmentsBatch.length} prendas`}
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                      
                      {/* Información de la caja seleccionada */}
                      {selectedBoxInfo && selectedBoxForBatch && selectedBoxForBatch !== 'none' && (
                        <div className={`p-4 rounded-lg border-2 ${
                          hasEnoughSpace 
                            ? 'bg-green-50 dark:bg-green-950 border-green-400 dark:border-green-600' 
                            : 'bg-red-50 dark:bg-red-950 border-red-400 dark:border-red-600'
                        }`}>
                          <div className="flex items-start gap-3">
                            {hasEnoughSpace ? (
                              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                            ) : (
                              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                            )}
                            <div className="flex-1">
                              <p className={`font-bold text-xl mb-2 ${
                                hasEnoughSpace 
                                  ? 'text-green-900 dark:text-green-100' 
                                  : 'text-red-900 dark:text-red-100'
                              }`}>
                                📦 {selectedBoxInfo.name}
                              </p>
                              {selectedBoxInfo.location && (
                                <p className={`text-base font-semibold mb-2 ${
                                  hasEnoughSpace 
                                    ? 'text-green-800 dark:text-green-200' 
                                    : 'text-red-800 dark:text-red-200'
                                }`}>
                                  📍 Ubicación: <span className="underline">{selectedBoxInfo.location}</span>
                                </p>
                              )}
                              <p className={`text-sm ${
                                hasEnoughSpace 
                                  ? 'text-green-700 dark:text-green-300' 
                                  : 'text-red-700 dark:text-red-300'
                              }`}>
                                {hasEnoughSpace 
                                  ? `✅ Espacio disponible: ${selectedBoxInfo.availableSpace} prendas (${selectedBoxInfo.currentCount}/15 ocupadas)`
                                  : `❌ No hay suficiente espacio. Disponible: ${selectedBoxInfo.availableSpace} prendas, Necesitas: ${foundGarmentsBatch.length} prendas`
                                }
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <Button
                        onClick={assignBoxToBatch}
                        disabled={assigningBox || !selectedBoxForBatch || selectedBoxForBatch === 'none' || !hasEnoughSpace}
                        className={`w-full ${
                          !hasEnoughSpace ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        {assigningBox ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Asignando...
                          </>
                        ) : !hasEnoughSpace ? (
                          <>
                            <AlertCircle className="h-4 w-4 mr-2" />
                            No hay espacio suficiente
                          </>
                        ) : (
                          <>
                            <Package className="h-4 w-4 mr-2" />
                            Asignar Caja al Lote
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Escáner NFC normal para usuarios */}
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
              </>
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
                    <Badge variant="outline" className="flex items-center gap-1 font-mono text-xs">
                      <Smartphone className="h-3 w-3" />
                      NFC: {foundGarment.nfc_tag_id}
                    </Badge>
                    {foundGarment.barcode_id && (
                      <Badge variant="outline" className="flex items-center gap-1 font-mono text-xs">
                        📱 Barcode: {foundGarment.barcode_id}
                      </Badge>
                    )}
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
