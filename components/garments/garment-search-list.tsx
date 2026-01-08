'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Package, MapPin, CheckCircle2, AlertCircle, X, Check } from 'lucide-react'
import type { Garment, Box } from '@/types'

interface GarmentSearchListProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedGarments: Garment[]
  boxes: Box[]
  onConfirm: (garmentIds: string[]) => void
  onRemoveGarment: (garmentId: string) => void
  confirmLabel?: string
}

export function GarmentSearchList({
  open,
  onOpenChange,
  selectedGarments,
  boxes,
  onConfirm,
  onRemoveGarment,
  confirmLabel = 'Confirmar Retiro'
}: GarmentSearchListProps) {
  const [foundGarments, setFoundGarments] = useState<Set<string>>(new Set())

  // Agrupar prendas por caja
  const garmentsByBox = selectedGarments.reduce((acc, garment) => {
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

  // Ordenar cajas: primero por ubicación (si existe), luego por nombre
  const sortedBoxes = Object.values(garmentsByBox).sort((a, b) => {
    // Si ambas tienen ubicación, ordenar alfabéticamente por ubicación
    if (a.box?.location && b.box?.location) {
      return a.box.location.localeCompare(b.box.location)
    }
    // Si solo una tiene ubicación, ponerla primero
    if (a.box?.location && !b.box?.location) return -1
    if (!a.box?.location && b.box?.location) return 1
    // Si ninguna tiene ubicación, ordenar por nombre de caja
    if (a.box?.name && b.box?.name) {
      return a.box.name.localeCompare(b.box.name)
    }
    // Sin caja al final
    if (!a.box && b.box) return 1
    if (a.box && !b.box) return -1
    return 0
  })

  const toggleFound = (garmentId: string) => {
    setFoundGarments(prev => {
      const newSet = new Set(prev)
      if (newSet.has(garmentId)) {
        newSet.delete(garmentId)
      } else {
        newSet.add(garmentId)
      }
      return newSet
    })
  }

  const handleConfirm = () => {
    // Si hay prendas marcadas como encontradas, solo retirar esas
    // Si no hay ninguna marcada, retirar todas
    const garmentsToWithdraw = foundGarments.size > 0
      ? Array.from(foundGarments)
      : selectedGarments.map(g => g.id)
    
    onConfirm(garmentsToWithdraw)
    setFoundGarments(new Set())
  }

  const handleClose = () => {
    setFoundGarments(new Set())
    onOpenChange(false)
  }

  if (!open) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-50 animate-in fade-in-0"
        onClick={handleClose}
      />
      
      {/* Panel lateral */}
      <div className="fixed right-0 top-0 h-full w-full sm:w-[500px] bg-background shadow-xl z-50 animate-in slide-in-from-right">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="border-b p-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Package className="h-6 w-6" />
                Lista de Búsqueda
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedGarments.length} {selectedGarments.length === 1 ? 'prenda seleccionada' : 'prendas seleccionadas'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {sortedBoxes.map(({ box, garments }) => (
                <div
                  key={box?.id || 'sin-caja'}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
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
                    {garments.map(garment => {
                      const isFound = foundGarments.has(garment.id)
                      return (
                        <div
                          key={garment.id}
                          className={`flex items-center justify-between p-2 rounded border transition-colors ${
                            isFound
                              ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                              : 'bg-muted/50'
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <Checkbox
                              checked={isFound}
                              onCheckedChange={() => toggleFound(garment.id)}
                              id={`garment-${garment.id}`}
                            />
                            <label
                              htmlFor={`garment-${garment.id}`}
                              className="flex items-center gap-2 flex-1 cursor-pointer"
                            >
                              {isFound && (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              )}
                              <span className={`text-sm font-medium ${isFound ? 'line-through text-muted-foreground' : ''}`}>
                                {garment.name}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {garment.type}
                              </Badge>
                            </label>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => onRemoveGarment(garment.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )
                    })}
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

              {/* Resumen de ubicaciones */}
              {sortedBoxes.filter(({ box }) => box).length > 0 && (
                <div className="pt-4 border-t">
                  <p className="text-sm font-medium mb-2">Resumen de Cajas:</p>
                  <div className="flex flex-wrap gap-2">
                    {sortedBoxes
                      .filter(({ box }) => box)
                      .map(({ box, garments }) => (
                        <Badge key={box!.id} variant="outline">
                          <Package className="h-3 w-3 mr-1" />
                          {box!.name}: {garments.length}
                          {box!.location && (
                            <span className="ml-1 text-xs">({box!.location})</span>
                          )}
                        </Badge>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer con botones */}
          <div className="border-t p-4 space-y-2">
            {foundGarments.size > 0 && (
              <div className="text-sm text-muted-foreground">
                {foundGarments.size} de {selectedGarments.length} prendas marcadas como encontradas
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirm}
                className="flex-1"
                disabled={selectedGarments.length === 0}
              >
                <Check className="h-4 w-4 mr-2" />
                {confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

