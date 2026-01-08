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
 * Busca una prenda o caja por su tag NFC
 */
export async function findEntityByNFCTag(tagId: string): Promise<NFCTagInfo | null> {
  try {
    // Buscar en prendas
    const { data: garment, error: garmentError } = await supabase
      .from('garments')
      .select(`
        id,
        name,
        type,
        nfc_tag_id,
        boxes (
          id,
          name
        )
      `)
      .eq('nfc_tag_id', tagId)
      .single()

    if (garment && !garmentError) {
      return {
        tagId,
        entityType: 'garment',
        entityId: garment.id,
        entityName: garment.name,
        entity: garment as Garment
      }
    }

    // Buscar en cajas
    const { data: box, error: boxError } = await supabase
      .from('boxes')
      .select('id, name, nfc_tag_id')
      .eq('nfc_tag_id', tagId)
      .single()

    if (box && !boxError) {
      return {
        tagId,
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
        tag_id: tagId,
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

    const { error: updateError } = await supabase
      .from(table)
      .update({
        nfc_tag_id: newTagId,
        updated_at: new Date().toISOString()
      })
      .eq('id', entityId)

    if (updateError) {
      console.error('Error updating entity NFC tag:', updateError)
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

    // Actualizar el tag a null
    const { error: updateError } = await supabase
      .from(table)
      .update({
        nfc_tag_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', entityId)

    if (updateError) {
      console.error('Error removing entity NFC tag:', updateError)
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
