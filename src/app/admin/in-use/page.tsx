'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Shirt, RefreshCw, Calendar, User, Copy, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface InUseGarment {
  id: string
  name: string
  type: string
  user_id: string
  last_used: string
  usage_count: number
  nfc_tag_id: string | null
  barcode_id: string | null
  users: {
    id: string
    email: string
    full_name: string | null
  }
}

export default function AdminInUsePage() {
  const { userProfile, loading: authLoading } = useAuth()
  const router = useRouter()
  const [garments, setGarments] = useState<InUseGarment[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && userProfile) {
      if (userProfile.role !== 'admin') {
        router.push('/closet')
        return
      }
      loadInUseGarments()
    } else if (!authLoading && !userProfile) {
      router.push('/auth/login')
    }
  }, [userProfile, authLoading])

  const loadInUseGarments = async () => {
    if (!isSupabaseConfigured) {
      setGarments([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('garments')
        .select(`
          id,
          name,
          type,
          user_id,
          last_used,
          usage_count,
          nfc_tag_id,
          barcode_id,
          users:user_id (
            id,
            email,
            full_name
          )
        `)
        .eq('status', 'in_use')
        .order('last_used', { ascending: false })

      if (error) throw error
      setGarments(data || [])
    } catch (error) {
      console.error('Error loading in-use garments:', error)
      setGarments([])
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadInUseGarments()
    setRefreshing(false)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getDaysInUse = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const getGarmentCode = (garment: InUseGarment): string | null => {
    return garment.nfc_tag_id || garment.barcode_id || null
  }

  const copyToClipboard = async (text: string, garmentId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(garmentId)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (error) {
      console.error('Error al copiar:', error)
    }
  }

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando prendas en uso...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Shirt className="h-6 w-6 sm:h-8 sm:w-8" />
            Prendas en Uso
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
            Lista de todas las prendas que están siendo utilizadas actualmente
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={refreshing}
          className="w-full sm:w-auto"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {garments.length === 0 
              ? 'No hay prendas en uso' 
              : `${garments.length} ${garments.length === 1 ? 'prenda' : 'prendas'} en uso`}
          </CardTitle>
          <CardDescription>
            Prendas que han sido retiradas y están siendo utilizadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {garments.length === 0 ? (
            <div className="text-center py-12">
              <Shirt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No hay prendas en uso en este momento
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Desktop Table Header */}
              <div className="hidden md:grid grid-cols-6 gap-4 p-3 bg-muted/50 rounded-lg font-semibold text-sm">
                <div>Prenda</div>
                <div>Tipo</div>
                <div>Dueño</div>
                <div>Código</div>
                <div>Fecha de Inicio</div>
                <div>Días en Uso</div>
              </div>
              {garments.map((garment) => {
                const daysInUse = getDaysInUse(garment.last_used)
                return (
                  <div
                    key={garment.id}
                    className="grid grid-cols-1 md:grid-cols-6 gap-3 md:gap-4 p-3 md:p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    {/* Mobile Card Layout */}
                    <div className="md:hidden space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2 flex-1">
                          <Shirt className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium">{garment.name}</span>
                        </div>
                        <Badge variant="outline">{garment.type}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm truncate">
                          {garment.users.full_name || garment.users.email}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getGarmentCode(garment) ? (
                          <>
                            <code className="text-xs bg-muted px-2 py-1 rounded font-mono flex-1 truncate">
                              {getGarmentCode(garment)}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 flex-shrink-0"
                              onClick={() => copyToClipboard(getGarmentCode(garment)!, garment.id)}
                              title="Copiar código"
                            >
                              {copiedId === garment.id ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sin código</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(garment.last_used)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={daysInUse > 7 ? "destructive" : daysInUse > 3 ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {daysInUse === 0 
                              ? 'Hoy' 
                              : daysInUse === 1 
                              ? '1 día' 
                              : `${daysInUse} días`}
                          </Badge>
                          {garment.usage_count > 0 && (
                            <span className="text-xs text-muted-foreground">
                              ({garment.usage_count} {garment.usage_count === 1 ? 'uso' : 'usos'})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Desktop Table Layout */}
                    <div className="hidden md:flex items-center">
                      <Shirt className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium truncate">{garment.name}</span>
                    </div>
                    <div className="hidden md:flex items-center">
                      <Badge variant="outline">{garment.type}</Badge>
                    </div>
                    <div className="hidden md:flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm truncate">
                        {garment.users.full_name || garment.users.email}
                      </span>
                    </div>
                    <div className="hidden md:flex items-center gap-2">
                      {getGarmentCode(garment) ? (
                        <>
                          <code className="text-xs bg-muted px-2 py-1 rounded font-mono truncate max-w-[120px]">
                            {getGarmentCode(garment)}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 flex-shrink-0"
                            onClick={() => copyToClipboard(getGarmentCode(garment)!, garment.id)}
                            title="Copiar código"
                          >
                            {copiedId === garment.id ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin código</span>
                      )}
                    </div>
                    <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{formatDate(garment.last_used)}</span>
                    </div>
                    <div className="hidden md:flex items-center">
                      <Badge 
                        variant={daysInUse > 7 ? "destructive" : daysInUse > 3 ? "default" : "secondary"}
                      >
                        {daysInUse === 0 
                          ? 'Hoy' 
                          : daysInUse === 1 
                          ? '1 día' 
                          : `${daysInUse} días`}
                      </Badge>
                      {garment.usage_count > 0 && (
                        <span className="text-xs text-muted-foreground ml-2">
                          ({garment.usage_count} {garment.usage_count === 1 ? 'uso' : 'usos'})
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

