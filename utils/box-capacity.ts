import { Box } from '@/types'

/**
 * Capacidad usada cuando la caja no tiene `max_capacity` definido.
 * Coincide con el DEFAULT de la columna en Postgres (ADD_MAX_CAPACITY_TO_BOXES.sql).
 */
export const DEFAULT_BOX_CAPACITY = 15

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
export function getBoxAvailableSpace(box?: (Pick<Box, 'max_capacity'> & { garment_count?: number }) | null): number {
  return Math.max(0, getBoxMaxCapacity(box) - (box?.garment_count || 0))
}

/** `true` si la caja alcanzó (o superó) su capacidad máxima */
export function isBoxFull(box?: (Pick<Box, 'max_capacity'> & { garment_count?: number }) | null): boolean {
  return (box?.garment_count || 0) >= getBoxMaxCapacity(box)
}
