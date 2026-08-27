import { supabase } from '@/lib/supabase'
import { Box } from '@/types'

/**
 * Capacidad usada cuando la caja no tiene `max_capacity` definido.
 * Coincide con el DEFAULT de la columna en Postgres (ADD_MAX_CAPACITY_TO_BOXES.sql).
 */
export const DEFAULT_BOX_CAPACITY = 15

/** Prenda con el conteo de ocupación ya calculado */
type BoxConCuenta = Pick<Box, 'max_capacity'> & { garment_count?: number }

/**
 * Error de capacidad con un mensaje listo para mostrar al usuario.
 */
export class BoxCapacityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BoxCapacityError'
  }
}

/**
 * Capacidad máxima real de una caja.
 *
 * Ojo: si la query de `boxes` no trae la columna `max_capacity`, aquí siempre
 * se devolvería el default y el límite editado por el admin se ignoraría.
 * Cualquier `select` sobre `boxes` que alimente esta función debe incluirla.
 */
export function getBoxMaxCapacity(box?: Pick<Box, 'max_capacity'> | null): number {
  return box?.max_capacity || DEFAULT_BOX_CAPACITY
}

/** Prendas que aún caben en la caja (nunca negativo) */
export function getBoxAvailableSpace(box?: BoxConCuenta | null): number {
  return Math.max(0, getBoxMaxCapacity(box) - (box?.garment_count || 0))
}

/** `true` si la caja alcanzó (o superó) su capacidad máxima */
export function isBoxFull(box?: BoxConCuenta | null): boolean {
  return (box?.garment_count || 0) >= getBoxMaxCapacity(box)
}

/**
 * Cuenta las prendas que ocupan sitio en una caja.
 *
 * Solo cuentan las `available`: al retirar una prenda se le quita la caja, así
 * que una prenda en uso no ocupa hueco en ninguna parte.
 */
export async function countBoxOccupancy(boxId: string): Promise<number> {
  const { count, error } = await supabase
    .from('garments')
    .select('*', { count: 'exact', head: true })
    .eq('box_id', boxId)
    .eq('status', 'available')

  if (error) {
    console.error('Error contando prendas de la caja:', { boxId, error })
    throw new BoxCapacityError('No se pudo comprobar cuántas prendas hay en la caja.')
  }

  return count || 0
}

/**
 * Cuenta la ocupación de varias cajas en paralelo.
 *
 * Es mucho más barato que traer todos los `box_id` de `garments`: son queries
 * `count(*)` con `head: true`, sin cuerpo de respuesta.
 */
export async function countBoxesOccupancy(boxIds: string[]): Promise<Map<string, number>> {
  const cuentas = new Map<string, number>()

  if (boxIds.length === 0) return cuentas

  const resultados = await Promise.all(
    boxIds.map(boxId =>
      supabase
        .from('garments')
        .select('*', { count: 'exact', head: true })
        .eq('box_id', boxId)
        .eq('status', 'available')
    )
  )

  boxIds.forEach((boxId, i) => {
    cuentas.set(boxId, resultados[i].count || 0)
  })

  return cuentas
}

/**
 * Añade `garment_count` a una lista de cajas recién leída de la base.
 */
export async function withOccupancy<T extends { id: string }>(
  boxes: T[]
): Promise<(T & { garment_count: number })[]> {
  const cuentas = await countBoxesOccupancy(boxes.map(box => box.id))
  return boxes.map(box => ({ ...box, garment_count: cuentas.get(box.id) || 0 }))
}

/**
 * Devuelve la caja con más sitio libre donde quepan `necesarias` prendas.
 *
 * Ordena por espacio disponible (no por número de prendas): una caja de 30 con
 * 12 dentro tiene más sitio que una de 15 con 10, aunque parezca "más llena".
 */
export function findMostEmptyBox<T extends BoxConCuenta>(
  boxes: T[] | null | undefined,
  necesarias = 1
): T | null {
  if (!boxes || boxes.length === 0) return null

  const disponibles = boxes
    .filter(box => getBoxAvailableSpace(box) >= necesarias)
    .sort((a, b) => getBoxAvailableSpace(b) - getBoxAvailableSpace(a))

  return disponibles.length > 0 ? disponibles[0] : null
}

/**
 * Comprueba que en la caja quepan `necesarias` prendas y, si no, lanza un error
 * con la alternativa recomendada dentro del mensaje.
 *
 * @throws {BoxCapacityError}
 */
export function assertBoxHasSpace(
  box: (BoxConCuenta & { name?: string }) | null | undefined,
  necesarias: number,
  todasLasCajas?: (BoxConCuenta & { name?: string })[]
): void {
  if (!box) return

  const espacio = getBoxAvailableSpace(box)
  if (espacio >= necesarias) return

  const nombre = box.name ? `"${box.name}"` : 'Esta caja'
  const ocupadas = box.garment_count || 0
  const maxima = getBoxMaxCapacity(box)

  const detalle =
    necesarias === 1
      ? `La caja ${nombre} está llena (${ocupadas}/${maxima} prendas).`
      : `En la caja ${nombre} no caben ${necesarias} prendas: quedan ${espacio} espacios de ${maxima}.`

  const alternativa = todasLasCajas
    ? findMostEmptyBox(
        todasLasCajas.filter(otra => otra !== box),
        necesarias
      )
    : null

  if (alternativa?.name) {
    throw new BoxCapacityError(
      `${detalle} Te recomendamos usar la caja "${alternativa.name}", con ${getBoxAvailableSpace(alternativa)} espacios libres.`
    )
  }

  throw new BoxCapacityError(`${detalle} No hay otras cajas con espacio suficiente.`)
}
