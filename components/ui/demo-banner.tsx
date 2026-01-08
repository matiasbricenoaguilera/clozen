'use client'

import { AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function DemoBanner() {
  return (
    <Alert className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950 mb-6">
      <AlertTriangle className="h-4 w-4 text-orange-600" />
      <AlertDescription className="text-orange-700 dark:text-orange-300">
        <strong>Modo Demo:</strong> Esta página muestra la interfaz completa, pero los datos no se guardan realmente.
        Configura Supabase para funcionalidad completa.
      </AlertDescription>
    </Alert>
  )
}



