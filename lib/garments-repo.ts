import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import { countBoxOccupancy, assertBoxHasSpace, BoxCapacityError } from '@/utils/box-capacity'

type GarmentPatch = Database['public']['Tables']['garments']['Update']

/**
 * Error de escritura sobre `garments` con un mensaje listo para mostrar al usuario.
 */
export class GarmentUpdateError extends Error {
  readonly detalle?: unknown

  constructor(message: string, detalle?: unknown) {
    super(message)
    this.name = 'GarmentUpdateError'
    this.detalle = detalle
  }
}

/**
 * Traduce el rechazo del trigger `enforce_box_capacity` (LIMITE_CAPACIDAD_CAJAS.sql)
 * a un `BoxCapacityError`, para que la UI lo muestre como un problema de
 * capacidad y no como un error genérico de guardado.
 */
function comoErrorDeCapacidad(error: { code?: string; message?: string }): BoxCapacityError | null {
  const esViolacionDeCheck = error.code === '23514' || error.code === 'P0001'
  if (esViolacionDeCheck && error.message?.includes('está llena')) {
    return new BoxCapacityError(error.message)
  }
  return null
}

/**
 * Actualiza prendas y **verifica cuántas filas se modificaron de verdad**.
 *
 * Sin `.select()`, PostgREST responde 200 con cero filas cuando RLS deja pasar
 * la petición pero ninguna fila supera la política: `error` llega en null y la
 * UI canta un éxito que nunca ocurrió. Pidiendo los ids de vuelta podemos
 * comparar con los que enviamos y fallar de forma visible.
 *
 * @returns los ids realmente actualizados
 * @throws {GarmentUpdateError} si la petición falla o si no se actualizaron todas
 */
