'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { useAuth } from '@/hooks/useAuth'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DemoBanner } from '@/components/ui/demo-banner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Search,
  Shirt,
  Package,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Pencil,
  LogOut,
  RotateCcw
} from 'lucide-react'
import type { Box, Garment } from '@/types'
import { toast } from '@/hooks/use-toast'
import { retirarPrendas, asignarPrendasACaja, quitarPrendasDeCaja } from '@/lib/garments-repo'
import { getBoxMaxCapacity, withOccupancy, isBoxFull } from '@/utils/box-capacity'

const EditGarmentModal = dynamic(
  () => import('@/components/garments/edit-garment-modal').then(mod => ({ default: mod.EditGarmentModal })),
  { ssr: false }
)

/** Prendas por página */
const POR_PAGINA = 24

/** Valor del filtro de caja para "las que no están en ninguna" */
const SIN_CAJA = 'sin-caja'

type EstadoFiltro = 'todas' | 'available' | 'in_use'

interface GarmentDelInventario extends Garment {
  users?: { id: string; email: string; full_name: string | null } | null
  boxes?: { id: string; name: string; location: string | null } | null
}

interface Resumen {
  total: number
  disponibles: number
  enUso: number
  sinCaja: number
}

/**
 * Un término de búsqueda se mete dentro de la sintaxis de `.or()` de PostgREST,
 * donde la coma separa condiciones y los paréntesis las agrupan. Sin limpiarlo,
 * buscar "camisa, azul" produce una query inválida (error 400).
 */
