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
  const { userProfile } = useAuth()
  const router = useRouter()
  const [boxes, setBoxes] = useState<Box[]>([])
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [nfcMode, setNfcMode] = useState<'read' | 'write' | null>(null)
  const [selectedNfcTag, setSelectedNfcTag] = useState<string>('')

  const [formData, setFormData] = useState<GarmentForm>({
    name: '',
    type: '',
    season: undefined,
    style: [],
    boxId: '',
    image: undefined
  })

  useEffect(() => {
    fetchBoxes()
  }, [])

  const fetchBoxes = async () => {
    // En modo demo, mostrar array vacío
    if (!isSupabaseConfigured) {
      setBoxes([])
      return
    }

    try {
      const { data, error } = await supabase
        .from('boxes')
        .select('*')
        .order('name')

      if (error) throw error
      setBoxes(data || [])
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

      // Subir imagen si existe
      if (selectedImage) {
        const fileExt = selectedImage.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random()}.${fileExt}`
        const filePath = `garments/${userProfile.id}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('garments')
          .upload(filePath, selectedImage)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('garments')
          .getPublicUrl(filePath)

        imageUrl = publicUrl
      }

      // Crear prenda
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
          nfc_tag_id: selectedNfcTag || null
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Registrar el tag NFC en la tabla nfc_tags si existe
      if (selectedNfcTag && garmentData) {
        const { error: nfcError } = await supabase
          .from('nfc_tags')
          .insert({
            tag_id: selectedNfcTag,
            entity_type: 'garment',
            entity_id: garmentData.id,
            created_by: userProfile.id
          })

        if (nfcError) {
          console.error('Error registrando tag NFC:', nfcError)
          // No lanzamos error aquí para no bloquear el guardado de la prenda
        }
      }

      router.push('/closet')
    } catch (error: any) {
      setError(error.message || 'Error al guardar la prenda')
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
    setNfcMode(null)
  }

  const toggleStyle = (style: string) => {
    setFormData(prev => ({
      ...prev,
      style: prev.style.includes(style)
        ? prev.style.filter(s => s !== style)
        : [...prev.style, style]
    }))
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
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setNfcMode('read')}
                        className="flex-1"
                      >
                        Escanear Tag Existente
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setNfcMode('write')}
                        className="flex-1"
                      >
                        Crear Nuevo Tag
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      • <strong>Escanear:</strong> Lee un tag que ya tenga información
                      <br />
                      • <strong>Crear:</strong> Genera un nuevo ID y lo escribe en un tag vacío
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
