'use client'

import { useState, useCallback } from 'react'
import { NFCReadResult, NFCWriteResult } from '@/types'
import { supabase } from '@/lib/supabase'

export function useNFC() {
  const [isSupported, setIsSupported] = useState(false)
  const [isReading, setIsReading] = useState(false)
  const [isWriting, setIsWriting] = useState(false)

  // Verificar si Web NFC está soportado
  const checkNFCSupport = useCallback(() => {
    if ('NDEFReader' in window) {
      setIsSupported(true)
      return true
    }
    setIsSupported(false)
    return false
  }, [])

  // Generar ID tipo MAC desde serial number
  const generateMacLikeId = useCallback((serialNumber: string) => {
    // Convertir el serial number a formato MAC-like (XX:XX:XX:XX:XX:XX)
    const bytes = new Uint8Array(serialNumber.length)
    for (let i = 0; i < serialNumber.length; i++) {
      bytes[i] = serialNumber.charCodeAt(i)
    }

    // Tomar primeros 6 bytes o completar con timestamp si es necesario
    let macBytes: number[]
    if (bytes.length >= 6) {
      macBytes = Array.from(bytes.slice(0, 6))
    } else {
      const timestampBytes = []
      const timestamp = Date.now()
      for (let i = 0; i < 6 - bytes.length; i++) {
        timestampBytes.push((timestamp >> (i * 8)) & 0xFF)
      }
      macBytes = [...Array.from(bytes), ...timestampBytes]
    }

    return macBytes.map(b => b.toString(16).padStart(2, '0')).join(':').toUpperCase()
  }, [])

  // Verificar si un tag ya está asociado a una prenda
  const checkTagExists = useCallback(async (tagId: string): Promise<{exists: boolean, entity?: 'garment' | 'box', name?: string}> => {
    try {
      // Verificar en prendas
      const { data: garment, error: garmentError } = await supabase
        .from('garments')
        .select('name')
        .eq('nfc_tag_id', tagId)
        .single()

      if (garment && !garmentError) {
        return { exists: true, entity: 'garment', name: garment.name }
      }

      // Verificar en cajas
      const { data: box, error: boxError } = await supabase
        .from('boxes')
        .select('name')
        .eq('nfc_tag_id', tagId)
        .single()

      if (box && !boxError) {
        return { exists: true, entity: 'box', name: box.name }
      }

      return { exists: false }
    } catch (error) {
      console.error('Error checking tag existence:', error)
      return { exists: false }
    }
  }, [])

  // Leer tag NFC
  const readNFCTag = useCallback(async (): Promise<NFCReadResult> => {
    if (!checkNFCSupport()) {
      return {
        success: false,
        error: 'Web NFC no está soportado en este navegador'
      }
    }

    setIsReading(true)

    try {
      // @ts-ignore - Web NFC API types
      const ndef = new NDEFReader()

      await ndef.scan()

      return new Promise((resolve) => {
        ndef.onreading = async (event: any) => {
          try {
            // Leer el contenido del tag
            const decoder = new TextDecoder()
            let tagId = ''

            // Primero intentar leer contenido NDEF
            for (const record of event.message.records) {
              if (record.recordType === 'text') {
                tagId = decoder.decode(record.data)
                break
              }
            }

            // Si no hay contenido NDEF, usar el serial number como base
            if (!tagId && event.serialNumber) {
              tagId = generateMacLikeId(event.serialNumber)
            }

            // Si aún no hay ID, generar uno basado solo en serial
            if (!tagId && event.serialNumber) {
              tagId = event.serialNumber
            }

            if (!tagId) {
              resolve({
                success: false,
                error: 'No se pudo leer el ID del tag'
              })
              return
            }

            // Verificar si el tag ya está asociado
            const tagCheck = await checkTagExists(tagId)
            if (tagCheck.exists) {
              resolve({
                success: false,
                error: `Este tag NFC ya está asociado a ${tagCheck.entity === 'garment' ? 'la prenda' : 'la caja'} "${tagCheck.name}"`
              })
              return
            }

            resolve({
              success: true,
              tagId: tagId
            })
          } catch (error) {
            resolve({
              success: false,
              error: 'Error al procesar el tag NFC'
            })
          }
        }

        ndef.onreadingerror = () => {
          resolve({
            success: false,
            error: 'Error al leer el tag NFC'
          })
        }

        // Timeout después de 30 segundos
        setTimeout(() => {
          ndef.stop()
          resolve({
            success: false,
            error: 'Tiempo de espera agotado'
          })
        }, 30000)
      })
    } catch (error) {
      return {
        success: false,
        error: 'Error al iniciar la lectura NFC'
      }
    } finally {
      setIsReading(false)
    }
  }, [checkNFCSupport, generateMacLikeId, checkTagExists])

  // Generar nuevo ID único para tag NFC
  const generateNewTagId = useCallback(() => {
    // Generar ID tipo MAC basado en timestamp y random
    const timestamp = Date.now()
    const random = Math.floor(Math.random() * 0xFFFFFF)

    const macBytes = [
      (timestamp >> 40) & 0xFF,
      (timestamp >> 32) & 0xFF,
      (timestamp >> 24) & 0xFF,
      (timestamp >> 16) & 0xFF,
      (timestamp >> 8) & 0xFF,
      timestamp & 0xFF
    ]

    // Mezclar con random para mayor unicidad
    macBytes[3] = (macBytes[3] ^ (random >> 16)) & 0xFF
    macBytes[4] = (macBytes[4] ^ (random >> 8)) & 0xFF
    macBytes[5] = (macBytes[5] ^ random) & 0xFF

    return macBytes.map(b => b.toString(16).padStart(2, '0')).join(':').toUpperCase()
  }, [])

  // Escribir tag NFC
  const writeNFCTag = useCallback(async (tagId: string): Promise<NFCWriteResult> => {
    if (!checkNFCSupport()) {
      return {
        success: false,
        error: 'Web NFC no está soportado en este navegador'
      }
    }

    setIsWriting(true)

    try {
      // @ts-ignore - Web NFC API types
      const ndef = new NDEFReader()

      // Crear mensaje NDEF con el ID
      const encoder = new TextEncoder()
      const message = {
        records: [
          {
            recordType: 'text',
            data: encoder.encode(tagId)
          }
        ]
      }

      await ndef.scan()

      return new Promise((resolve) => {
        let hasWritten = false

        ndef.onreading = async (event: any) => {
          if (hasWritten) return // Evitar múltiples escrituras
          hasWritten = true

          try {
            // @ts-ignore - Web NFC API types
            await ndef.write(message)

            resolve({
              success: true,
              tagId: tagId
            })
          } catch (error) {
            resolve({
              success: false,
              error: 'Error al escribir en el tag NFC'
            })
          }
        }

        ndef.onreadingerror = () => {
          if (hasWritten) return
          resolve({
            success: false,
            error: 'Error al acceder al tag NFC'
          })
        }

        // Timeout después de 30 segundos
        setTimeout(() => {
          if (hasWritten) return
          ndef.stop()
          resolve({
            success: false,
            error: 'Tiempo de espera agotado'
          })
        }, 30000)
      })
    } catch (error) {
      return {
        success: false,
        error: 'Error al iniciar la escritura NFC'
      }
    } finally {
      setIsWriting(false)
    }
  }, [checkNFCSupport])

  // Cancelar operaciones NFC
  const cancelNFC = useCallback(async () => {
    try {
      // @ts-ignore - Web NFC API types
      if ('NDEFReader' in window) {
        // @ts-ignore
        const ndef = new NDEFReader()
        await ndef.stop()
      }
    } catch (error) {
      console.error('Error al cancelar NFC:', error)
    } finally {
      setIsReading(false)
      setIsWriting(false)
    }
  }, [])

  return {
    isSupported,
    isReading,
    isWriting,
    checkNFCSupport,
    readNFCTag,
    writeNFCTag,
    cancelNFC,
    generateNewTagId,
    checkTagExists
  }
}
