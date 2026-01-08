'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FileUpload } from '@/components/ui/file-upload'
import { Loader2, AlertCircle, Save } from 'lucide-react'
import type { Garment, Box } from '@/types'

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

interface EditGarmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  garment: Garment | null
  boxes: Box[]
  onSuccess: () => void
}

export function EditGarmentModal({
  open,
  onOpenChange,
  garment,
  boxes,
  onSuccess
}: EditGarmentModalProps) {
  const { userProfile } = useAuth()
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    color: '',
    season: 'all' as 'verano' | 'invierno' | 'otoño' | 'primavera' | 'all',
    style: [] as string[],
    box_id: '',
    nfc_tag_id: '',
    barcode_id: ''
  })
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [nfcDuplicate, setNfcDuplicate] = useState<{ exists: boolean; garmentName?: string }>({ exists: false })
  const [barcodeDuplicate, setBarcodeDuplicate] = useState<{ exists: boolean; garmentName?: string }>({ exists: false })

  // Cargar datos de la prenda cuando se abre el modal
  useEffect(() => {
    if (garment && open) {
      setFormData({
        name: garment.name || '',
        type: garment.type || '',
        color: garment.color || '',
        season: (garment.season as any) || 'all',
        style: garment.style || [],
        box_id: garment.box_id || '',
        nfc_tag_id: garment.nfc_tag_id || '',
        barcode_id: (garment as any).barcode_id || ''
      })
      setImagePreview(garment.image_url || null)
      setSelectedImage(null)
      setError('')
    }
  }, [garment, open])

  // Función para verificar si un código NFC está duplicado (excluyendo la prenda actual)
  const checkNfcDuplicate = async (nfcTag: string) => {
    if (!nfcTag.trim() || !isSupabaseConfigured || !garment) {
      setNfcDuplicate({ exists: false })
      return
    }

    try {
      const { data, error } = await supabase
        .from('garments')
        .select('id, name')
        .eq('nfc_tag_id', nfcTag.trim())
        .neq('id', garment.id) // Excluir la prenda actual
        .single()

      if (data && !error) {
        setNfcDuplicate({ exists: true, garmentName: data.name })
      } else {
        setNfcDuplicate({ exists: false })
      }
    } catch (error) {
      // Si no se encuentra, no es duplicado
      setNfcDuplicate({ exists: false })
    }
  }

  // Función para verificar si un código de barras está duplicado (excluyendo la prenda actual)
  const checkBarcodeDuplicate = async (barcode: string) => {
    if (!barcode.trim() || !isSupabaseConfigured || !garment) {
      setBarcodeDuplicate({ exists: false })
      return
    }

    try {
      const { data, error } = await supabase
        .from('garments')
        .select('id, name')
        .eq('barcode_id', barcode.trim())
        .neq('id', garment.id) // Excluir la prenda actual
        .single()

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
    if (formData.nfc_tag_id && garment) {
      const timeoutId = setTimeout(() => {
        checkNfcDuplicate(formData.nfc_tag_id)
      }, 500) // Debounce de 500ms
      return () => clearTimeout(timeoutId)
    } else {
      setNfcDuplicate({ exists: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.nfc_tag_id, garment?.id])

  // Validar código de barras cuando cambia
  useEffect(() => {
    if (formData.barcode_id && garment) {
      const timeoutId = setTimeout(() => {
        checkBarcodeDuplicate(formData.barcode_id)
      }, 500) // Debounce de 500ms
      return () => clearTimeout(timeoutId)
    } else {
      setBarcodeDuplicate({ exists: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.barcode_id, garment?.id])

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleStyleToggle = (style: string) => {
    setFormData(prev => ({
      ...prev,
      style: prev.style.includes(style)
        ? prev.style.filter(s => s !== style)
        : [...prev.style, style]
    }))
  }

  const handleImageSelect = (file: File | null) => {
    setSelectedImage(file)
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    } else {
      setImagePreview(garment?.image_url || null)
    }
  }

  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (e) => {
        const img = document.createElement('img')
        img.src = e.target?.result as string
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const MAX_WIDTH = 1200
          const MAX_HEIGHT = 1200
          let width = img.width
          let height = img.height

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width
              width = MAX_WIDTH
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height
              height = MAX_HEIGHT
            }
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, width, height)

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now()
                })
                resolve(compressedFile)
              } else {
                resolve(file)
              }
            },
            'image/jpeg',
            0.8
          )
        }
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.name.trim() || !formData.type) {
      setError('Nombre y tipo de prenda son obligatorios')
      return
    }

    if (!garment || !userProfile) return

    setSaving(true)

    try {
      let imageUrl = garment.image_url

      // Subir nueva imagen si se seleccionó una
      if (selectedImage) {
        const compressedImage = await compressImage(selectedImage)
        const fileExt = 'jpg'
        const fileName = `${Date.now()}-${Math.random()}.${fileExt}`
        const filePath = `garments/${garment.user_id}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('garments')
          .upload(filePath, compressedImage)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('garments')
          .getPublicUrl(filePath)

        imageUrl = publicUrl
      }

      // Validar duplicados antes de actualizar
      if (formData.nfc_tag_id.trim() && nfcDuplicate.exists) {
        setError(`El código NFC "${formData.nfc_tag_id.trim()}" ya está registrado en la prenda "${nfcDuplicate.garmentName}"`)
        setSaving(false)
        return
      }

      if (formData.barcode_id.trim() && barcodeDuplicate.exists) {
        setError(`El código de barras "${formData.barcode_id.trim()}" ya está registrado en la prenda "${barcodeDuplicate.garmentName}"`)
        setSaving(false)
        return
      }

      // Actualizar prenda
      const updateData: any = {
        name: formData.name.trim(),
        type: formData.type,
        color: formData.color.trim() || null,
        season: formData.season,
        style: formData.style.length > 0 ? formData.style : null,
        box_id: formData.box_id || null,
        image_url: imageUrl,
        nfc_tag_id: formData.nfc_tag_id.trim() || null,
        barcode_id: formData.barcode_id.trim() || null,
        updated_at: new Date().toISOString()
      }

      const { error: updateError } = await supabase
        .from('garments')
        .update(updateData)
        .eq('id', garment.id)

      if (updateError) throw updateError

      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error('Error al actualizar prenda:', error)
      setError(error.message || 'Error al actualizar la prenda')
    } finally {
      setSaving(false)
    }
  }

  if (!garment) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Prenda</DialogTitle>
          <DialogDescription>
            Modifica la información de la prenda
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
                placeholder="Ej: Camisa azul"
              />
            </div>

            <div>
              <Label htmlFor="type">Tipo *</Label>
              <Select value={formData.type} onValueChange={(value) => handleChange('type', value)}>
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
              <Label htmlFor="color">Color</Label>
              <Input
                id="color"
                value={formData.color}
                onChange={(e) => handleChange('color', e.target.value)}
                placeholder="Ej: Azul, Rojo, Negro"
              />
            </div>

            <div>
              <Label htmlFor="season">Temporada</Label>
              <Select value={formData.season} onValueChange={(value: any) => handleChange('season', value)}>
                <SelectTrigger>
                  <SelectValue />
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
              <Label htmlFor="box_id">Caja</Label>
              <Select 
                value={formData.box_id || 'none'} 
                onValueChange={(value) => handleChange('box_id', value === 'none' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin caja" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin caja</SelectItem>
                  {boxes.map(box => (
                    <SelectItem key={box.id} value={box.id}>
                      {box.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Estilos</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {STYLES.map(style => (
                <Button
                  key={style}
                  type="button"
                  variant={formData.style.includes(style) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleStyleToggle(style)}
                >
                  {style}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="nfc_tag_id">Tag NFC</Label>
            <Input
              id="nfc_tag_id"
              value={formData.nfc_tag_id}
              onChange={(e) => handleChange('nfc_tag_id', e.target.value)}
              placeholder="ID del tag NFC (opcional)"
              className="font-mono"
            />
            {nfcDuplicate.exists && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  ⚠️ Este código NFC ya está registrado en la prenda: <strong>{nfcDuplicate.garmentName}</strong>
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div>
            <Label htmlFor="barcode_id">Código de Barras</Label>
            <Input
              id="barcode_id"
              value={formData.barcode_id}
              onChange={(e) => handleChange('barcode_id', e.target.value)}
              placeholder="Código de barras (opcional)"
              className="font-mono"
            />
            {barcodeDuplicate.exists && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  ⚠️ Este código de barras ya está registrado en la prenda: <strong>{barcodeDuplicate.garmentName}</strong>
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div>
            <Label>Imagen</Label>
            <FileUpload
              onFileSelect={(file) => handleImageSelect(file)}
              onFileRemove={() => handleImageSelect(null)}
              selectedFile={selectedImage}
              accept="image/*"
            />
            {imagePreview && !selectedImage && (
              <div className="mt-2">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-32 h-32 object-cover rounded-lg"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar Cambios
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

