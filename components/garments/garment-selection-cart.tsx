'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ShoppingCart, Package, X } from 'lucide-react'
import type { Garment, Box } from '@/types'

interface GarmentSelectionCartProps {
  selectedGarments: Garment[]
  boxes: Box[]
  onOpenList: () => void
  onRemoveGarment: (garmentId: string) => void
}

export function GarmentSelectionCart({
  selectedGarments,
  boxes,
  onOpenList,
  onRemoveGarment
}: GarmentSelectionCartProps) {
  if (selectedGarments.length === 0) return null

  // Contar cajas únicas
  const uniqueBoxes = new Set(
    selectedGarments
      .map(g => g.box_id)
      .filter(Boolean)
  )

  // Agrupar prendas por caja para mostrar resumen
  const garmentsByBox = selectedGarments.reduce((acc, garment) => {
    const boxId = garment.box_id || 'sin-caja'
    if (!acc[boxId]) {
      acc[boxId] = {
        box: boxes.find(b => b.id === boxId) || null,
        count: 0
      }
    }
    acc[boxId].count++
    return acc
  }, {} as Record<string, { box: Box | null, count: number }>)

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5">
      <div className="bg-background border rounded-lg shadow-lg p-4 min-w-[300px] max-w-[400px]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Lista de Búsqueda</h3>
          </div>
          <Badge variant="secondary">{selectedGarments.length}</Badge>
        </div>

        <div className="space-y-2 mb-3">
          <p className="text-sm text-muted-foreground">
            {selectedGarments.length} {selectedGarments.length === 1 ? 'prenda seleccionada' : 'prendas seleccionadas'}
          </p>
          <p className="text-xs text-muted-foreground">
            En {uniqueBoxes.size} {uniqueBoxes.size === 1 ? 'caja' : 'cajas'}
          </p>
          
          {/* Resumen de cajas */}
          <div className="flex flex-wrap gap-1 mt-2">
            {Object.values(garmentsByBox)
              .filter(({ box }) => box)
              .slice(0, 3)
              .map(({ box, count }) => (
                <Badge key={box!.id} variant="outline" className="text-xs">
                  <Package className="h-3 w-3 mr-1" />
                  {box!.name}: {count}
                </Badge>
              ))}
            {Object.values(garmentsByBox).filter(({ box }) => box).length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{Object.values(garmentsByBox).filter(({ box }) => box).length - 3} más
              </Badge>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={onOpenList}
            className="flex-1"
            size="sm"
          >
            Ver Lista Completa
          </Button>
        </div>
      </div>
    </div>
  )
}

