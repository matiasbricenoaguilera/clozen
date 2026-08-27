import { supabase } from '@/lib/supabase'
import type { Garment, Box } from '@/types'

export interface NFCTagInfo {
  tagId: string
  entityType: 'garment' | 'box'
  entityId: string
  entityName: string
  entity?: Garment | Box
}

/**
 * Normaliza un código NFC igual que el alta de prendas: sin espacios y en
 * mayúsculas.
 */
export function normalizeNFCTag(tagId: string): string {
  return tagId.trim().toUpperCase()
}

/**
 * Variantes con las que buscar un tag, de la más literal a la normalizada.
 *
 * Los códigos se guardan normalizados, pero un lector puede entregarlos con
 * espacios o en minúsculas, y quedan registros antiguos escritos sin
 * normalizar. Probando ambas formas se encuentra el tag en los dos casos.
 */
function variantesDeTag(tagId: string): string[] {
  const variantes = [tagId, tagId.trim(), normalizeNFCTag(tagId)]
  return Array.from(new Set(variantes.filter(variante => variante.length > 0)))
}

/**
 * Busca una prenda o caja por su tag NFC
 */
export async function findEntityByNFCTag(tagId: string): Promise<NFCTagInfo | null> {
  try {
    const candidatos = variantesDeTag(tagId)
    if (candidatos.length === 0) return null

    // Buscar en prendas
    const { data: garments, error: garmentError } = await supabase
      .from('garments')
      .select(`
        id,
        name,
        type,
        nfc_tag_id,
        user_id,
        boxes (
          id,
          name
        )
      `)
      .in('nfc_tag_id', candidatos)
      .limit(1)

    const garment = garments?.[0]

    if (garment && !garmentError) {
      return {
        tagId: garment.nfc_tag_id || tagId,
        entityType: 'garment',
        entityId: garment.id,
        entityName: garment.name,
        entity: garment as Garment
      }
    }

    // Buscar en cajas
    const { data: boxes, error: boxError } = await supabase
      .from('boxes')
      .select('id, name, nfc_tag_id')
      .in('nfc_tag_id', candidatos)
      .limit(1)

    const box = boxes?.[0]

    if (box && !boxError) {
      return {
        tagId: box.nfc_tag_id || tagId,
        entityType: 'box',
        entityId: box.id,
        entityName: box.name,
        entity: box as Box
      }
    }

    return null
  } catch (error) {
    console.error('Error finding entity by NFC tag:', error)
    return null
  }
}

/**
 * Verifica si un tag NFC ya está registrado
 */
export async function isNFCTagRegistered(tagId: string): Promise<boolean> {
  try {
    const result = await findEntityByNFCTag(tagId)
    return result !== null
  } catch (error) {
    console.error('Error checking NFC tag registration:', error)
    return false
  }
}

/**
 * Registra un tag NFC en la tabla nfc_tags
 */
export async function registerNFCTag(
  tagId: string,
  entityType: 'garment' | 'box',
  entityId: string,
  createdBy: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('nfc_tags')
      .insert({
        tag_id: normalizeNFCTag(tagId),
        entity_type: entityType,
        entity_id: entityId,
        created_by: createdBy
      })

    if (error) {
      console.error('Error registering NFC tag:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error registering NFC tag:', error)
    return false
  }
}

/**
 * Actualiza el tag NFC de una prenda o caja
 */
export async function updateEntityNFCTag(
  entityType: 'garment' | 'box',
  entityId: string,
  newTagId: string | null,
  updatedBy: string
): Promise<boolean> {
  try {
    const table = entityType === 'garment' ? 'garments' : 'boxes'

    // `.select()` para saber si la fila se actualizó de verdad: sin él, RLS puede
    // rechazar la escritura y PostgREST responde 200 sin error y con cero filas
    const { data: updated, error: updateError } = await supabase
      .from(table)
      .update({
        nfc_tag_id: newTagId ? normalizeNFCTag(newTagId) : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', entityId)
      .select('id')

    if (updateError) {
      console.error('Error updating entity NFC tag:', updateError)
      return false
    }

    if (!updated || updated.length === 0) {
      console.error('El tag NFC no se guardó: la entidad no existe o no tienes permiso', { table, entityId })
      return false
    }

    // Si hay un nuevo tag, registrarlo
    if (newTagId) {
      const registered = await registerNFCTag(newTagId, entityType, entityId, updatedBy)
      if (!registered) {
        console.warn('Failed to register new NFC tag, but entity was updated')
      }
    }

    return true
  } catch (error) {
    console.error('Error updating entity NFC tag:', error)
    return false
  }
}

/**
 * Remueve el tag NFC de una prenda o caja
 */
export async function removeEntityNFCTag(
  entityType: 'garment' | 'box',
  entityId: string
): Promise<boolean> {
  try {
    const table = entityType === 'garment' ? 'garments' : 'boxes'

    // Primero obtener el tag actual
    const { data: entity, error: fetchError } = await supabase
      .from(table)
      .select('nfc_tag_id')
      .eq('id', entityId)
      .single()

    if (fetchError || !entity) {
      console.error('Error fetching entity:', fetchError)
      return false
    }

    // Actualizar el tag a null (con `.select()` para confirmar que se aplicó)
    const { data: updated, error: updateError } = await supabase
      .from(table)
      .update({
        nfc_tag_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', entityId)
      .select('id')

    if (updateError) {
      console.error('Error removing entity NFC tag:', updateError)
      return false
    }

    if (!updated || updated.length === 0) {
      console.error('El tag NFC no se liberó: la entidad no existe o no tienes permiso', { table, entityId })
      return false
    }

    // Eliminar el registro de nfc_tags si existe
    if (entity.nfc_tag_id) {
      const { error: deleteError } = await supabase
        .from('nfc_tags')
        .delete()
        .eq('tag_id', entity.nfc_tag_id)

      if (deleteError) {
        console.warn('Failed to delete NFC tag record:', deleteError)
        // No fallar la operación por esto
      }
    }

    return true
  } catch (error) {
    console.error('Error removing entity NFC tag:', error)
    return false
  }
}
