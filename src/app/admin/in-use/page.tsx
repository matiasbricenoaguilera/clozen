'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Shirt, RefreshCw, Calendar, User, Copy, Check, RotateCcw, Package, AlertCircle } from 'lucide-react'
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
  box_id: string | null
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
  const [restoringGarmentId, setRestoringGarmentId] = useState<string | null>(null)
  const [restoredGarmentInfo, setRestoredGarmentInfo] = useState<{ id: string; name: string; hasBox: boolean } | null>(null)

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
          box_id,
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

  const restoreGarment = async (garmentId: string) => {
    if (!isSupabaseConfigured) return

    setRestoringGarmentId(garmentId)
    
    try {
      // Obtener información de la prenda antes de restaurar
      const { data: garment, error: fetchError } = await supabase
        .from('garments')
        .select('id, name, box_id')
        .eq('id', garmentId)
        .single()

      if (fetchError) throw fetchError

      // Restaurar la prenda (cambiar status a 'available' y quitar caja asignada)
      const { error: updateError } = await supabase
        .from('garments')
        .update({
          status: 'available',
          box_id: null, // Quitar caja asignada al restaurar
          updated_at: new Date().toISOString()
        })
        .eq('id', garmentId)

      if (updateError) throw updateError

      // Mostrar información - siempre sin caja después de restaurar
      setRestoredGarmentInfo({
        id: garment.id,
        name: garment.name,
        hasBox: false // Siempre false porque se quitó la caja al restaurar
      })

      // Recargar la lista de prendas en uso
      await loadInUseGarments()

      // Limpiar el mensaje después de 5 segundos
      setTimeout(() => {
        setRestoredGarmentInfo(null)
      }, 5000)

      console.log('✅ Prenda restaurada exitosamente')
    } catch (error) {
      console.error('❌ Error al restaurar prenda:', error)
    } finally {
      setRestoringGarmentId(null)
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
              <div className="hidden md:grid grid-cols-7 gap-4 p-3 bg-muted/50 rounded-lg font-semibold text-sm">
                <div>Prenda</div>
                <div>Tipo</div>
                <div>Dueño</div>
                <div>Código</div>
                <div>Fecha de Inicio</div>
                <div>Días en Uso</div>
                <div>Acciones</div>
              </div>
              {garments.map((garment) => {
                const daysInUse = getDaysInUse(garment.last_used)
                return (
                  <div
                    key={garment.id}
                    className="grid grid-cols-1 md:grid-cols-7 gap-3 md:gap-4 p-3 md:p-3 border rounded-lg hover:bg-muted/50 transition-colors"
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
                          <Badge variant="destructive" className="text-xs">
                            ⚠️ Sin código
                          </Badge>
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
                      <div className="mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => restoreGarment(garment.id)}
                          disabled={restoringGarmentId === garment.id}
                          className="w-full"
                        >
                          {restoringGarmentId === garment.id ? (
                            <>
                              <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                              Restaurando...
                            </>
                          ) : (
                            <>
                              <RotateCcw className="h-3 w-3 mr-2" />
                              Restaurar al Closet
                            </>
                          )}
                        </Button>
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
                        <Badge variant="destructive" className="text-xs">
                          ⚠️ Sin código
                        </Badge>
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
                    <div className="hidden md:flex items-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => restoreGarment(garment.id)}
                        disabled={restoringGarmentId === garment.id}
                      >
                        {restoringGarmentId === garment.id ? (
                          <>
                            <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                            Restaurando...
                          </>
                        ) : (
                          <>
                            <RotateCcw className="h-3 w-3 mr-2" />
                            Restaurar
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alerta cuando se restaura una prenda - siempre sin caja */}
      {restoredGarmentInfo && (
        <Card className="border-2 border-yellow-200 dark:border-yellow-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">
                  ✅ Prenda "{restoredGarmentInfo.name}" restaurada al closet
                </p>
                <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-yellow-600" />
                    <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                      ⚠️ Esta prenda NO tiene caja asignada
                    </p>
                  </div>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                    Asigna una caja a esta prenda desde el panel de organización para facilitar su localización.
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRestoredGarmentInfo(null)}
              >
                ✕
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

