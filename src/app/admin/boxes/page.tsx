'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { NFCScanner } from '@/components/nfc/nfc-scanner'
import { DemoBanner } from '@/components/ui/demo-banner'
import { Plus, Package, Edit, Trash2, Smartphone, AlertCircle } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import type { Box } from '@/types'
import { DEFAULT_BOX_CAPACITY, getBoxMaxCapacity, countBoxGarments } from '@/utils/box-capacity'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { normalizeNFCTag } from '@/utils/nfc'

export default function AdminBoxesPage() {
  const { confirmar, dialogoDeConfirmacion } = useConfirm()
  const { userProfile } = useAuth()
  const [boxes, setBoxes] = useState<Box[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingBox, setEditingBox] = useState<Box | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    nfcTagId: '',
    maxCapacity: DEFAULT_BOX_CAPACITY // Valor por defecto
  })
  const [maxCapacityInput, setMaxCapacityInput] = useState(String(DEFAULT_BOX_CAPACITY)) // Input como string para permitir edición
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // En modo demo, mostrar interfaz vacía inmediatamente
    if (!isSupabaseConfigured) {
      setBoxes([])
      setLoading(false)
      return
    }

    fetchBoxes()
  }, [])

  const fetchBoxes = async () => {
    // En modo demo, devolver array vacío
    if (!isSupabaseConfigured) {
      setBoxes([])
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('boxes')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setBoxes(data || [])
    } catch (error) {
      console.error('Error fetching boxes:', error)
      // En caso de error, mostrar array vacío
      setBoxes([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    // En modo demo, mostrar mensaje y simular guardado
    if (!isSupabaseConfigured) {
      setTimeout(() => {
        setError('Modo demo: Las cajas no se guardan realmente. Configura Supabase para funcionalidad completa.')
        setSaving(false)
        setDialogOpen(false)
        resetForm()
      }, 1000)
      return
    }

    try {
      if (editingBox) {
        // Actualizar caja existente
        // `.select()` para confirmar que la fila se actualizó: si RLS rechaza la
        // escritura, PostgREST responde 200 sin error y con cero filas
        const { data: updated, error } = await supabase
          .from('boxes')
          .update({
            name: formData.name,
            description: formData.description,
            location: formData.location,
            nfc_tag_id: formData.nfcTagId || null,
            max_capacity: formData.maxCapacity || DEFAULT_BOX_CAPACITY
          })
          .eq('id', editingBox.id)
          .select('id')

        if (error) throw error

        if (!updated || updated.length === 0) {
          throw new Error('Los cambios no se guardaron. La caja ya no existe o tu usuario no tiene permiso para modificarla.')
        }

        // Si hay un tag NFC, actualizar o crear registro en nfc_tags
        if (formData.nfcTagId) {
          // Primero eliminar cualquier registro anterior para este tag
          await supabase
            .from('nfc_tags')
            .delete()
            .eq('tag_id', formData.nfcTagId)

          // Crear nuevo registro
          const { error: nfcError } = await supabase
            .from('nfc_tags')
            .insert({
              tag_id: formData.nfcTagId,
              entity_type: 'box',
              entity_id: editingBox.id,
              created_by: userProfile?.id
            })

          if (nfcError) throw nfcError
        } else {
          // Si no hay tag NFC, eliminar cualquier registro existente para esta caja
          await supabase
            .from('nfc_tags')
            .delete()
            .eq('entity_type', 'box')
            .eq('entity_id', editingBox.id)
        }
      } else {
        // Crear nueva caja
        const { data: newBox, error } = await supabase
          .from('boxes')
          .insert({
            name: formData.name,
            description: formData.description,
            location: formData.location,
            nfc_tag_id: formData.nfcTagId || null,
            max_capacity: formData.maxCapacity || DEFAULT_BOX_CAPACITY,
            created_by: userProfile?.id
          })
          .select()
          .single()

        if (error) throw error

        // Si hay un tag NFC, crear registro en nfc_tags
        if (formData.nfcTagId && newBox) {
          const { error: nfcError } = await supabase
            .from('nfc_tags')
            .insert({
              tag_id: formData.nfcTagId,
              entity_type: 'box',
              entity_id: newBox.id,
              created_by: userProfile?.id
            })

          if (nfcError) throw nfcError
        }
      }

      await fetchBoxes()
      setDialogOpen(false)
      resetForm()
    } catch (error: any) {
      setError(error.message || 'Error al guardar la caja')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (boxId: string) => {
    const confirmed = await confirmar({
      title: '¿Eliminar la caja?',
      description: 'La caja desaparecerá del sistema. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar caja',
      destructive: true
    })
    if (!confirmed) return

    // En modo demo, mostrar mensaje
    if (!isSupabaseConfigured) {
      toast({
        title: 'Modo demo',
        description: 'Las cajas no se eliminan realmente. Configura Supabase para la funcionalidad completa.'
      })
      return
    }

    try {
      // La FK garments.box_id impide borrar una caja con prendas dentro:
      // avisar antes en vez de dejar que Postgres devuelva su error crudo
      const prendasDentro = await countBoxGarments(boxId)
      if (prendasDentro > 0) {
        setError(
          `No se puede eliminar la caja: todavía tiene ${prendasDentro} prenda(s) dentro. ` +
            'Muévelas a otra caja desde Organizar y vuelve a intentarlo.'
        )
        return
      }

      // Primero eliminar el registro NFC si existe
      await supabase
        .from('nfc_tags')
        .delete()
        .eq('entity_type', 'box')
        .eq('entity_id', boxId)

      // Luego eliminar la caja (con `.select()` para confirmar que se borró)
      const { data: deleted, error } = await supabase
        .from('boxes')
        .delete()
        .eq('id', boxId)
        .select('id')

      if (error) throw error

      if (!deleted || deleted.length === 0) {
        throw new Error('La caja no se eliminó. Ya no existe o tu usuario no tiene permiso para eliminarla.')
      }

      await fetchBoxes()
    } catch (error: any) {
      setError(error.message || 'Error al eliminar la caja')
    }
  }

  const handleEdit = (box: Box) => {
    setEditingBox(box)
    const maxCapacity = getBoxMaxCapacity(box)
    setFormData({
      name: box.name,
      description: box.description || '',
      location: box.location || '',
      nfcTagId: box.nfc_tag_id || '',
      maxCapacity: maxCapacity
    })
    setMaxCapacityInput(String(maxCapacity)) // Sincronizar input string
    setDialogOpen(true)
  }

  const handleNFCRead = async (tagId: string) => {
    // Guardar y comparar siempre el código normalizado, como el alta de prendas
    const normalizedTagId = normalizeNFCTag(tagId)

    // En modo demo, simplemente asignar el tag
    if (!isSupabaseConfigured) {
      setFormData(prev => ({ ...prev, nfcTagId: normalizedTagId }))
      return
    }

    try {
      // Verificar si el tag ya está asignado a otra caja
      const { data: existingBox } = await supabase
        .from('boxes')
        .select('id, name')
        .eq('nfc_tag_id', normalizedTagId)
        .neq('id', editingBox?.id || '') // Excluir la caja actual si estamos editando
        .single()

      if (existingBox) {
        toast.error(`Este tag NFC ya está asignado a la caja "${existingBox.name}". Usa un tag diferente.`, 'Tag ocupado')
        return
      }

      // Verificar si el tag está asignado a una prenda
      const { data: existingGarment } = await supabase
        .from('garments')
        .select('id, name')
        .eq('nfc_tag_id', normalizedTagId)
        .single()

      if (existingGarment) {
        toast.error(`Este tag NFC ya está asignado a la prenda "${existingGarment.name}". Usa un tag diferente.`, 'Tag ocupado')
        return
      }

      // Si no hay conflictos, asignar el tag
      setFormData(prev => ({ ...prev, nfcTagId: normalizedTagId }))
    } catch (error) {
      // Si no encuentra registros (que es lo esperado), continuar
      setFormData(prev => ({ ...prev, nfcTagId: normalizedTagId }))
    }
  }

  const resetForm = () => {
    setEditingBox(null)
    setFormData({
      name: '',
      description: '',
      location: '',
      nfcTagId: '',
      maxCapacity: DEFAULT_BOX_CAPACITY
    })
    setMaxCapacityInput(String(DEFAULT_BOX_CAPACITY)) // Resetear input string
    setError('')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando cajas...</p>
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
          <h1 className="text-3xl font-bold">Administrar Cajas</h1>
          <p className="text-muted-foreground">
            Gestiona las cajas físicas de tu closet
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Caja
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingBox ? 'Editar Caja' : 'Crear Nueva Caja'}
              </DialogTitle>
              <DialogDescription>
                {editingBox ? 'Modifica los datos de la caja' : 'Agrega una nueva caja a tu sistema'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6">
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
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej: Caja Superior Izquierda"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="location">Ubicación</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="Ej: Estante superior, lado izquierdo"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Descripción</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descripción opcional de la caja"
                />
              </div>

              <div>
                <Label htmlFor="maxCapacity">Capacidad Máxima de Prendas *</Label>
                <Input
                  id="maxCapacity"
                  type="number"
                  min="1"
                  max="100"
                  value={maxCapacityInput}
                  onChange={(e) => {
                    const value = e.target.value
                    setMaxCapacityInput(value) // Permitir string vacío temporalmente
                    // Convertir a número solo si hay valor válido
                    const numValue = parseInt(value)
                    if (!isNaN(numValue) && numValue > 0) {
                      setFormData(prev => ({ ...prev, maxCapacity: numValue }))
                    }
                  }}
                  onBlur={(e) => {
                    // Al perder el foco, asegurar valor válido
                    const numValue = parseInt(e.target.value)
                    if (isNaN(numValue) || numValue < 1) {
                      setMaxCapacityInput(String(DEFAULT_BOX_CAPACITY))
                      setFormData(prev => ({ ...prev, maxCapacity: DEFAULT_BOX_CAPACITY }))
                    }
                  }}
                  placeholder="15"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Número máximo de prendas que puede contener esta caja
                </p>
              </div>

              {/* NFC Scanner */}
              <div>
                <Label>Tag NFC</Label>
                <div className="mt-2 space-y-4">
                  <div>
                    <Label htmlFor="nfcTagId">ID del Tag (opcional)</Label>
                    <Input
                      id="nfcTagId"
                      value={formData.nfcTagId}
                      onChange={(e) => setFormData(prev => ({ ...prev, nfcTagId: e.target.value }))}
                      placeholder="Ingresa manualmente o escanea"
                      className="mt-1"
                    />
                  </div>

                  <NFCScanner
                    mode="read"
                    onSuccess={handleNFCRead}
                    title="Escanear Tag NFC de Caja"
                    description="Escanea el tag NFC que identificar esta caja"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving} className="flex-1">
                  {saving ? 'Guardando...' : (editingBox ? 'Actualizar' : 'Crear')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Boxes Grid */}
      {boxes.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No hay cajas registradas</h3>
          <p className="text-muted-foreground mb-4">
            Comienza creando tu primera caja para organizar las prendas
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {boxes.map(box => (
            <Card key={box.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  {box.name}
                </CardTitle>
                <CardDescription>
                  {box.location || 'Sin ubicación especificada'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {box.description && (
                    <p className="text-sm text-muted-foreground">{box.description}</p>
                  )}

                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-blue-600">
                      Capacidad: {getBoxMaxCapacity(box)} prendas
                    </span>
                  </div>

                  {box.nfc_tag_id ? (
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-600">Tag NFC: {box.nfc_tag_id}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Sin tag NFC</span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(box)}
                      className="flex-1"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(box.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {dialogoDeConfirmacion}
    </div>
  )
}
