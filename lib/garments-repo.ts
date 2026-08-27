import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

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
