'use client'

import { useState, useCallback } from 'react'
import { NFCReadResult, NFCWriteResult } from '@/types'

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
        ndef.onreading = (event: any) => {
          try {
            // Leer el contenido del tag
            const decoder = new TextDecoder()
            let tagId = ''

            for (const record of event.message.records) {
              if (record.recordType === 'text') {
                tagId = decoder.decode(record.data)
                break
              }
              // Si no hay texto, usar el ID del tag
              if (!tagId && event.serialNumber) {
                tagId = event.serialNumber
              }
            }

            // Si no encontramos ID, generar uno basado en el serial
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
  }, [checkNFCSupport])

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

      await ndef.scan()

      return new Promise((resolve) => {
        ndef.onreading = async (event: any) => {
          try {
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
          resolve({
            success: false,
            error: 'Error al acceder al tag NFC'
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
    cancelNFC
  }
}
