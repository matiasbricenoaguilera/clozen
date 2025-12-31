'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'user' | 'admin'
  redirectTo?: string
}

export function ProtectedRoute({
  children,
  requiredRole = 'user',
  redirectTo = '/auth/login'
}: ProtectedRouteProps) {
  const { userProfile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!userProfile) {
        router.push(redirectTo)
        return
      }

      if (requiredRole === 'admin' && userProfile.role !== 'admin') {
        router.push('/closet') // Redirigir a closet si no es admin
        return
      }
    }
  }, [userProfile, loading, requiredRole, redirectTo, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!userProfile) {
    return null // No renderizar nada mientras redirige
  }

  if (requiredRole === 'admin' && userProfile.role !== 'admin') {
    return null // No renderizar nada mientras redirige
  }

  return <>{children}</>
}
