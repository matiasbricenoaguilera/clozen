'use client'

import { useEffect, useState } from 'react'

export type ToastVariant = 'default' | 'success' | 'destructive'

export interface ToastMessage {
  id: string
  title?: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

type Listener = (toasts: ToastMessage[]) => void

// Store mínimo fuera de React: cualquier módulo puede lanzar un toast
// sin necesidad de tener un contexto a mano.
let toasts: ToastMessage[] = []
const listeners = new Set<Listener>()

const LIMIT = 3
const DEFAULT_DURATION = 5000

function emit() {
  listeners.forEach(listener => listener(toasts))
}

export function toast(options: Omit<ToastMessage, 'id'>) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  // Los más recientes primero; se descartan los que exceden el límite
  toasts = [{ id, duration: DEFAULT_DURATION, ...options }, ...toasts].slice(0, LIMIT)
  emit()
  return id
}

/** Atajos para los dos casos habituales */
toast.success = (description: string, title = 'Listo') =>
  toast({ title, description, variant: 'success' })

toast.error = (description: string, title = 'Error') =>
  toast({ title, description, variant: 'destructive' })

export function dismissToast(id: string) {
  toasts = toasts.filter(t => t.id !== id)
  emit()
}

export function useToast() {
  const [state, setState] = useState<ToastMessage[]>(toasts)

  useEffect(() => {
    listeners.add(setState)
    return () => {
      listeners.delete(setState)
    }
  }, [])

  return { toasts: state, toast, dismiss: dismissToast }
}
