'use client'

import { useCallback, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

export interface ConfirmOptions {
  title: string
  /** Cuerpo del diálogo. Los saltos de línea se respetan. */
  description?: string
  /** Texto del botón que confirma. Di lo que va a pasar: "Eliminar", "Liberar tag". */
  confirmLabel?: string
  cancelLabel?: string
  /** `true` para acciones destructivas (botón en rojo) */
  destructive?: boolean
}

/**
 * Confirmación en un diálogo de la propia app, no en un `confirm()` del navegador.
 *
 * Los diálogos nativos bloquean el hilo y, con él, los escáneres NFC y de
 * cámara, que dejan de recibir eventos hasta que alguien pulsa el botón.
 *
 * ```tsx
 * const { confirmar, dialogoDeConfirmacion } = useConfirm()
 * ...
 * if (!(await confirmar({ title: '¿Eliminar la prenda?', destructive: true }))) return
 * ...
 * return <>{dialogoDeConfirmacion}</>
 * ```
 */
export function useConfirm() {
  const [opciones, setOpciones] = useState<ConfirmOptions | null>(null)
  const resolverRef = useRef<((confirmado: boolean) => void) | null>(null)

  const confirmar = useCallback((nuevasOpciones: ConfirmOptions): Promise<boolean> => {
    setOpciones(nuevasOpciones)
    return new Promise<boolean>(resolve => {
      resolverRef.current = resolve
    })
  }, [])

  const responder = useCallback((confirmado: boolean) => {
    setOpciones(null)
    resolverRef.current?.(confirmado)
    resolverRef.current = null
  }, [])

  const dialogoDeConfirmacion = (
    <Dialog open={opciones !== null} onOpenChange={abierto => !abierto && responder(false)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{opciones?.title}</DialogTitle>
          {opciones?.description && (
            <DialogDescription className="whitespace-pre-line">
              {opciones.description}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => responder(false)}>
            {opciones?.cancelLabel || 'Cancelar'}
          </Button>
          <Button
            variant={opciones?.destructive ? 'destructive' : 'default'}
            onClick={() => responder(true)}
            autoFocus
          >
            {opciones?.confirmLabel || 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return { confirmar, dialogoDeConfirmacion }
}
