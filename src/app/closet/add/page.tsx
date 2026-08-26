'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FileUpload } from '@/components/ui/file-upload'
import { NFCScanner } from '@/components/nfc/nfc-scanner'
import dynamic from 'next/dynamic'

const BarcodeScanner = dynamic(() => import('@/components/barcode/barcode-scanner').then(mod => ({ default: mod.BarcodeScanner })), {
  ssr: false,
  loading: () => <div className="p-4 text-center text-muted-foreground">Cargando escáner de códigos de barras...</div>
})
import { DemoBanner } from '@/components/ui/demo-banner'
import { ArrowLeft, Save, AlertCircle, Camera, Sparkles, Loader2 } from 'lucide-react'
import type { Box, GarmentForm } from '@/types'
import { GARMENT_TYPES, SEASONS, STYLES, type GarmentSuggestion } from '@/lib/garment-taxonomy'
import { toast } from '@/hooks/use-toast'
import { getFreshAccessToken } from '@/lib/session'
import { isHeic, heicToJpeg } from '@/lib/image-format'
import { getBoxMaxCapacity, isBoxFull } from '@/utils/box-capacity'

export default function AddGarmentPage() {
  const { userProfile, loading: authLoading } = useAuth()
  const router = useRouter()
  const [boxes, setBoxes] = useState<Box[]>([])
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [convirtiendo, setConvirtiendo] = useState(false)
  // Al catalogar en serie no se vuelve al listado: se encadena la siguiente prenda
  const encadenarOtraRef = useRef(false)
  // Campos que vienen de la sugerencia automática: se marcan en la UI para revisarlos de un vistazo
  const [suggestedFields, setSuggestedFields] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [nfcMode, setNfcMode] = useState<'read' | 'write' | 'manual' | 'barcode' | null>(null)
  const [selectedNfcTag, setSelectedNfcTag] = useState<string>('')
  const [manualNfcCode, setManualNfcCode] = useState<string>('')
  const [barcodeCode, setBarcodeCode] = useState<string>('')
  const [writeNfcTagId, setWriteNfcTagId] = useState<string>('')
  const [associatingNfc, setAssociatingNfc] = useState(false) // Estado para feedback visual NFC
  const [accessDenied, setAccessDenied] = useState(false) // Estado para acceso denegado
  const [users, setUsers] = useState<Array<{ id: string; email: string; full_name: string | null }>>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('') // Usuario seleccionado para la prenda
  const [nfcDuplicate, setNfcDuplicate] = useState<{ exists: boolean; garmentName?: string }>({ exists: false })
  const [barcodeDuplicate, setBarcodeDuplicate] = useState<{ exists: boolean; garmentName?: string }>({ exists: false })
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)
  const [barcodeScannerKey, setBarcodeScannerKey] = useState(0) // ✅ Key para forzar recreación del escáner

  const [formData, setFormData] = useState<GarmentForm>({
    name: '',
    type: '',
    season: undefined,
    style: [],
    boxId: '',
    image: undefined
  })

  const generateWriteNfcId = useCallback(() => {
    try {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID().replace(/-/g, '').toUpperCase()
      }
    } catch {}

    const timestamp = Date.now().toString(16)
    const random = Math.floor(Math.random() * 0xFFFFFFFFFFFF).toString(16)
    return `${timestamp}${random}`.toUpperCase()
  }, [])

  useEffect(() => {
    if (nfcMode === 'write') {
      if (!writeNfcTagId) {
        setWriteNfcTagId(generateWriteNfcId())
      }
      return
    }

    if (writeNfcTagId) {
      setWriteNfcTagId('')
    }
  }, [nfcMode, writeNfcTagId, generateWriteNfcId])

  useEffect(() => {
    // Si Supabase no está configurado, permitir (modo demo)
    if (!isSupabaseConfigured) {
      fetchBoxes()
      return
    }

    // Esperar a que la autenticación se resuelva
    if (authLoading) {
      return
    }

    // NO redirigir si estamos guardando una prenda (evita redirecciones durante el proceso)
    if (saving) {
      return
    }

    // Si no hay usuario autenticado después de cargar, redirigir
    if (!userProfile) {
      router.push('/auth/login')
      return
    }

    // Si el usuario no es admin, bloquear acceso
    if (userProfile.role !== 'admin') {
      setAccessDenied(true)
      setTimeout(() => {
        router.push('/closet')
      }, 2000) // Redirigir después de 2 segundos
      return
    }

    // Si es admin, cargar cajas y usuarios
    fetchBoxes()
    fetchUsers()
    
    // Inicializar usuario seleccionado con el admin actual
    if (userProfile) {
      setSelectedUserId(userProfile.id)
    }
  }, [userProfile, authLoading, router, saving]) // Agregar saving a las dependencias

  const fetchUsers = async () => {
    // En modo demo, mostrar array vacío
    if (!isSupabaseConfigured) {
      setUsers([])
      return
    }

    try {

      const { data, error } = await supabase
        .from('users')
        .select('id, email, full_name')
        .order('full_name', { ascending: true, nullsFirst: false })
        .order('email', { ascending: true })

      if (error) {
        console.error('❌ [fetchUsers] Error de Supabase:', error)
        throw error
      }
      

      setUsers(data || [])
    } catch (error) {
      console.error('❌ [fetchUsers] Error capturado:', error)
      setUsers([])
    }
  }

  const fetchBoxes = async () => {
    // En modo demo, mostrar array vacío
    if (!isSupabaseConfigured) {
      setBoxes([])
      return
    }

    try {
      // Obtener todas las cajas
      const { data, error } = await supabase
        .from('boxes')
        .select('*')
        .order('name')

      if (error) throw error

      // OPTIMIZACIÓN CRÍTICA: Usar queries agregadas (count) en paralelo
      // en lugar de traer TODOS los box_id (puede ser miles de registros)
      const boxIds = (data || []).map((box: { id: string; name: string }) => box.id)
      
      // Si no hay cajas, retornar vacío
      if (boxIds.length === 0) {
        setBoxes([])
        return
      }

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
      const countMap = new Map<string, number>()
      boxIds.forEach((boxId: string, index: number) => {
        countMap.set(boxId, countResults[index].count || 0)
      })

      // Combinar datos con conteos
      const boxesWithCount = (data || []).map((box: any) => ({
        ...box,
        garment_count: countMap.get(box.id) || 0
      }))

      setBoxes(boxesWithCount)
    } catch (error) {
      console.error('Error fetching boxes:', error)
      // En caso de error, mostrar array vacío
      setBoxes([])
    }
  }

  // Función para verificar si un código NFC está duplicado (optimizada)
  const checkNfcDuplicate = async (nfcTag: string): Promise<{ exists: boolean; garmentName?: string }> => {
    if (!nfcTag || !nfcTag.trim() || !isSupabaseConfigured) {
      setNfcDuplicate({ exists: false })
      return { exists: false }
    }

    // Normalizar el código antes de buscar
    const normalizedTag = nfcTag.trim().toUpperCase()

    try {
      // OPTIMIZACIÓN: Usar maybeSingle en lugar de single para mejor rendimiento
      const { data, error } = await supabase
        .from('garments')
        .select('id, name')
        .eq('nfc_tag_id', normalizedTag)
        .maybeSingle()

      if (data && !error) {
        const result = { exists: true, garmentName: data.name }
        setNfcDuplicate(result)
        return result
      } else {
        setNfcDuplicate({ exists: false })
        return { exists: false }
      }
    } catch (error) {
      // Si no se encuentra, no es duplicado
      setNfcDuplicate({ exists: false })
      return { exists: false }
    }
  }

  // Función para verificar si un código de barras está duplicado (optimizada)
  const checkBarcodeDuplicate = async (barcode: string) => {
    if (!barcode.trim() || !isSupabaseConfigured) {
      setBarcodeDuplicate({ exists: false })
      return
    }

    try {
      // OPTIMIZACIÓN: Usar maybeSingle en lugar de single para mejor rendimiento
      const { data, error } = await supabase
        .from('garments')
        .select('id, name')
        .eq('barcode_id', barcode.trim())
        .maybeSingle()

      if (data && !error) {
        setBarcodeDuplicate({ exists: true, garmentName: data.name })
      } else {
        setBarcodeDuplicate({ exists: false })
      }
    } catch (error) {
      // Si no se encuentra, no es duplicado
      setBarcodeDuplicate({ exists: false })
    }
  }

  // Validar NFC cuando cambia el código
  useEffect(() => {
    if (selectedNfcTag) {
      const timeoutId = setTimeout(() => {
        checkNfcDuplicate(selectedNfcTag)
      }, 500) // Debounce de 500ms
      return () => clearTimeout(timeoutId)
    } else {
      setNfcDuplicate({ exists: false })
    }
  }, [selectedNfcTag])

  // Validar código de barras cuando cambia
  useEffect(() => {
    if (barcodeCode.trim()) {
      const timeoutId = setTimeout(() => {
        checkBarcodeDuplicate(barcodeCode)
      }, 500) // Debounce de 500ms
      return () => clearTimeout(timeoutId)
    } else {
      setBarcodeDuplicate({ exists: false })
    }
  }, [barcodeCode])

  // Función para verificar identificadores duplicados (optimizada)
  const checkDuplicateIdentifiers = async () => {
    const checks: Promise<{ type: 'barcode' | 'nfc'; value: string; existing: any } | null>[] = []
    
    // Verificar código de barras si existe
    if (barcodeCode.trim()) {
      const normalizedBarcode = barcodeCode.trim()
      checks.push(
        supabase
          .from('garments')
          .select('id, name, user_id')
          .eq('barcode_id', normalizedBarcode)
          .maybeSingle() // OPTIMIZACIÓN: Usar maybeSingle en lugar de single
          .then(({ data, error }: { data: any; error: any }) => {
            if (data && !error) {
              return { type: 'barcode' as const, value: normalizedBarcode, existing: data }
            }
            return null
          })
          .catch(() => null) // Ignorar errores de "no encontrado"
      )
    }
    
    // Verificar NFC tag si existe (normalizado)
    if (selectedNfcTag && selectedNfcTag.trim()) {
      const normalizedNfc = selectedNfcTag.trim().toUpperCase()
      checks.push(
        supabase
          .from('garments')
          .select('id, name, user_id')
          .eq('nfc_tag_id', normalizedNfc)
          .maybeSingle() // OPTIMIZACIÓN: Usar maybeSingle en lugar de single
          .then(({ data, error }: { data: any; error: any }) => {
            if (data && !error) {
              return { type: 'nfc' as const, value: normalizedNfc, existing: data }
            }
            return null
          })
          .catch(() => null) // Ignorar errores de "no encontrado"
      )
    }
    
    const results = await Promise.all(checks)
    return results.filter((r): r is { type: 'barcode' | 'nfc'; value: string; existing: any } => r !== null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validaciones básicas
    if (!formData.name.trim() || !formData.type) {
      setError('Nombre y tipo de prenda son obligatorios')
      return
    }

    setSaving(true)

    // Logging detallado para diagnosticar demoras
    console.time('🕐 Total Submit Time')
    console.log('📝 Iniciando guardado de prenda:', {
      hasImage: !!selectedImage,
      imageSize: selectedImage ? `${(selectedImage.size / 1024 / 1024).toFixed(2)}MB` : 'N/A',
      hasNfc: !!selectedNfcTag,
      hasBarcode: !!barcodeCode.trim()
    })

    // Pre-validar datos
    const validationStart = Date.now()
    if (!userProfile?.id) {
      throw new Error('Usuario no autenticado')
    }
    
    // Validar que se haya seleccionado un usuario dueño (si es admin)
    if (userProfile.role === 'admin' && !selectedUserId) {
      setError('Debes seleccionar el usuario dueño de la prenda')
      setSaving(false)
      return
    }
    
    console.log(`✅ Validación completada en ${Date.now() - validationStart}ms`)

    // En modo demo, simular guardado
    if (!isSupabaseConfigured || !userProfile) {
      setTimeout(() => {
        setError('Modo demo: Las prendas no se guardan realmente. Configura Supabase para funcionalidad completa.')
        setSaving(false)
        // Aun así redirigir para mostrar la interfaz
        router.push('/closet')
      }, 1500)
      return
    }

    try {
      let imageUrl = null

      // Subir imagen si existe (con compresión)
      if (selectedImage) {
        console.time('🖼️ Image Processing Time')
        console.log('📤 Iniciando procesamiento de imagen:', {
          originalSize: `${(selectedImage.size / 1024 / 1024).toFixed(2)}MB`,
          type: selectedImage.type,
          name: selectedImage.name
        })

        // Comprimir imagen antes del upload
        const compressedImage = await compressImage(selectedImage)
        console.log('🗜️ Imagen comprimida:', {
          newSize: `${(compressedImage.size / 1024 / 1024).toFixed(2)}MB`,
          compressionRatio: `${((selectedImage.size - compressedImage.size) / selectedImage.size * 100).toFixed(1)}%`
        })

        console.timeEnd('🖼️ Image Processing Time')
        console.time('📤 Image Upload Time')

        const fileExt = 'jpg' // Siempre usar .jpg ya que convertimos a JPEG
        const fileName = `${Date.now()}-${Math.random()}.${fileExt}`
        const filePath = `garments/${selectedUserId || userProfile?.id}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('garments')
          .upload(filePath, compressedImage)

        if (uploadError) {
          console.error('❌ Error en upload:', uploadError)
          throw uploadError
        }

        const { data: { publicUrl } } = supabase.storage
          .from('garments')
          .getPublicUrl(filePath)

        imageUrl = publicUrl
        console.timeEnd('📤 Image Upload Time')
        console.log('✅ Imagen subida exitosamente:', publicUrl)
      } else {
        console.log('ℹ️ Sin imagen para subir')
      }

      // Validar identificadores duplicados antes de insertar
      console.log('🔍 Validando identificadores únicos...')
      const duplicates = await checkDuplicateIdentifiers()
      
      if (duplicates.length > 0) {
        const duplicate = duplicates[0]
        let errorMessage = ''
        
        if (duplicate.type === 'barcode') {
          errorMessage = `El código de barras "${duplicate.value}" ya está asignado a otra prenda. Por favor, usa un código diferente o elimina el código de barras.`
          // NO limpiar automáticamente - dejar que el usuario decida
          // setBarcodeCode('')
        } else if (duplicate.type === 'nfc') {
          errorMessage = `El tag NFC "${duplicate.value}" ya está asignado a otra prenda. Por favor, usa un tag diferente o elimina el tag NFC.`
          // NO limpiar automáticamente - dejar que el usuario decida
          // setSelectedNfcTag('')
        }
        
        console.error('❌ Identificador duplicado:', duplicate)
        console.error('❌ Códigos actuales en formulario:', {
          nfc: selectedNfcTag,
          barcode: barcodeCode
        })
        setError(errorMessage)
        setSaving(false)
        return
      }

      // Crear prenda
      console.time('👕 Garment Insert Time')
      console.log('💾 Insertando prenda en BD:', {
        userId: selectedUserId || userProfile?.id,
        name: formData.name.trim(),
        type: formData.type,
        hasImage: !!imageUrl,
        hasBox: !!formData.boxId,
        hasNfc: !!selectedNfcTag,
        hasBarcode: !!barcodeCode.trim()
      })

      // Normalizar código NFC antes de guardar (mejorado)
      // IMPORTANTE: Verificar que selectedNfcTag tenga contenido válido
      let normalizedNfcTag: string | null = null
      
      if (selectedNfcTag) {
        // Verificar que selectedNfcTag sea un string válido
        if (typeof selectedNfcTag === 'string') {
          const trimmed = selectedNfcTag.trim()
          if (trimmed.length > 0) {
            normalizedNfcTag = trimmed.toUpperCase()
            console.log('✅ Código NFC normalizado correctamente:', {
              original: selectedNfcTag,
              trimmed: trimmed,
              normalized: normalizedNfcTag
            })
          } else {
            console.warn('⚠️ Código NFC tiene solo espacios en blanco después de trim')
          }
        } else {
          console.error('❌ ERROR: selectedNfcTag no es un string:', {
            type: typeof selectedNfcTag,
            value: selectedNfcTag
          })
        }
      } else {
        console.log('ℹ️ No hay código NFC para normalizar (selectedNfcTag es falsy)')
      }
      
      const normalizedBarcode = barcodeCode.trim() || null

      // Logging detallado para diagnosticar
      console.log('📝 Códigos antes de guardar:', {
        selectedNfcTag: selectedNfcTag,
        selectedNfcTagType: typeof selectedNfcTag,
        selectedNfcTagLength: selectedNfcTag?.length || 0,
        selectedNfcTagTrimmed: selectedNfcTag?.trim(),
        selectedNfcTagTrimmedLength: selectedNfcTag?.trim().length || 0,
        normalizedNfcTag: normalizedNfcTag,
        normalizedNfcTagType: typeof normalizedNfcTag,
        normalizedNfcTagLength: normalizedNfcTag?.length || 0,
        barcodeCode: barcodeCode,
        normalizedBarcode: normalizedBarcode,
        hasNfc: !!normalizedNfcTag,
        hasBarcode: !!normalizedBarcode,
        willSaveNfc: !!normalizedNfcTag,
        willSaveBarcode: !!normalizedBarcode
      })

      // Validar: Si el usuario pensó que había guardado un código NFC pero está vacío
      if (selectedNfcTag && !normalizedNfcTag) {
        console.error('❌ ERROR: Código NFC vacío después de normalizar:', {
          original: selectedNfcTag,
          afterTrim: selectedNfcTag.trim(),
          trimLength: selectedNfcTag.trim().length,
          normalized: normalizedNfcTag,
          willNotSave: true
        })
      }
      
      // Advertencia si hay selectedNfcTag pero se convertirá en null
      if (selectedNfcTag && selectedNfcTag.trim().length === 0) {
        console.error('❌ ERROR: selectedNfcTag tiene solo espacios en blanco - NO SE GUARDARÁ')
      }
      
      // Validación crítica: Si hay selectedNfcTag pero normalizedNfcTag es null, hay un problema
      if (selectedNfcTag && selectedNfcTag.length > 0 && !normalizedNfcTag) {
        console.error('❌ ERROR CRÍTICO: selectedNfcTag tiene contenido pero normalizedNfcTag es null')
        console.error('❌ Esto significa que el código NO se guardará')
      }

      // Validación final antes de guardar
      if (selectedNfcTag && selectedNfcTag.trim().length > 0 && !normalizedNfcTag) {
        console.error('❌ ERROR CRÍTICO: No se puede normalizar el código NFC')
        setError('Error al procesar el código NFC. Por favor, verifica el formato e inténtalo de nuevo.')
        setSaving(false)
        return
      }

      // Validar capacidad de la caja antes de guardar
      if (formData.boxId) {
        const selectedBox = boxes.find(b => b.id === formData.boxId)
        if (selectedBox && isBoxFull(selectedBox)) {
          const maxCapacity = getBoxMaxCapacity(selectedBox)
          // Encontrar la caja más vacía
          const availableBoxes = boxes
            .filter(box => !isBoxFull(box))
            .sort((a, b) => (a.garment_count || 0) - (b.garment_count || 0))
          
          const mostEmptyBox = availableBoxes.length > 0 ? availableBoxes[0] : null
          
          if (mostEmptyBox) {
            setError(`❌ Esta caja está llena (máximo ${maxCapacity} prendas). Te recomendamos usar la caja "${mostEmptyBox.name}" que tiene ${mostEmptyBox.garment_count || 0} prendas.`)
          } else {
            setError(`❌ Esta caja está llena (máximo ${maxCapacity} prendas) y no hay otras cajas disponibles.`)
          }
          setSaving(false)
          return
        }
      }
      
      // Preparar datos para insertar
      const insertData = {
        user_id: selectedUserId || userProfile?.id,
        name: formData.name.trim(),
        type: formData.type,
        season: formData.season,
        style: formData.style,
        image_url: imageUrl,
        box_id: formData.boxId || null,
        nfc_tag_id: normalizedNfcTag,
        barcode_id: normalizedBarcode,
        status: 'available' as const
      }
      
      console.log('💾 Datos a insertar:', {
        ...insertData,
        nfc_tag_id_value: insertData.nfc_tag_id,
        nfc_tag_id_type: typeof insertData.nfc_tag_id,
        nfc_tag_id_isNull: insertData.nfc_tag_id === null,
        nfc_tag_id_isUndefined: insertData.nfc_tag_id === undefined,
        barcode_id_value: insertData.barcode_id
      })
      
      // Validación crítica: Si hay selectedNfcTag pero nfc_tag_id es null en insertData
      if (selectedNfcTag && selectedNfcTag.trim().length > 0 && insertData.nfc_tag_id === null) {
        console.error('❌ ERROR CRÍTICO: El código NFC NO se guardará porque insertData.nfc_tag_id es null')
        console.error('❌ selectedNfcTag:', selectedNfcTag)
        console.error('❌ normalizedNfcTag:', normalizedNfcTag)
        setError('Error: El código NFC no se pudo procesar correctamente. Por favor, verifica el formato.')
        setSaving(false)
        return
      }

      const { data: garmentData, error: insertError } = await supabase
        .from('garments')
        .insert(insertData)
        .select('id, name, type, nfc_tag_id, barcode_id')
        .single()

      if (insertError) {
        console.error('❌ Error insertando prenda:', insertError)
        console.error('❌ Detalles del error:', {
          code: insertError.code,
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          userId: selectedUserId || userProfile?.id,
          userRole: userProfile?.role,
          isAdmin: userProfile?.role === 'admin',
          nfcTag: normalizedNfcTag,
          barcode: normalizedBarcode
        })
        // Verificar si el error es por código NFC
        if (insertError.message?.includes('nfc_tag_id')) {
          console.error('❌ Error específico con código NFC:', {
            original: selectedNfcTag,
            normalized: normalizedNfcTag,
            error: insertError
          })
        }
        throw insertError
      }

      console.timeEnd('👕 Garment Insert Time')
      console.log('✅ Prenda creada exitosamente:', garmentData?.id)
      
      // Verificar que el código se guardó correctamente
      console.log('✅ Verificación de códigos guardados:', {
        id: garmentData?.id,
        nfc_tag_id: garmentData?.nfc_tag_id,
        barcode_id: garmentData?.barcode_id,
        expectedNfc: normalizedNfcTag,
        expectedBarcode: normalizedBarcode,
        nfcMatches: garmentData?.nfc_tag_id === normalizedNfcTag,
        barcodeMatches: garmentData?.barcode_id === normalizedBarcode
      })
      
      // Advertencia si el código NFC no se guardó como se esperaba
      if (normalizedNfcTag && !garmentData?.nfc_tag_id) {
        console.error('⚠️ ADVERTENCIA: Código NFC no se guardó correctamente', {
          expected: normalizedNfcTag,
          saved: garmentData?.nfc_tag_id,
          garmentId: garmentData?.id
        })
      }

      // Registrar el tag NFC en la tabla nfc_tags si existe
      // Esta operación es independiente y no bloquea el éxito general
      if (normalizedNfcTag && garmentData) {
        console.time('📱 NFC Registration Time')
        console.log('🏷️ Registrando tag NFC en tabla nfc_tags:', normalizedNfcTag)

        // Ejecutar en background sin await para no bloquear
        supabase
          .from('nfc_tags')
          .insert({
            tag_id: normalizedNfcTag,
            entity_type: 'garment',
            entity_id: garmentData.id,
            created_by: userProfile.id
          })
          .then(({ error: nfcError }: { error: any }) => {
            console.timeEnd('📱 NFC Registration Time')
            if (nfcError) {
              console.error('❌ Error registrando tag NFC en tabla nfc_tags:', nfcError)
              console.error('❌ Detalles del error NFC:', {
                code: nfcError.code,
                message: nfcError.message,
                details: nfcError.details,
                hint: nfcError.hint
              })
            } else {
              console.log('✅ Tag NFC registrado exitosamente en tabla nfc_tags')
            }
          })
          .catch((error: unknown) => {
            console.error('❌ Excepción al registrar tag NFC:', error)
          })
      }

      console.log('🔄 Redirigiendo al closet...')
      console.timeEnd('🕐 Total Submit Time')
      console.timeEnd('🕐 Total Submit Time')

      if (encadenarOtraRef.current) {
        // Se conservan usuario y caja: catalogar un armario entero es repetir
        // la misma combinación decenas de veces
        encadenarOtraRef.current = false
        setFormData(prev => ({
          name: '',
          type: '',
          season: undefined,
          style: [],
          boxId: prev.boxId,
          image: undefined
        }))
        setSelectedImage(null)
        setSuggestedFields(new Set())
        setSelectedNfcTag('')
        setBarcodeCode('')
        setNfcMode(null)
        setError('')
        toast.success('Puedes añadir la siguiente prenda', 'Prenda guardada')
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }

      router.push('/closet')
    } catch (error: any) {
      console.error('💥 Error en submit:', error)
      console.error('💥 Detalles del error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      console.timeEnd('🕐 Total Submit Time')

      // Mejor manejo de errores para el usuario
      let errorMessage = 'Error al guardar la prenda'

      if (error.code === '23505') {
        // Violación de restricción única
        if (error.message?.includes('barcode_id')) {
          errorMessage = 'El código de barras ya está en uso. Por favor, usa un código diferente o elimina el código de barras.'
          setBarcodeCode('') // Limpiar el campo
        } else if (error.message?.includes('nfc_tag_id')) {
          errorMessage = 'El tag NFC ya está en uso. Por favor, usa un tag diferente o elimina el tag NFC.'
          setSelectedNfcTag('') // Limpiar el campo
        } else {
          errorMessage = 'Ya existe una prenda con estos identificadores. Por favor, verifica los códigos NFC o de barras.'
        }
      } else if (error.message?.includes('storage')) {
        errorMessage = 'Error al subir la imagen. Verifica el tamaño y conexión.'
      } else if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
        errorMessage = 'Ya existe una prenda con ese código NFC o barras.'
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMessage = 'Error de conexión. Verifica tu internet.'
      } else if (error.message) {
        errorMessage = error.message
      }

      setError(errorMessage)
      setSaving(false)
    }
  }

  /**
   * Pide una sugerencia de nombre/tipo/temporada/estilo a partir de la foto.
   * Se lanza en paralelo a la selección de imagen: el usuario puede seguir
   * rellenando campos mientras llega, y nunca sobreescribe lo que ya haya escrito.
   */
  const analyzeImage = useCallback(async (file: File) => {
    if (!isSupabaseConfigured) return

    setAnalyzing(true)
    try {
      const token = await getFreshAccessToken()
      if (!token) {
        toast.error(
          'Vuelve a iniciar sesión para que se rellenen los datos automáticamente.',
          'Sesión caducada'
        )
        return
      }

      // La versión comprimida basta para clasificar y es mucho más ligera de enviar
      const compressed = await compressImage(file)

      const body = new FormData()
      body.append('image', compressed)

      const response = await fetch('/api/analyze-garment', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body
      })

      const data = await response.json()

      if (!data.success) {
        // Falta de configuración o error puntual: el formulario sigue siendo manual
        if (response.status !== 503) {
          toast.error(data.error || 'No se pudo analizar la imagen', 'Sugerencia no disponible')
        }
        return
      }

      const suggestion: GarmentSuggestion = data.suggestion
      const rellenados = new Set<string>()

      setFormData(prev => {
        const siguiente = { ...prev }
        // Solo se rellena lo que esté vacío: lo que el usuario ya escribió manda
        if (!prev.name.trim() && suggestion.name) {
          siguiente.name = suggestion.name
          rellenados.add('name')
        }
        if (!prev.type && suggestion.type) {
          siguiente.type = suggestion.type
          rellenados.add('type')
        }
        if (!prev.season && suggestion.season) {
          siguiente.season = suggestion.season as GarmentForm['season']
          rellenados.add('season')
        }
        if (prev.style.length === 0 && suggestion.style?.length) {
          siguiente.style = [...suggestion.style]
          rellenados.add('style')
        }
        return siguiente
      })

      setSuggestedFields(rellenados)

      if (rellenados.size > 0) {
        toast.success(
          `${suggestion.name}${suggestion.color ? ` · ${suggestion.color}` : ''}`,
          'Datos sugeridos'
        )
      }
    } catch (error) {
      console.error('Error analizando la prenda:', error)
    } finally {
      setAnalyzing(false)
    }
  }, [])


  /** Distintivo que marca un campo rellenado automáticamente desde la foto */
  const SugeridoBadge = ({ field }: { field: string }) =>
    suggestedFields.has(field) ? (
      <span className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary align-middle">
        <Sparkles className="mr-1 h-3 w-3" aria-hidden="true" />
        sugerido
      </span>
    ) : null

  const handleImageSelect = async (file: File) => {
    let imagen = file

    // Las fotos de iPhone vienen en HEIC y ni el navegador ni Storage ni el
    // analizador las entienden: se convierten a JPEG antes de seguir.
    if (isHeic(file)) {
      setConvirtiendo(true)
      try {
        imagen = await heicToJpeg(file)
      } catch (error) {
        console.error('Error convirtiendo HEIC:', error)
        toast.error(
          'No se pudo convertir la foto. Prueba a exportarla como JPEG desde el móvil.',
          'Formato no compatible'
        )
        return
      } finally {
        setConvirtiendo(false)
      }
    }

    setSelectedImage(imagen)
    // No se espera al análisis: corre de fondo mientras se sigue rellenando
    void analyzeImage(imagen)
  }

  const handleImageRemove = () => {
    setSelectedImage(null)
    setSuggestedFields(new Set())
  }

  const handleNFCRead = async (tagId: string) => {
    // Normalizar el código NFC (limpiar espacios y convertir a mayúsculas)
    const normalizedTagId = tagId.trim().toUpperCase()
    console.log('📱 Código NFC leído:', { original: tagId, normalized: normalizedTagId })
    
    setSelectedNfcTag(normalizedTagId)
    setNfcMode(null) // Cerrar el scanner después de leer
    // Validar inmediatamente después de leer
    await checkNfcDuplicate(normalizedTagId)
  }

  const handleNFCError = (error: string) => {
    setError(`Error NFC: ${error}`)
  }

  const handleClearNfcTag = () => {
    setSelectedNfcTag('')
    setManualNfcCode('')
    setBarcodeCode('')
    setNfcMode(null)
  }

  // Función para comprimir imágenes antes del upload
  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()

      img.onload = () => {
        // Calcular nuevas dimensiones (máximo 800px de ancho/alto)
        let { width, height } = img
        const maxDimension = 800

        if (width > height) {
          if (width > maxDimension) {
            height = (height * maxDimension) / width
            width = maxDimension
          }
        } else {
          if (height > maxDimension) {
            width = (width * maxDimension) / height
            height = maxDimension
          }
        }

        canvas.width = width
        canvas.height = height

        // Dibujar imagen redimensionada
        ctx?.drawImage(img, 0, 0, width, height)

        // Convertir a blob con compresión
        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg', // Convertir siempre a JPEG para mejor compresión
              lastModified: Date.now()
            })
            resolve(compressedFile)
          } else {
            resolve(file) // Si falla la compresión, devolver original
          }
        }, 'image/jpeg', 0.8) // Calidad 80%
      }

      img.onerror = () => resolve(file) // Si falla la carga, devolver original
      img.src = URL.createObjectURL(file)
    })
  }

  const handleBarcodeSubmit = async () => {
    if (!barcodeCode.trim()) {
      setError('Ingresa un código de barras válido')
      return
    }

    setAssociatingNfc(true)
    setError('')

    try {
      // Validar duplicado antes de procesar
      await checkBarcodeDuplicate(barcodeCode.trim())
      
      // Esperar un momento para que el estado se actualice
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Verificar el estado actualizado
      // OPTIMIZACIÓN: Usar maybeSingle en lugar de single para mejor rendimiento
      const { data } = await supabase
        .from('garments')
        .select('id, name')
        .eq('barcode_id', barcodeCode.trim())
        .maybeSingle()

      if (data) {
        setError(`El código de barras "${barcodeCode.trim()}" ya está registrado en la prenda "${data.name}"`)
        setAssociatingNfc(false)
        return
      }

      // Simular procesamiento
      await new Promise(resolve => setTimeout(resolve, 500))

      console.log('Código de barras registrado:', barcodeCode.trim())
      // No limpiar el código aquí, se mantiene para mostrar el aviso
      setNfcMode(null)
    } catch (error) {
      // Si no se encuentra, no es duplicado, continuar
      console.log('Código de barras registrado:', barcodeCode.trim())
      setNfcMode(null)
    } finally {
      setAssociatingNfc(false)
    }
  }

  // Validar formato de código NFC manual
  const validateNfcCode = (code: string): boolean => {
    const trimmedCode = code.trim()
    
    // Formatos válidos:
    // - MAC address: cualquier número de pares (mínimo 2 pares) como XX:XX o XX:XX:XX:XX:XX:XX
    // - Hexadecimal largo: al menos 8 caracteres hexadecimales sin dos puntos
    const macRegex = /^([0-9A-Fa-f]{2}:)+[0-9A-Fa-f]{2}$/
    const hexRegex = /^[0-9A-Fa-f]{8,}$/

    return macRegex.test(trimmedCode) || hexRegex.test(trimmedCode)
  }

  const handleManualNfcSubmit = async () => {
    if (!manualNfcCode.trim()) {
      setError('Ingresa un código NFC válido')
      return
    }

    if (!validateNfcCode(manualNfcCode.trim())) {
      setError('Formato inválido. Usa formato MAC (XX:XX:XX:XX:XX o XX:XX:XX:XX:XX:XX) o código hexadecimal largo')
      return
    }

    setAssociatingNfc(true)
    setError('')

    try {
      // Simular un pequeño delay para mejor UX y feedback visual
      await new Promise(resolve => setTimeout(resolve, 500))

      const nfcCode = manualNfcCode.trim().toUpperCase()
      console.log('📱 Procesando código NFC manual:', {
        original: manualNfcCode,
        normalized: nfcCode,
        length: nfcCode.length
      })
      
      // Validar antes de asignar y obtener el resultado directamente
      const duplicateCheck = await checkNfcDuplicate(nfcCode)
      
      // Verificar si hay duplicado antes de asignar usando el resultado directo
      if (duplicateCheck.exists) {
        setError(`El código NFC "${nfcCode}" ya está registrado en la prenda "${duplicateCheck.garmentName}"`)
        setAssociatingNfc(false)
        return
      }
      
      console.log('✅ Asignando código NFC:', nfcCode)
      setSelectedNfcTag(nfcCode)
      setManualNfcCode('')
      setNfcMode(null)
    } catch (error) {
      console.error('❌ Error al procesar código NFC:', error)
      setError('Error al procesar el código NFC')
    } finally {
      setAssociatingNfc(false)
    }
  }

  const toggleStyle = (style: string) => {
    setFormData(prev => ({
      ...prev,
      style: prev.style.includes(style)
        ? prev.style.filter(s => s !== style)
        : [...prev.style, style]
    }))
  }

  // Mostrar loading mientras se verifica el acceso
  if (isSupabaseConfigured && authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando acceso...</p>
        </div>
      </div>
    )
  }

  // Mostrar mensaje de acceso denegado si el usuario no es admin
  if (accessDenied) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4 max-w-md">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-semibold mb-2">Acceso Denegado</p>
              <p>Solo los administradores pueden agregar prendas al sistema.</p>
              <p className="text-sm mt-2">Redirigiendo al closet...</p>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 px-4 sm:px-0">
      {!isSupabaseConfigured && <DemoBanner />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="self-start"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Agregar Prenda</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Agrega una nueva prenda a tu closet digital
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Columna izquierda */}
          <div className="space-y-6">
            {/* Información básica */}
            <Card>
              <CardHeader>
                <CardTitle>Información Básica</CardTitle>
                <CardDescription>
                  Datos principales de la prenda
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Selector de usuario (solo para admins) */}
                {userProfile?.role === 'admin' && (
                  <div>
                    <Label htmlFor="user">Usuario Dueño *</Label>
                    <Select
                      value={selectedUserId}
                      onValueChange={setSelectedUserId}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona el usuario dueño" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map(user => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.full_name || user.email}
                            {user.full_name && ` (${user.email})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Selecciona a quién pertenece esta prenda
                    </p>
                  </div>
                )}

                <div>
                  <Label htmlFor="name">Nombre *<SugeridoBadge field="name" /></Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej: Camisa azul formal"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="type">Tipo de prenda *<SugeridoBadge field="type" /></Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {GARMENT_TYPES.map(type => (
                        <SelectItem key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="season">Temporada<SugeridoBadge field="season" /></Label>
                  <Select
                    value={formData.season || ''}
                    onValueChange={(value) => setFormData(prev => ({
                      ...prev,
                      season: value as any || undefined
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona temporada (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {SEASONS.map(season => (
                        <SelectItem key={season.value} value={season.value}>
                          {season.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Caja</Label>
                  <Select
                    value={formData.boxId}
                    onValueChange={(value) => {
                      const selectedBox = boxes.find(b => b.id === value)
                      if (selectedBox && isBoxFull(selectedBox)) {
                        const maxCapacity = getBoxMaxCapacity(selectedBox)
                        // Encontrar la caja más vacía
                        const availableBoxes = boxes
                          .filter(box => !isBoxFull(box))
                          .sort((a, b) => (a.garment_count || 0) - (b.garment_count || 0))
                        
                        const mostEmptyBox = availableBoxes.length > 0 ? availableBoxes[0] : null
                        
                        if (mostEmptyBox) {
                          setError(`❌ Esta caja está llena (máximo ${maxCapacity} prendas). Te recomendamos usar la caja "${mostEmptyBox.name}" que tiene ${mostEmptyBox.garment_count || 0} prendas.`)
                        } else {
                          setError(`❌ Esta caja está llena (máximo ${maxCapacity} prendas) y no hay otras cajas disponibles.`)
                        }
                        // No cambiar el valor si la caja está llena
                        return
                      } else {
                        // Limpiar error si la caja está disponible
                        setError('')
                      }
                      setFormData(prev => ({ ...prev, boxId: value }))
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una caja (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {boxes.map(box => {
                        const count = box.garment_count ?? 0
                        const maxCapacity = getBoxMaxCapacity(box)
                        const isFull = count >= maxCapacity
                        return (
                          <SelectItem 
                            key={box.id} 
                            value={box.id}
                            disabled={isFull}
                            className={isFull ? 'opacity-50' : ''}
                          >
                            {box.name}
                            {count > 0 && ` (${count}/${maxCapacity})`}
                            {isFull && ' - LLENA'}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Estilos */}
            <Card>
              <CardHeader>
                <CardTitle>Estilos<SugeridoBadge field="style" /></CardTitle>
                <CardDescription>
                  Selecciona los estilos que mejor describan esta prenda
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {STYLES.map(style => (
                    <Button
                      key={style}
                      type="button"
                      variant={formData.style.includes(style) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleStyle(style)}
                    >
                      {style.charAt(0).toUpperCase() + style.slice(1)}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Columna derecha */}
          <div className="space-y-6">
            {/* Imagen */}
            <Card>
              <CardHeader>
                <CardTitle>Foto de la Prenda</CardTitle>
                <CardDescription>
                  Sube una foto clara de la prenda
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileUpload
                  selectedFile={selectedImage}
                  onFileSelect={handleImageSelect}
                  onFileRemove={handleImageRemove}
                />
                {convirtiendo && (
                  <p
                    className="mt-3 flex items-center text-sm text-muted-foreground"
                    role="status"
                    aria-live="polite"
                  >
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Convirtiendo la foto del móvil…
                  </p>
                )}
                {analyzing && (
                  <p
                    className="mt-3 flex items-center text-sm text-muted-foreground"
                    role="status"
                    aria-live="polite"
                  >
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Identificando la prenda…
                  </p>
                )}
              </CardContent>
            </Card>

            {/* NFC */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Tag NFC
                  {selectedNfcTag && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearNfcTag}
                    >
                      Limpiar
                    </Button>
                  )}
                </CardTitle>
                <CardDescription>
                  Asocia un tag NFC a esta prenda para identificarla fácilmente
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedNfcTag ? (
                  <div className="space-y-3">
                    <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <div>
                          <p className="font-medium text-green-900 dark:text-green-100">
                            Tag NFC Asociado
                          </p>
                          <p className="text-sm text-green-700 dark:text-green-300 font-mono">
                            {selectedNfcTag}
                          </p>
                        </div>
                      </div>
                    </div>
                    {nfcDuplicate.exists && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          ⚠️ Este código NFC ya está registrado en la prenda: <strong>{nfcDuplicate.garmentName}</strong>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                ) : nfcMode === 'manual' ? (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="manual-nfc">Código NFC</Label>
                      <Input
                        id="manual-nfc"
                        value={manualNfcCode}
                        onChange={(e) => setManualNfcCode(e.target.value)}
                        placeholder="Ej: AA:BB:CC:DD:EE:FF o ABC123456789"
                        className="font-mono"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Ingresa el código que obtuviste de tu app NFC. Formatos válidos: MAC (XX:XX, XX:XX:XX:XX:XX, XX:XX:XX:XX:XX:XX, etc.) o hexadecimal largo.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleManualNfcSubmit}
                        className="flex-1"
                        disabled={associatingNfc}
                      >
                        {associatingNfc ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Asociando...
                          </>
                        ) : (
                          'Asociar Código'
                        )}
                      </Button>
                      <Button
                        onClick={() => setNfcMode(null)}
                        variant="outline"
                        className="flex-1"
                        disabled={associatingNfc}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : nfcMode === 'barcode' ? (
                  <div className="space-y-4">
                    {showBarcodeScanner ? (
                      <BarcodeScanner
                        key={barcodeScannerKey} // ✅ Forzar recreación del componente
                        onSuccess={(code) => {
                          setBarcodeCode(code)
                          setShowBarcodeScanner(false)
                          checkBarcodeDuplicate(code)
                          // ✅ Aumentar timeout para dar más tiempo a limpieza completa
                          setTimeout(() => {
                            setBarcodeScannerKey(prev => prev + 1)
                          }, 1000)
                        }}
                        onError={(error) => {
                          setError(`Error al escanear código de barras: ${error}`)
                        }}
                        onClose={() => {
                          setShowBarcodeScanner(false)
                          // ✅ Aumentar timeout para dar más tiempo a limpieza completa
                          setTimeout(() => {
                            setBarcodeScannerKey(prev => prev + 1)
                          }, 1000)
                        }}
                        title="Escanear Código de Barras"
                        description="Apunta la cámara hacia el código de barras de la etiqueta"
                        continuous={false}
                      />
                    ) : (
                      <>
                        <div>
                          <Label htmlFor="barcode">Código de Barras</Label>
                          <div className="flex gap-2">
                            <Input
                              id="barcode"
                              value={barcodeCode}
                              onChange={(e) => setBarcodeCode(e.target.value)}
                              placeholder="Ej: 1234567890123"
                              className="font-mono flex-1"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setBarcodeScannerKey(prev => prev + 1) // ✅ Nueva key antes de abrir
                                setShowBarcodeScanner(true)
                              }}
                            >
                              <Camera className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Ingresa el código manualmente o escanéalo con la cámara
                          </p>
                        </div>
                        {barcodeDuplicate.exists && (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              ⚠️ Este código de barras ya está registrado en la prenda: <strong>{barcodeDuplicate.garmentName}</strong>
                            </AlertDescription>
                          </Alert>
                        )}
                        <div className="flex gap-2">
                          <Button onClick={handleBarcodeSubmit} className="flex-1">
                            Registrar Código
                          </Button>
                          <Button
                            onClick={() => setNfcMode(null)}
                            variant="outline"
                            className="flex-1"
                          >
                            Cancelar
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ) : nfcMode ? (
                  <NFCScanner
                    mode={nfcMode}
                    onSuccess={handleNFCRead}
                    onError={handleNFCError}
                    expectedTagId={nfcMode === 'write' ? writeNfcTagId : undefined}
                    title={nfcMode === 'read' ? 'Escanear Tag Existente' : 'Crear Nuevo Tag'}
                    description={
                      nfcMode === 'read'
                        ? 'Acércate un tag NFC que ya contenga un ID para asociarlo a esta prenda'
                        : 'Acércate un tag NFC en blanco para escribir un nuevo ID único'
                    }
                  />
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Elige cómo quieres asociar un tag NFC a esta prenda:
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setNfcMode('read')}
                          className="text-sm"
                        >
                          Escanear Tag Existente
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setNfcMode('write')}
                          className="text-sm"
                        >
                          Crear Nuevo Tag
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setNfcMode('manual')}
                          className="text-sm"
                        >
                          📝 NFC Manual
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setNfcMode('barcode')}
                          className="text-sm"
                        >
                          📱 Código Barras
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      • <strong>Escanear:</strong> Lee un tag que ya tenga información (requiere NFC)
                      <br />
                      • <strong>Crear:</strong> Genera un nuevo ID y lo escribe en un tag vacío (requiere NFC)
                      <br />
                      • <strong>NFC Manual:</strong> Ingresa un código NFC que obtuviste de otra app
                      <br />
                      • <strong>Código Barras:</strong> Registra el código de barras de la etiqueta física
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 sm:pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            className="w-full sm:flex-1"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={saving}
            variant="outline"
            className="w-full sm:flex-1"
            onClick={() => { encadenarOtraRef.current = true }}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Guardar y añadir otra
              </>
            )}
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="w-full sm:flex-1"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Guardar Prenda</span>
                <span className="sm:hidden">Guardar</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
