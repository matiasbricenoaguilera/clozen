'use client'

import { AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export function SupabaseWarning() {
  return (
    <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
      <AlertTriangle className="h-4 w-4 text-yellow-600" />
      <AlertTitle className="text-yellow-800 dark:text-yellow-200">
        Modo Demo - Supabase No Configurado
      </AlertTitle>
      <AlertDescription className="text-yellow-700 dark:text-yellow-300">
        <p className="mb-3">
          La aplicación funciona en modo demo. Para usar autenticación, base de datos y funcionalidades completas,
          necesitas configurar Supabase.
        </p>
        <div className="flex gap-2">
          <Link href="/docs">
            <Button variant="outline" size="sm" className="border-yellow-300 text-yellow-800 hover:bg-yellow-100 dark:border-yellow-700 dark:text-yellow-200">
              📖 Ver Guía
            </Button>
          </Link>
          <Link href="https://supabase.com" target="_blank">
            <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700 text-white">
              🚀 Ir a Supabase
            </Button>
          </Link>
        </div>
      </AlertDescription>
    </Alert>
  )
}