function limpiarTermino(termino: string): string {
  return termino
    .trim()
    .replace(/[,()%*\\"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export default function AdminGarmentsPage() {
  const { userProfile } = useAuth()

  const [garments, setGarments] = useState<GarmentDelInventario[]>([])
  const [boxes, setBoxes] = useState<Box[]>([])
  const [resumen, setResumen] = useState<Resumen>({ total: 0, disponibles: 0, enUso: 0, sinCaja: 0 })
  const [totalFiltrado, setTotalFiltrado] = useState(0)

  const [busqueda, setBusqueda] = useState('')
  const [busquedaAplicada, setBusquedaAplicada] = useState('')
  const [estado, setEstado] = useState<EstadoFiltro>('todas')
  const [cajaId, setCajaId] = useState<string>('todas')
  const [tipo, setTipo] = useState<string>('todos')
  const [pagina, setPagina] = useState(0)

  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [accionEnCurso, setAccionEnCurso] = useState<string | null>(null)
  const [garmentAEditar, setGarmentAEditar] = useState<Garment | null>(null)

  // La búsqueda va al servidor, no filtra lo ya cargado: se espera a que el
  // usuario deje de teclear para no lanzar una query por pulsación
  useEffect(() => {
    const temporizador = setTimeout(() => {
      setBusquedaAplicada(busqueda)
      setPagina(0)
    }, 350)

    return () => clearTimeout(temporizador)
  }, [busqueda])

  const cargarCajas = useCallback(async () => {
    if (!isSupabaseConfigured) return

    const { data, error: errorCajas } = await supabase
      .from('boxes')
      .select('id, name, location, max_capacity')
      .order('name')

    if (errorCajas) {
      console.error('Error cargando cajas:', errorCajas)
      return
    }

    setBoxes(await withOccupancy<Box>(data || []))
  }, [])

  const cargarResumen = useCallback(async () => {
    if (!isSupabaseConfigured) return

    // Cuatro `count(*)` en paralelo: sin cuerpo de respuesta, solo el número
    const soloElConteo = () => supabase.from('garments').select('*', { count: 'exact', head: true })

    const [total, disponibles, enUso, sinCaja] = await Promise.all([
      soloElConteo(),
      soloElConteo().eq('status', 'available'),
      soloElConteo().eq('status', 'in_use'),
      soloElConteo().is('box_id', null).eq('status', 'available')
    ])

    setResumen({
      total: total.count || 0,
      disponibles: disponibles.count || 0,
      enUso: enUso.count || 0,
      sinCaja: sinCaja.count || 0
    })
  }, [])

  const cargarPrendas = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setGarments([])
      setCargando(false)
      return
    }

    setCargando(true)
    setError('')

    try {
      let query = supabase
        .from('garments')
        .select(
          `
          id, name, type, color, season, style, image_url, box_id, nfc_tag_id,
          barcode_id, status, usage_count, last_used, created_at, user_id,
          users:user_id ( id, email, full_name ),
          boxes:box_id ( id, name, location )
        `,
          { count: 'exact' }
        )
        .order('created_at', { ascending: false })
        .range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1)

      const termino = limpiarTermino(busquedaAplicada)
      if (termino) {
        // Texto por aproximación; los códigos, exactos y en mayúsculas
        const enMayusculas = termino.toUpperCase()
        // Los valores van entrecomillados para que un término con espacios
        // ("camisa azul") no rompa la sintaxis del filtro
        query = query.or(
          [
            `name.ilike."%${termino}%"`,
            `type.ilike."%${termino}%"`,
            `color.ilike."%${termino}%"`,
            `nfc_tag_id.eq."${enMayusculas}"`,
            `barcode_id.eq."${termino}"`
          ].join(',')
        )
      }

      if (estado !== 'todas') query = query.eq('status', estado)
      if (tipo !== 'todos') query = query.eq('type', tipo)
      if (cajaId === SIN_CAJA) query = query.is('box_id', null)
      else if (cajaId !== 'todas') query = query.eq('box_id', cajaId)

      const { data, error: errorPrendas, count } = await query

      if (errorPrendas) throw errorPrendas

      setGarments((data || []) as GarmentDelInventario[])
      setTotalFiltrado(count || 0)
    } catch (errorPrendas) {
      console.error('Error cargando el inventario:', errorPrendas)
      setError(
        errorPrendas instanceof Error
          ? `No se pudo cargar el inventario: ${errorPrendas.message}`
          : 'No se pudo cargar el inventario.'
      )
      setGarments([])
      setTotalFiltrado(0)
    } finally {
      setCargando(false)
    }
  }, [busquedaAplicada, estado, tipo, cajaId, pagina])

  useEffect(() => {
    cargarCajas()
  }, [cargarCajas])

  useEffect(() => {
    cargarPrendas()
  }, [cargarPrendas])

  useEffect(() => {
    cargarResumen()
  }, [cargarResumen])

  const recargar = useCallback(async () => {
    await Promise.all([cargarPrendas(), cargarResumen(), cargarCajas()])
  }, [cargarPrendas, cargarResumen, cargarCajas])

  const tiposDisponibles = useMemo(() => {
    const tipos = new Set(garments.map(garment => garment.type).filter(Boolean))
    return Array.from(tipos).sort()
  }, [garments])

  const ultimaPagina = Math.max(0, Math.ceil(totalFiltrado / POR_PAGINA) - 1)
  const hayFiltros = busquedaAplicada !== '' || estado !== 'todas' || cajaId !== 'todas' || tipo !== 'todos'

  const limpiarFiltros = () => {
    setBusqueda('')
    setEstado('todas')
    setCajaId('todas')
    setTipo('todos')
    setPagina(0)
  }

  const conAccion = async (garmentId: string, accion: () => Promise<void>) => {
    setAccionEnCurso(garmentId)
    setError('')
    try {
      await accion()
      await recargar()
    } catch (errorAccion) {
      const mensaje =
        errorAccion instanceof Error ? errorAccion.message : 'No se pudo completar la acción.'
      setError(mensaje)
      toast.error(mensaje)
    } finally {
      setAccionEnCurso(null)
    }
  }

  const retirar = (garment: GarmentDelInventario) =>
    conAccion(garment.id, async () => {
      if (!userProfile) throw new Error('Debes iniciar sesión.')
      await retirarPrendas([garment.id], {
        actorId: userProfile.id,
        esAdmin: userProfile.role === 'admin'
      })
      toast.success(`"${garment.name}" está ahora en uso.`, 'Prenda retirada')
    })

  const restaurar = (garment: GarmentDelInventario) =>
    conAccion(garment.id, async () => {
      await quitarPrendasDeCaja([garment.id])
      toast.success(`"${garment.name}" vuelve a estar disponible, sin caja.`, 'Prenda restaurada')
    })

  const moverACaja = (garment: GarmentDelInventario, destino: string) =>
    conAccion(garment.id, async () => {
      if (destino === SIN_CAJA) {
        await quitarPrendasDeCaja([garment.id])
        toast.success(`"${garment.name}" ya no está en ninguna caja.`)
        return
      }

      await asignarPrendasACaja([garment.id], destino)
      const caja = boxes.find(box => box.id === destino)
      toast.success(`"${garment.name}" está en "${caja?.name || 'la caja'}".`, 'Prenda movida')
    })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold">📋 Inventario</h2>
        <p className="text-sm sm:text-base text-muted-foreground">
          Todas las prendas del sistema, estén donde estén
        </p>
      </div>

      {!isSupabaseConfigured && <DemoBanner />}

      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { etiqueta: 'Prendas', valor: resumen.total, icono: Shirt },
          { etiqueta: 'Disponibles', valor: resumen.disponibles, icono: Package },
          { etiqueta: 'En uso', valor: resumen.enUso, icono: LogOut },
          { etiqueta: 'Sin caja', valor: resumen.sinCaja, icono: AlertCircle }
        ].map(({ etiqueta, valor, icono: Icono }) => (
          <Card key={etiqueta}>
            <CardContent className="p-4 flex items-center gap-3">
              <Icono className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-2xl font-bold tabular-nums leading-none">{valor}</p>
                <p className="text-xs text-muted-foreground mt-1 truncate">{etiqueta}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Buscador y filtros */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={busqueda}
              onChange={event => setBusqueda(event.target.value)}
              placeholder="Buscar por nombre, tipo, color, código NFC o de barras"
              className="pl-9"
              aria-label="Buscar prendas en todo el sistema"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              value={estado}
              onValueChange={valor => {
                setEstado(valor as EstadoFiltro)
                setPagina(0)
              }}
            >
              <SelectTrigger aria-label="Filtrar por estado">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todos los estados</SelectItem>
                <SelectItem value="available">Disponibles</SelectItem>
                <SelectItem value="in_use">En uso</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={cajaId}
              onValueChange={valor => {
                setCajaId(valor)
                setPagina(0)
              }}
            >
              <SelectTrigger aria-label="Filtrar por caja">
                <SelectValue placeholder="Caja" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las cajas</SelectItem>
                <SelectItem value={SIN_CAJA}>Sin caja</SelectItem>
                {boxes.map(box => (
                  <SelectItem key={box.id} value={box.id}>
                    {box.name} ({box.garment_count || 0}/{getBoxMaxCapacity(box)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={tipo}
              onValueChange={valor => {
                setTipo(valor)
                setPagina(0)
              }}
            >
              <SelectTrigger aria-label="Filtrar por tipo de prenda">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los tipos</SelectItem>
                {tiposDisponibles.map(tipoPrenda => (
                  <SelectItem key={tipoPrenda} value={tipoPrenda}>
                    {tipoPrenda}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
              {cargando ? (
                'Buscando…'
              ) : (
                <>
                  <span className="font-medium text-foreground tabular-nums">{totalFiltrado}</span>{' '}
                  {totalFiltrado === 1 ? 'prenda encontrada' : 'prendas encontradas'}
                  {totalFiltrado > POR_PAGINA && (
                    <>
                      {' '}· página {pagina + 1} de {ultimaPagina + 1}
                    </>
                  )}
                </>
              )}
            </span>
            {hayFiltros && (
              <Button variant="ghost" size="sm" onClick={limpiarFiltros}>
                Quitar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Listado */}
      {cargando ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" aria-hidden="true" />
          Cargando inventario…
        </div>
      ) : garments.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Shirt className="h-10 w-10 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
            <p className="font-medium">
              {hayFiltros ? 'Ninguna prenda coincide con la búsqueda' : 'Todavía no hay prendas'}
            </p>
            {hayFiltros && (
              <Button variant="outline" size="sm" className="mt-4" onClick={limpiarFiltros}>
                Quitar filtros
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {garments.map(garment => {
            const ocupada = accionEnCurso === garment.id
            const enUso = garment.status === 'in_use'
            const dueño = garment.users?.full_name || garment.users?.email

            return (
              <Card key={garment.id} className={ocupada ? 'opacity-60' : undefined}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                      {garment.image_url ? (
                        <Image
                          src={garment.image_url}
                          alt={garment.name}
                          width={80}
                          height={80}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Shirt className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold truncate">{garment.name}</h3>
                          <p className="text-sm text-muted-foreground truncate">
                            {garment.type}
                            {garment.color ? ` · ${garment.color}` : ''}
                          </p>
                        </div>
                        <Badge variant={enUso ? 'secondary' : 'outline'} className="shrink-0">
                          {enUso ? 'En uso' : 'Disponible'}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Package className="h-3 w-3" aria-hidden="true" />
                          {garment.boxes?.name || 'Sin caja'}
                          {garment.boxes?.location ? ` · ${garment.boxes.location}` : ''}
                        </span>
                        {dueño && <span className="truncate">👤 {dueño}</span>}
                        {garment.nfc_tag_id && <span>NFC {garment.nfc_tag_id}</span>}
                        {garment.barcode_id && <span>Código {garment.barcode_id}</span>}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Select
                          value={garment.box_id || SIN_CAJA}
                          onValueChange={destino => moverACaja(garment, destino)}
                          disabled={ocupada}
                        >
                          <SelectTrigger
                            className="h-9 w-[190px] text-xs"
                            aria-label={`Cambiar la caja de ${garment.name}`}
                          >
                            <SelectValue placeholder="Mover a…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SIN_CAJA}>Sin caja</SelectItem>
                            {boxes.map(box => {
                              const llena = isBoxFull(box) && box.id !== garment.box_id
                              return (
                                <SelectItem key={box.id} value={box.id} disabled={llena}>
                                  {box.name} ({box.garment_count || 0}/{getBoxMaxCapacity(box)})
                                  {llena ? ' · llena' : ''}
                                </SelectItem>
                              )
                            })}
                          </SelectContent>
                        </Select>

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9"
                          onClick={() => setGarmentAEditar(garment)}
                          disabled={ocupada}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                          Editar
                        </Button>

                        {enUso ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9"
                            onClick={() => restaurar(garment)}
                            disabled={ocupada}
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                            Restaurar
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9"
                            onClick={() => retirar(garment)}
                            disabled={ocupada}
                          >
                            <LogOut className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                            Retirar
                          </Button>
                        )}

                        {ocupada && (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Paginación */}
      {!cargando && totalFiltrado > POR_PAGINA && (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => setPagina(actual => Math.max(0, actual - 1))}
            disabled={pagina === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" aria-hidden="true" />
            Anteriores
          </Button>

          <span className="text-sm text-muted-foreground tabular-nums">
            {pagina * POR_PAGINA + 1}–{Math.min((pagina + 1) * POR_PAGINA, totalFiltrado)} de{' '}
            {totalFiltrado}
          </span>

          <Button
            variant="outline"
            onClick={() => setPagina(actual => Math.min(ultimaPagina, actual + 1))}
            disabled={pagina >= ultimaPagina}
          >
            Siguientes
            <ChevronRight className="h-4 w-4 ml-1" aria-hidden="true" />
          </Button>
        </div>
      )}

      {garmentAEditar && (
        <EditGarmentModal
          open={garmentAEditar !== null}
          onOpenChange={abierto => !abierto && setGarmentAEditar(null)}
          garment={garmentAEditar}
          boxes={boxes}
          onSuccess={() => {
            setGarmentAEditar(null)
            recargar()
          }}
        />
      )}
    </div>
  )
}