export async function updateGarments(
  ids: string[],
  patch: GarmentPatch
): Promise<string[]> {
  const idsUnicos = Array.from(new Set(ids.filter(Boolean)))

  if (idsUnicos.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from('garments')
    .update({ updated_at: new Date().toISOString(), ...patch })
    .in('id', idsUnicos)
    .select('id')

  if (error) {
    console.error('❌ Error al actualizar prendas:', { ids: idsUnicos, patch, error })

    const errorDeCapacidad = comoErrorDeCapacidad(error)
    if (errorDeCapacidad) throw errorDeCapacidad

    throw new GarmentUpdateError(
      `No se pudo guardar el cambio: ${error.message || 'error desconocido'}`,
      error
    )
  }

  const actualizados = (data || []).map((fila: { id: string }) => fila.id)

  if (actualizados.length === 0) {
    console.error('❌ La actualización no afectó a ninguna prenda:', { ids: idsUnicos, patch })
    throw new GarmentUpdateError(
      idsUnicos.length === 1
        ? 'El cambio no se guardó. La prenda ya no existe o tu usuario no tiene permiso para modificarla.'
        : 'El cambio no se guardó en ninguna prenda. Puede que ya no existan o que tu usuario no tenga permiso para modificarlas.'
    )
  }

  if (actualizados.length < idsUnicos.length) {
    const noActualizados = idsUnicos.filter(id => !actualizados.includes(id))
    console.error('❌ Actualización parcial de prendas:', { noActualizados, patch })
    throw new GarmentUpdateError(
      `Solo se guardaron ${actualizados.length} de ${idsUnicos.length} prendas. ` +
        'Las demás ya no existen o tu usuario no tiene permiso para modificarlas.'
    )
  }

  return actualizados
}

/**
 * Igual que `updateGarments`, para una sola prenda.
 *
 * @throws {GarmentUpdateError} si la prenda no se actualizó
 */
export async function updateGarment(id: string, patch: GarmentPatch): Promise<void> {
  await updateGarments([id], patch)
}

/**
 * Elimina una prenda y **verifica que se haya borrado de verdad**.
 *
 * Mismo motivo que en `updateGarments`: un DELETE que RLS rechaza responde 200
 * sin error y sin filas, y la UI daría la prenda por eliminada.
 *
 * @throws {GarmentUpdateError} si no se eliminó ninguna fila
 */
export async function deleteGarment(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('garments')
    .delete()
    .eq('id', id)
    .select('id')

  if (error) {
    console.error('❌ Error al eliminar la prenda:', { id, error })
    throw new GarmentUpdateError(
      `No se pudo eliminar la prenda: ${error.message || 'error desconocido'}`,
      error
    )
  }

  if (!data || data.length === 0) {
    console.error('❌ La eliminación no afectó a ninguna prenda:', { id })
    throw new GarmentUpdateError(
      'La prenda no se eliminó. Ya no existe o tu usuario no tiene permiso para eliminarla.'
    )
  }
}

// ---------------------------------------------------------------------------
// Verbos del dominio
//
// Retirar, ingresar y quitar de la caja son las tres cosas que la app hace con
// una prenda, y antes cada pantalla las implementaba a su manera: el retiro en
// lote no soltaba la caja, mover no normalizaba el estado, el historial se
// insertaba en unos flujos y en otros no. Aquí viven las reglas completas; las
// pantallas solo deciden qué mostrar.
// ---------------------------------------------------------------------------

export interface RetirarOptions {
  /** Usuario que ejecuta la acción */
  actorId: string
  /** Un admin puede retirar prendas de cualquier usuario */
  esAdmin: boolean
  /** Cómo se decidió usar la prenda (para `usage_history`) */
  tipoDeUso?: 'manual' | 'outfit' | 'recommendation'
}

/**
 * Retira prendas: las marca en uso, suma un uso y **las saca de su caja**.
 *
 * Una prenda retirada no ocupa sitio en ninguna caja: se la lleva puesta
 * alguien. Al ingresarla se le asigna caja de nuevo.
 *
 * Registra el uso en `usage_history` a nombre del dueño de la prenda, no del
 * admin que la retira.
 *
 * @throws {GarmentUpdateError} si falta permiso o si algún cambio no se guarda
 */
export async function retirarPrendas(
  ids: string[],
  { actorId, esAdmin, tipoDeUso = 'manual' }: RetirarOptions
): Promise<void> {
  const idsUnicos = Array.from(new Set(ids.filter(Boolean)))
  if (idsUnicos.length === 0) return

  const { data: prendas, error } = await supabase
    .from('garments')
    .select('id, name, user_id, usage_count')
    .in('id', idsUnicos)

  if (error) {
    console.error('❌ Error al leer las prendas a retirar:', { ids: idsUnicos, error })
    throw new GarmentUpdateError(`No se pudieron leer las prendas: ${error.message}`, error)
  }

  if (!prendas || prendas.length === 0) {
    throw new GarmentUpdateError('No se encontraron las prendas que quieres retirar.')
  }

  const ajena = prendas.find(
    (prenda: { user_id: string }) => !esAdmin && prenda.user_id !== actorId
  )
  if (ajena) {
    throw new GarmentUpdateError('No tienes permiso para retirar esta prenda.')
  }

  const ahora = new Date().toISOString()

  await Promise.all(
    prendas.map((prenda: { id: string; usage_count: number | null }) =>
      updateGarment(prenda.id, {
        status: 'in_use',
        last_used: ahora,
        usage_count: (prenda.usage_count || 0) + 1,
        box_id: null // al retirar, la prenda deja de ocupar sitio en la caja
      })
    )
  )

  // El historial se guarda a nombre del dueño de la prenda
  const { error: errorHistorial } = await supabase.from('usage_history').insert(
    prendas.map((prenda: { id: string; user_id: string }) => ({
      user_id: prenda.user_id,
      garment_id: prenda.id,
      usage_type: tipoDeUso,
      created_at: ahora
    }))
  )

  if (errorHistorial) {
    // La prenda ya está retirada: no es motivo para fallar, pero sí para enterarse
    console.error('⚠️ La prenda se retiró pero no se registró en el historial:', errorHistorial)
  }
}

/**
 * Mete prendas en una caja: asigna `box_id` y las deja disponibles.
 *
 * Es a la vez "ingresar" (una prenda que estaba en uso vuelve al armario) y
 * "mover" (cambiarla de caja), porque el resultado es el mismo.
 *
 * Comprueba la capacidad con un conteo recién leído, no con el estado de la
 * pantalla, que puede llevar minutos sin refrescar.
 *
 * @throws {BoxCapacityError} si no caben
 * @throws {GarmentUpdateError} si algún cambio no se guarda
 */
export async function asignarPrendasACaja(ids: string[], boxId: string): Promise<void> {
  const idsUnicos = Array.from(new Set(ids.filter(Boolean)))
  if (idsUnicos.length === 0) return

  const { data: caja, error } = await supabase
    .from('boxes')
    .select('id, name, max_capacity')
    .eq('id', boxId)
    .single()

  if (error || !caja) {
    console.error('❌ Error al leer la caja destino:', { boxId, error })
    throw new GarmentUpdateError('No se encontró la caja de destino.')
  }

  // Las prendas que ya están en esta caja no ocupan un hueco nuevo
  const ocupacion = await countBoxOccupancy(boxId)
  const { data: yaDentro } = await supabase
    .from('garments')
    .select('id')
    .eq('box_id', boxId)
    .in('id', idsUnicos)

  const nuevas = idsUnicos.length - (yaDentro?.length || 0)
  assertBoxHasSpace({ ...caja, garment_count: ocupacion }, nuevas)

  await updateGarments(idsUnicos, { box_id: boxId, status: 'available' })
}

/**
 * Saca prendas de su caja y las deja disponibles.
 *
 * Sirve para las dos formas de hacerlo: quitar de la caja una prenda que está
 * en el armario, y restaurar una que estaba en uso.
 *
 * @throws {GarmentUpdateError} si algún cambio no se guarda
 */
export async function quitarPrendasDeCaja(ids: string[]): Promise<void> {
  await updateGarments(ids, { box_id: null, status: 'available' })
}
