'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Package, MapPin, CheckCircle2, AlertCircle } from 'lucide-react'
import type { Garment, Box } from '@/types'

interface GarmentLocationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  garments: Garment[]
  boxes: Box[]
  onConfirm: () => void
  confirmLabel?: string
}

export function GarmentLocationModal({
  open,
  onOpenChange,
  garments,
  boxes,
  onConfirm,
  confirmLabel = 'Confirmar Uso'
}: GarmentLocationModalProps) {
  // Agrupar prendas por caja
  const garmentsByBox = garments.reduce((acc, garment) => {
    const boxId = garment.box_id || 'sin-caja'
    if (!acc[boxId]) {
      acc[boxId] = {
        box: boxes.find(b => b.id === boxId) || null,
        garments: []
      }
    }
    acc[boxId].garments.push(garment)
    return acc
  }, {} as Record<string, { box: Box | null, garments: Garment[] }>)

  const boxesList = Object.values(garmentsByBox)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            ¿Dónde buscar tus prendas?
          </DialogTitle>
          <DialogDescription>
            Estas son las cajas donde debes buscar las prendas seleccionadas
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {boxesList.map(({ box, garments }, index) => (
            <div
              key={box?.id || 'sin-caja'}
              className="border rounded-lg p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">
                      {box?.name || 'Sin caja asignada'}
                    </h3>
                    {box?.location && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <MapPin className="h-4 w-4" />
                        {box.location}
                      </div>
                    )}
                    {box?.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {box.description}
                      </p>
                    )}
                  </div>
                </div>
                <Badge variant="secondary">
                  {garments.length} {garments.length === 1 ? 'prenda' : 'prendas'}
                </Badge>
              </div>

              {/* Lista de prendas en esta caja */}
              <div className="pl-12 space-y-2">
                {garments.map(garment => (
                  <div
                    key={garment.id}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">{garment.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {garment.type}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Advertencia si hay prendas sin caja */}
          {garmentsByBox['sin-caja'] && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Prendas sin caja asignada
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  {garmentsByBox['sin-caja'].garments.length} prenda(s) no tienen caja asignada. 
                  Pueden estar en cualquier lugar o necesitan ser organizadas.
                </p>
              </div>
            </div>
          )}

          {/* Resumen de ubicaciones únicas */}
          {boxesList.filter(({ box }) => box).length > 0 && (
            <div className="pt-4 border-t">
              <p className="text-sm font-medium mb-2">Resumen:</p>
              <div className="flex flex-wrap gap-2">
                {boxesList
                  .filter(({ box }) => box)
                  .map(({ box, garments }) => (
                    <Badge key={box!.id} variant="outline">
                      <Package className="h-3 w-3 mr-1" />
                      {box!.name}: {garments.length}
                    </Badge>
                  ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={onConfirm} className="flex-1">
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

