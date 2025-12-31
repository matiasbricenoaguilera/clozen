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
import type { Box } from '@/types'

export default function AdminBoxesPage() {
  const { userProfile } = useAuth()
  const [boxes, setBoxes] = useState<Box[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingBox, setEditingBox] = useState<Box | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    nfcTagId: ''
  })
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
        const { error } = await supabase
          .from('boxes')
          .update({
            name: formData.name,
            description: formData.description,
            location: formData.location,
            nfc_tag_id: formData.nfcTagId || null
          })
          .eq('id', editingBox.id)

        if (error) throw error
      } else {
        // Crear nueva caja
        const { error } = await supabase
          .from('boxes')
          .insert({
            name: formData.name,
            description: formData.description,
            location: formData.location,
            nfc_tag_id: formData.nfcTagId || null,
            created_by: userProfile?.id
          })

        if (error) throw error
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
    if (!confirm('¿Estás seguro de que quieres eliminar esta caja?')) return

    // En modo demo, mostrar mensaje
    if (!isSupabaseConfigured) {
      alert('Modo demo: Las cajas no se eliminan realmente. Configura Supabase para funcionalidad completa.')
      return
    }

    try {
      const { error } = await supabase
        .from('boxes')
        .delete()
        .eq('id', boxId)

      if (error) throw error
      await fetchBoxes()
    } catch (error: any) {
      setError(error.message || 'Error al eliminar la caja')
    }
  }

  const handleEdit = (box: Box) => {
    setEditingBox(box)
    setFormData({
      name: box.name,
      description: box.description || '',
      location: box.location || '',
      nfcTagId: box.nfc_tag_id || ''
    })
    setDialogOpen(true)
  }

  const handleNFCRead = (tagId: string) => {
    setFormData(prev => ({ ...prev, nfcTagId: tagId }))
  }

  const resetForm = () => {
    setEditingBox(null)
    setFormData({
      name: '',
      description: '',
      location: '',
      nfcTagId: ''
    })
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
    </div>
  )
}
