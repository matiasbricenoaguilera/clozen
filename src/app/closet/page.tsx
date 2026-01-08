'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DemoBanner } from '@/components/ui/demo-banner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { NFCScanner } from '@/components/nfc/nfc-scanner'
import { Plus, Search, Shirt, Package, Filter, Smartphone, Scan } from 'lucide-react'
import { findEntityByNFCTag } from '@/utils/nfc'
import type { Garment, Box } from '@/types'

export default function ClosetPage() {
  const { userProfile, loading: authLoading } = useAuth()
  const [garments, setGarments] = useState<Garment[]>([])
  const [boxes, setBoxes] = useState<Box[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBox, setSelectedBox] = useState<string>('')
  const [showNFCScanner, setShowNFCScanner] = useState(false)
  const [foundGarment, setFoundGarment] = useState<Garment | null>(null)
  const [nfcError, setNfcError] = useState('')

  useEffect(() => {
    // En modo demo (sin Supabase), mostrar interfaz vacía inmediatamente
    if (!isSupabaseConfigured) {
      setGarments([])
      setBoxes([])
      setLoading(false)
      return
    }

    // En modo real, esperar a que la autenticación se resuelva
    if (!authLoading && userProfile) {
      fetchGarments()
      fetchBoxes()
    } else if (!authLoading && !userProfile) {
      // Usuario no autenticado en modo real
      setGarments([])
      setBoxes([])
      setLoading(false)
    }
  }, [userProfile, authLoading, isSupabaseConfigured])

  const fetchGarments = async () => {
    // En modo demo, devolver array vacío
    if (!isSupabaseConfigured) {
      setGarments([])
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('garments')
        .select(`
          *,
          boxes (
            id,
            name
          )
        `)
        .eq('user_id', userProfile?.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setGarments(data || [])
    } catch (error) {
      console.error('Error fetching garments:', error)
      // En caso de error, mostrar array vacío
      setGarments([])
    } finally {
      setLoading(false)
    }
  }

  const fetchBoxes = async () => {
    // En modo demo, devolver array vacío
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

  const filteredGarments = garments.filter(garment => {
    const matchesSearch = garment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         garment.type.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesBox = !selectedBox || garment.box_id === selectedBox
    return matchesSearch && matchesBox
  })

  const getBoxName = (boxId: string | null) => {
    if (!boxId) return 'Sin caja'
    const box = boxes.find(b => b.id === boxId)
    return box?.name || 'Caja desconocida'
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando tu closet...</p>
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
          <h1 className="text-3xl font-bold">Mi Closet</h1>
          <p className="text-muted-foreground">
            {filteredGarments.length} prendas en total
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowNFCScanner(true)}
          >
            <Scan className="h-4 w-4 mr-2" />
            Escanear Prenda
          </Button>
          <Link href="/closet/add">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Agregar Prenda
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar prendas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={selectedBox}
          onChange={(e) => setSelectedBox(e.target.value)}
          className="px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
          {!searchTerm && !selectedBox && (
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Agregar Primera Prenda
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredGarments.map(garment => (
            <Card key={garment.id} className="group cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="aspect-square bg-muted rounded-lg mb-3 flex items-center justify-center">
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
                <CardTitle className="text-lg line-clamp-1">{garment.name}</CardTitle>
                <CardDescription className="flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  {getBoxName(garment.box_id)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{garment.type}</Badge>
                  {garment.nfc_tag_id && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Smartphone className="h-3 w-3" />
                      NFC
                    </Badge>
                  )}
                  {garment.color && (
                    <Badge variant="outline">{garment.color}</Badge>
                  )}
                  {garment.season && (
                    <Badge variant="outline">{garment.season}</Badge>
                  )}
                </div>
                {garment.usage_count > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Usada {garment.usage_count} {garment.usage_count === 1 ? 'vez' : 'veces'}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* NFC Scanner Dialog */}
      <Dialog open={showNFCScanner} onOpenChange={setShowNFCScanner}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Escanear Prenda NFC</DialogTitle>
            <DialogDescription>
              Acércate un tag NFC de una prenda para identificarla
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Smartphone className="h-3 w-3" />
                      NFC: {foundGarment.nfc_tag_id}
                    </Badge>
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
    </div>
  )
}
