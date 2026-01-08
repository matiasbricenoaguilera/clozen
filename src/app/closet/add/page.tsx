'use client'

import { useState, useEffect } from 'react'
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
import { DemoBanner } from '@/components/ui/demo-banner'
import { ArrowLeft, Save, AlertCircle } from 'lucide-react'
import type { Box, GarmentForm } from '@/types'

const GARMENT_TYPES = [
  'camisa', 'pantalon', 'vestido', 'falda', 'chaqueta', 'abrigo',
  'zapatos', 'accesorios', 'ropa interior', 'pijama', 'deportiva'
]

const SEASONS = [
  { value: 'verano', label: 'Verano' },
  { value: 'invierno', label: 'Invierno' },
  { value: 'otoño', label: 'Otoño' },
  { value: 'primavera', label: 'Primavera' },
  { value: 'all', label: 'Todo el año' }
]

const STYLES = [
  'casual', 'formal', 'deportivo', 'elegante', 'bohemio', 'clásico',
  'moderno', 'vintage', 'minimalista', 'colorido'
]

export default function AddGarmentPage() {
  const { userProfile, loading: authLoading } = useAuth()
  const router = useRouter()
  const [boxes, setBoxes] = useState<Box[]>([])
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [nfcMode, setNfcMode] = useState<'read' | 'write' | 'manual' | 'barcode' | null>(null)
  const [selectedNfcTag, setSelectedNfcTag] = useState<string>('')
  const [manualNfcCode, setManualNfcCode] = useState<string>('')
  const [barcodeCode, setBarcodeCode] = useState<string>('')
  const [associatingNfc, setAssociatingNfc] = useState(false) // Estado para feedback visual NFC
  const [accessDenied, setAccessDenied] = useState(false) // Estado para acceso denegado

  const [formData, setFormData] = useState<GarmentForm>({
    name: '',
    type: '',
    season: undefined,
    style: [],
    boxId: '',
    image: undefined
  })

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

    // Si es admin, cargar cajas normalmente
    fetchBoxes()
  }, [userProfile, authLoading, router])

  const fetchBoxes = async () => {
    // En modo demo, mostrar array vacío
    if (!isSupabaseConfigured) {
      setBoxes([])
      return
    }

    try {
      // Obtener cajas con conteo de prendas
      const { data, error } = await supabase
        .from('boxes')
        .select(`
          *,
          garments(count)
        `)
        .order('name')

      if (error) throw error

      // Transformar los datos para incluir el conteo
      const boxesWithCount = (data || []).map((box: any) => ({
        ...box,
        garment_count: box.garments?.[0]?.count ?? 0
      }))

      setBoxes(boxesWithCount)
    } catch (error) {
      console.error('Error fetching boxes:', error)
      // En caso de error, mostrar array vacío
      setBoxes([])
    }
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
        const filePath = `garments/${userProfile.id}/${fileName}`

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

      // Crear prenda
      console.time('👕 Garment Insert Time')
      console.log('💾 Insertando prenda en BD:', {
        userId: userProfile.id,
        name: formData.name.trim(),
        type: formData.type,
        hasImage: !!imageUrl,
        hasBox: !!formData.boxId,
        hasNfc: !!selectedNfcTag,
        hasBarcode: !!barcodeCode.trim()
      })

      const { data: garmentData, error: insertError } = await supabase
        .from('garments')
        .insert({
          user_id: userProfile.id,
          name: formData.name.trim(),
          type: formData.type,
          season: formData.season,
          style: formData.style,
          image_url: imageUrl,
          box_id: formData.boxId || null,
          nfc_tag_id: selectedNfcTag || null,
          barcode_id: barcodeCode.trim() || null,
          status: 'available'
        })
        .select()
        .single()

      if (insertError) {
        console.error('❌ Error insertando prenda:', insertError)
        throw insertError
      }

      console.timeEnd('👕 Garment Insert Time')
      console.log('✅ Prenda creada exitosamente:', garmentData?.id)

      // Registrar el tag NFC en la tabla nfc_tags si existe
      // Esta operación es independiente y no bloquea el éxito general
      if (selectedNfcTag && garmentData) {
        console.time('📱 NFC Registration Time')
        console.log('🏷️ Registrando tag NFC:', selectedNfcTag)

        // Ejecutar en background sin await para no bloquear
        supabase
          .from('nfc_tags')
          .insert({
            tag_id: selectedNfcTag,
            entity_type: 'garment',
            entity_id: garmentData.id,
            created_by: userProfile.id
          })
          .then(({ error: nfcError }: { error: any }) => {
            console.timeEnd('📱 NFC Registration Time')
            if (nfcError) {
              console.error('❌ Error registrando tag NFC:', nfcError)
            } else {
              console.log('✅ Tag NFC registrado exitosamente')
            }
          })
      }

      console.log('🔄 Redirigiendo al closet...')
      console.timeEnd('🕐 Total Submit Time')
      console.log('🔄 Redirigiendo al closet...')
      console.timeEnd('🕐 Total Submit Time')
      router.push('/closet')
    } catch (error: any) {
      console.error('💥 Error en submit:', error)
      console.timeEnd('🕐 Total Submit Time')

      // Mejor manejo de errores para el usuario
      let errorMessage = 'Error al guardar la prenda'

      if (error.message?.includes('storage')) {
        errorMessage = 'Error al subir la imagen. Verifica el tamaño y conexión.'
      } else if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
        errorMessage = 'Ya existe una prenda con ese código NFC o barras.'
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMessage = 'Error de conexión. Verifica tu internet.'
      } else if (error.message) {
        errorMessage = error.message
      }

      setError(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handleImageSelect = (file: File) => {
    setSelectedImage(file)
  }

  const handleImageRemove = () => {
    setSelectedImage(null)
  }

  const handleNFCRead = (tagId: string) => {
    setSelectedNfcTag(tagId)
    setNfcMode(null) // Cerrar el scanner después de leer
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
      // Simular procesamiento
      await new Promise(resolve => setTimeout(resolve, 500))

      // Aquí podríamos validar que el barcode no existe, pero por simplicidad
      // lo asignamos directamente. El barcode se puede usar para identificar prendas
      // en procesos futuros (como organización post-lavado)
      console.log('Código de barras registrado:', barcodeCode.trim())
      setBarcodeCode('')
      setNfcMode(null)
    } catch (error) {
      setError('Error al procesar el código de barras')
    } finally {
      setAssociatingNfc(false)
    }
  }

  // Validar formato de código NFC manual
  const validateNfcCode = (code: string): boolean => {
    // Formatos válidos:
    // - MAC address: XX:XX:XX:XX:XX:XX
    // - Hexadecimal largo: al menos 8 caracteres hexadecimales
    const macRegex = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/
    const hexRegex = /^[0-9A-Fa-f]{8,}$/

    return macRegex.test(code) || hexRegex.test(code)
  }

  const handleManualNfcSubmit = async () => {
    if (!manualNfcCode.trim()) {
      setError('Ingresa un código NFC válido')
      return
    }

    if (!validateNfcCode(manualNfcCode.trim())) {
      setError('Formato inválido. Usa formato MAC (XX:XX:XX:XX:XX:XX) o código hexadecimal largo')
      return
    }

    setAssociatingNfc(true)
    setError('')

    try {
      // Simular un pequeño delay para mejor UX y feedback visual
      await new Promise(resolve => setTimeout(resolve, 500))

      // Aquí podríamos verificar si el tag ya existe, pero por simplicidad
      // lo permitiremos y dejaremos que la base de datos maneje la validación
      setSelectedNfcTag(manualNfcCode.trim().toUpperCase())
      setManualNfcCode('')
      setNfcMode(null)
    } catch (error) {
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
    <div className="max-w-4xl mx-auto space-y-6">
      {!isSupabaseConfigured && <DemoBanner />}

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Agregar Prenda</h1>
          <p className="text-muted-foreground">
            Agrega una nueva prenda a tu closet digital
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                <div>
                  <Label htmlFor="name">Nombre *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej: Camisa azul formal"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="type">Tipo de prenda *</Label>
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
                  <Label htmlFor="season">Temporada</Label>
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
                    onValueChange={(value) => setFormData(prev => ({ ...prev, boxId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una caja (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {boxes.map(box => (
                        <SelectItem key={box.id} value={box.id}>
                          {box.name}
                          {box.garment_count !== undefined && (
                            <span className="text-muted-foreground text-xs ml-2">
                              ({box.garment_count} prendas)
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Estilos */}
            <Card>
              <CardHeader>
                <CardTitle>Estilos</CardTitle>
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
                        Ingresa el código que obtuviste de tu app NFC. Formatos válidos: MAC (XX:XX:XX:XX:XX:XX) o hexadecimal largo.
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
                    <div>
                      <Label htmlFor="barcode">Código de Barras</Label>
                      <Input
                        id="barcode"
                        value={barcodeCode}
                        onChange={(e) => setBarcodeCode(e.target.value)}
                        placeholder="Ej: 1234567890123"
                        className="font-mono"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Ingresa el código de barras de la etiqueta de la prenda. Este código se usará para identificar la prenda durante la organización post-lavado.
                      </p>
                    </div>
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
                  </div>
                ) : nfcMode ? (
                  <NFCScanner
                    mode={nfcMode}
                    onSuccess={handleNFCRead}
                    onError={handleNFCError}
                    expectedTagId={nfcMode === 'write' ? '' : undefined}
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
                      <div className="grid grid-cols-2 gap-2">
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
                      <div className="grid grid-cols-2 gap-2">
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
        <div className="flex gap-4 pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="flex-1"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Guardar Prenda
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
