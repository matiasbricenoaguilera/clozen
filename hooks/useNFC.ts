'use client'

import { useState, useCallback, useEffect } from 'react'
import { NFCReadResult, NFCWriteResult } from '@/types'
import { supabase } from '@/lib/supabase'

/**
 * Lectura NFC en curso, a nivel de módulo.
 *
 * Web NFC no distingue lectores: si dos `NDEFReader` están escaneando a la vez,
 * los dos reciben el mismo tag y cada uno lo entrega a un flujo distinto (la
 * prenda acaba a la vez retirada y asignada a una caja). Como cada `NFCScanner`
 * monta su propio `useNFC`, hace falta este registro compartido para garantizar
 * que solo hay un lector activo en la página.
 */
let lecturaActiva: { detener: (motivo: string) => void } | null = null

/** Detiene de verdad la lectura en curso, si la hay */
function detenerLecturaActiva(motivo: string) {
  const enCurso = lecturaActiva
  lecturaActiva = null

  if (enCurso) {
    console.log('📱 NFC: se detiene la lectura anterior —', motivo)
    enCurso.detener(motivo)
  }
}

export function useNFC() {
  const [isSupported, setIsSupported] = useState(false)
  const [isReading, setIsReading] = useState(false)
  const [isWriting, setIsWriting] = useState(false)

  // ✅ MEJORAR: Verificar si Web NFC está soportado con más detalle
  const checkNFCSupport = useCallback(() => {
    // Verificar soporte básico
    if (!('NDEFReader' in window)) {
      console.log('❌ Web NFC: NDEFReader no disponible en window')
      setIsSupported(false)
      return false
    }

    // ✅ MEJORAR: Permitir HTTPS O localhost (para desarrollo)
    const isSecureContext = 
      typeof window !== 'undefined' && (
        window.location.protocol === 'https:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.endsWith('.localhost')
      )

    if (!isSecureContext) {
      console.log('❌ Web NFC: Se requiere HTTPS o localhost, actualmente:', window.location.protocol, window.location.hostname)
      setIsSupported(false)
      return false
    }

    console.log('✅ Web NFC: Soporte detectado correctamente')
    setIsSupported(true)
    return true
  }, [])

  // ✅ AGREGAR: Inicializar verificación al montar
  useEffect(() => {
    // Verificar soporte cuando el componente se monta
    checkNFCSupport()
  }, [checkNFCSupport])

  // ✅ MEJORAR: Agregar función para obtener información detallada de compatibilidad
  const getNFCSupportInfo = useCallback(() => {
    const isSecureContext = 
      typeof window !== 'undefined' && (
        window.location.protocol === 'https:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.endsWith('.localhost')
      )

    const info = {
      hasNDEFReader: 'NDEFReader' in window,
      isHTTPS: typeof window !== 'undefined' && window.location.protocol === 'https:',
      isLocalhost: typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'),
      isSecureContext: isSecureContext, // ✅ Agregar verificación de contexto seguro
      isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ),
      isChromeAndroid: /Chrome/i.test(navigator.userAgent) && /Android/i.test(navigator.userAgent),
      chromeVersion: (() => {
        const match = navigator.userAgent.match(/Chrome\/(\d+)/)
        return match ? parseInt(match[1]) : null
      })(),
      androidVersion: (() => {
        const match = navigator.userAgent.match(/Android (\d+(\.\d+)?)/)
        return match ? match[1] : null
      })(),
      userAgent: navigator.userAgent,
      protocol: typeof window !== 'undefined' ? window.location.protocol : 'unknown',
      hostname: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
      fullUrl: typeof window !== 'undefined' ? window.location.href : 'unknown'
    }

    console.log('🔍 Información detallada de NFC:', info)
    return info
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

  // Normalizar ID NFC: limpiar, upper y remover guiones
  const normalizeNfcId = useCallback((value: string) => {
    return value.trim().toUpperCase().replace(/-/g, '')
  }, [])

  // Validar ID NFC: hexadecimal largo (>= 8 chars, sin separadores)
  const isValidNfcId = useCallback((value: string) => {
    return /^[0-9A-F]{8,}$/.test(value)
  }, [])


  const toHexString = useCallback((data: ArrayBuffer | DataView | Uint8Array) => {
    const bytes = data instanceof Uint8Array
      ? data
      : data instanceof DataView
        ? new Uint8Array(data.buffer)
        : new Uint8Array(data)
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(':').toUpperCase()
  }, [])

  // Construir mensaje NDEF con un solo registro UTF-8
  const buildSingleTextMessage = useCallback((value: string) => {
    const encoder = new TextEncoder()
    
    // Construir NDEF Text Record según especificación NFC Forum RTD
    const languageCode = 'en'
    const languageCodeBytes = encoder.encode(languageCode)
    const textBytes = encoder.encode(value)
    
    // Status byte según NFC Forum RTD:
    // - Bit 7: 0 = UTF-8 (1 = UTF-16)
    // - Bit 6: siempre 0
    // - Bits 5-0: longitud del código de idioma (0x02 para 'en')
    const statusByte = languageCodeBytes.length // 0x02 para 'en'
    
    // Payload completo = [status byte][language code][text]
    const payload = new Uint8Array(1 + languageCodeBytes.length + textBytes.length)
    payload[0] = statusByte
    payload.set(languageCodeBytes, 1)
    payload.set(textBytes, 1 + languageCodeBytes.length)
    
    console.log('📝 NDEF Text Record construido:', {
      statusByte: statusByte.toString(16),
      languageCode,
      textLength: textBytes.length,
      payloadLength: payload.length,
      payloadHex: Array.from(payload).map(b => b.toString(16).padStart(2, '0')).join(' ')
    })
    
    return {
      records: [
        {
          recordType: 'text',
          data: payload
        }
      ]
    }
  }, [])

  // Leer registros NDEF de texto una sola vez (para verificación de escritura)
  const readNdefTextRecordsOnce = useCallback(async (): Promise<string[]> => {
    if (!checkNFCSupport()) return []

    // @ts-ignore - Web NFC API types
    const ndef = new NDEFReader()
    let timeoutId: NodeJS.Timeout | null = null

    try {
      await ndef.scan()
      return await new Promise((resolve) => {
        ndef.onreading = (event: any) => {
          try {
            const records: string[] = []
            for (const record of event.message.records) {
              if (record.recordType === 'text') {
                let text = ''
                
                try {
                  // Obtener datos como Uint8Array
                  const data = new Uint8Array(record.data)
                  
                  if (data.length > 0) {
                    // Leer el status byte para obtener la longitud del código de idioma
                    const statusByte = data[0]
                    const languageCodeLength = statusByte & 0x3F // Bits 5-0
                    
                    // Verificar que tenga un header válido
                    if (languageCodeLength > 0 && languageCodeLength <= 6 && data.length > languageCodeLength + 1) {
                      // Saltar el header: 1 byte (status) + N bytes (language code)
                      const payloadStart = 1 + languageCodeLength
                      const payload = data.slice(payloadStart)
                      const decoder = new TextDecoder('utf-8')
                      text = decoder.decode(payload)
                    } else {
                      // Si no tiene header, decodificar todo
                      const decoder = new TextDecoder('utf-8')
                      text = decoder.decode(data)
                    }
                  }
                } catch (e) {
                  console.warn('⚠️ Error decodificando record:', e)
                  text = ''
                }
                
                if (text) {
                  records.push(text)
                }
              }
            }
            resolve(records)
          } catch {
            resolve([])
          } finally {
            try { ndef.stop() } catch {}
            if (timeoutId) clearTimeout(timeoutId)
          }
        }

        ndef.onreadingerror = () => {
          try { ndef.stop() } catch {}
          if (timeoutId) clearTimeout(timeoutId)
          resolve([])
        }

        timeoutId = setTimeout(() => {
          try { ndef.stop() } catch {}
          resolve([])
        }, 5000)
      })
    } catch {
      return []
    }
  }, [checkNFCSupport])

  // Generar nuevo ID único para tag NFC (UUID v4 sin guiones)
  const generateNewTagId = useCallback(() => {
    try {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID().replace(/-/g, '').toUpperCase()
      }
    } catch {}

    // Fallback: timestamp + random (hexadecimal largo)
    const timestamp = Date.now().toString(16)
    const random = Math.floor(Math.random() * 0xFFFFFFFFFFFF).toString(16)
    return `${timestamp}${random}`.toUpperCase()
  }, [])

  // Leer tag NFC
  const readNFCTag = useCallback(async (skipExistenceCheck: boolean = false): Promise<NFCReadResult> => {
    if (!checkNFCSupport()) {
      return {
        success: false,
        error: 'Web NFC no está soportado en este navegador'
      }
    }

    // Solo puede haber un lector activo: el que llegue después manda
    detenerLecturaActiva('otro lector tomó el control')

    setIsReading(true)

    // ✅ Guardar referencia al NDEFReader para poder detenerlo
    let ndef: any = null
    let timeoutId: NodeJS.Timeout | null = null
    let resolved = false // ✅ Flag para prevenir múltiples resoluciones

    // `scan({ signal })` es la única forma de cancelar de verdad: sin esto, el
    // lector sigue escuchando aunque se cierre el diálogo que lo abrió
    const abortarEscaneo = new AbortController()

    try {
      // @ts-ignore - Web NFC API types
      ndef = new NDEFReader()

      await ndef.scan({ signal: abortarEscaneo.signal })

      return new Promise((resolve) => {
        const resolveOnce = (result: NFCReadResult, source: string) => {
          if (resolved) {
            return // ✅ Prevenir múltiples resoluciones
          }
          
          // ✅ ESTABLECER flag ANTES de hacer cualquier otra cosa (crítico para prevenir race conditions)
          resolved = true

          // Esta lectura deja de ser la activa
          if (lecturaActiva === registro) {
            lecturaActiva = null
          }

          // Limpiar antes de resolver
          try { 
            ndef?.stop() 
          } catch {}
          try {
            abortarEscaneo.abort()
          } catch {}
          if (timeoutId) clearTimeout(timeoutId)
          
          // ✅ REMOVER listeners DESPUÉS de detener (permite que stop() complete sin interferencias)
          try {
            ndef.onreading = null
            ndef.onreadingerror = null
          } catch {}
          
          resolve(result)
        }

        // Queda registrada para que otro lector —o el botón de cancelar, o
        // cerrar el diálogo— pueda detenerla de verdad
        const registro = {
          detener: (motivo: string) =>
            resolveOnce({ success: false, error: motivo, cancelled: true }, 'cancelado')
        }
        lecturaActiva = registro

        ndef.onreading = async (event: any) => {
          try {
            // Leer el contenido del tag
            let tagId = ''

            // Leer registros NDEF de texto (UTF-8)
            const ndefRecords: string[] = []
            const ndefHexRecords: string[] = []
            
            // 🔍 DEBUG: Ver todos los records del mensaje
            console.log('🔍 Mensaje NDEF completo:', {
              totalRecords: event.message.records.length,
              records: event.message.records.map((r: any) => ({
                recordType: r.recordType,
                mediaType: r.mediaType,
                id: r.id,
                encoding: r.encoding,
                lang: r.lang,
                dataLength: r.data?.length || r.data?.byteLength || 0
              }))
            })
            
            for (const record of event.message.records) {
              console.log('🔍 Procesando record:', {
                recordType: record.recordType,
                isText: record.recordType === 'text',
                allProperties: Object.keys(record)
              })
              
              if (record.recordType === 'text') {
                let text = ''
                
                try {
                  // Log para ver qué tipo de dato es record.data
                  console.log('🔍 record.data tipo:', {
                    type: typeof record.data,
                    isUint8Array: record.data instanceof Uint8Array,
                    isArrayBuffer: record.data instanceof ArrayBuffer,
                    isDataView: record.data instanceof DataView,
                    constructor: record.data?.constructor?.name,
                    rawData: record.data
                  })
                  
                  // Obtener datos como Uint8Array
                  let data: Uint8Array
                  
                  if (record.data instanceof Uint8Array) {
                    data = record.data
                  } else if (record.data instanceof ArrayBuffer) {
                    data = new Uint8Array(record.data)
                  } else if (record.data instanceof DataView) {
                    data = new Uint8Array(record.data.buffer)
                  } else if (typeof record.data === 'string') {
                    // Si es string, convertir a bytes
                    const encoder = new TextEncoder()
                    data = encoder.encode(record.data)
                  } else {
                    // Último intento: forzar conversión
                    data = new Uint8Array(record.data)
                  }
                  
                  console.log('🔍 data después de conversión:', {
                    length: data.length,
                    first10Bytes: Array.from(data.slice(0, 10)).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ')
                  })
                  
                  if (data.length > 0) {
                    // Leer el status byte
                    const statusByte = data[0]
                    const languageCodeLength = statusByte & 0x3F // Bits 5-0
                    
                    console.log('🔍 NDEF Header:', {
                      statusByte: `0x${statusByte.toString(16)}`,
                      languageCodeLength,
                      dataLength: data.length,
                      minRequiredLength: 1 + languageCodeLength + 1
                    })
                    
                    // Verificar que tenga un header válido
                    if (languageCodeLength > 0 && languageCodeLength <= 6 && data.length > languageCodeLength + 1) {
                      // Saltar el header
                      const payloadStart = 1 + languageCodeLength
                      const payload = data.slice(payloadStart)
                      const decoder = new TextDecoder('utf-8')
                      text = decoder.decode(payload)
                      
                      console.log('✅ NDEF: Header detectado y saltado:', {
                        statusByte: `0x${statusByte.toString(16)}`,
                        languageCodeLength,
                        payloadStart,
                        payloadLength: payload.length,
                        extractedText: text
                      })
                    } else {
                      // Si no tiene header válido, decodificar todo
                      const decoder = new TextDecoder('utf-8')
                      text = decoder.decode(data)
                      
                      console.log('⚠️ NDEF: Sin header válido, texto completo:', {
                        dataLength: data.length,
                        text: text
                      })
                    }
                  }
                } catch (e) {
                  console.error('❌ Error decodificando record:', e)
                  text = ''
                }
                
                console.log('📖 Registro NDEF leído:', { 
                  text, 
                  length: text.length,
                  dataType: typeof record.data
                })
                
                if (text) {
                  ndefRecords.push(text)
                }
                ndefHexRecords.push(toHexString(record.data))
              }
            }

            // Normalizar UTF-8 (solo trim, sin filtros hex-like)
            const utf8Records = ndefRecords
              .map((record) => record.trim())
              .filter((record) => record.length > 0)

            const hexRecords = ndefHexRecords
              .map((record) => normalizeNfcId(record))
              .filter((record) => isValidNfcId(record))

            let infoMessage = ''
            let selectedSource: 'serial' | 'utf8-1' | 'utf8-2' | 'hex' | null = null

            // ✅ DEBUG: Log para ver qué información está disponible
            console.log('🔍 NFC Event Info:', {
              hasSerialNumber: !!event.serialNumber,
              serialNumber: event.serialNumber,
              utf8Records,
              hexRecords,
              eventKeys: Object.keys(event)
            })

            // ✅ PRIORIDAD 1: UTF-8 registro 1 (lo que escribiste, editable)
            if (utf8Records[0]) {
              tagId = utf8Records[0]
              selectedSource = 'utf8-1'
              console.log('✅ Usando UTF-8 registro 1:', tagId)
            }

            // ✅ Si hay duplicado en UTF-8 registro 1, usar UTF-8 registro 2
            if (!skipExistenceCheck && tagId && selectedSource === 'utf8-1') {
              const tagCheck = await checkTagExists(tagId)
              if (tagCheck.exists && utf8Records[1]) {
                tagId = utf8Records[1]
                selectedSource = 'utf8-2'
                infoMessage = 'Duplicado en UTF-8 registro 1, leyendo registro 2.'
                console.log('⚠️ UTF-8 registro 1 duplicado, usando registro 2:', tagId)
              }
            }

            // ✅ PRIORIDAD 2: Serial number (solo si no hay UTF-8, inmutable del chip)
            if (!tagId && event.serialNumber) {
              // Intentar convertir a formato MAC (más legible)
              tagId = generateMacLikeId(event.serialNumber)

              // Si la conversión falla, usar serial number directo
              if (!tagId) {
                tagId = event.serialNumber
              }

              selectedSource = 'serial'
              infoMessage = 'Sin UTF-8. Usando serial number del chip.'
              console.log('⚠️ Sin UTF-8, usando serial number:', tagId)
            }

            // ✅ PRIORIDAD 3: HEX como último recurso (si no hay UTF-8 ni serial)
            if (!tagId && hexRecords[0]) {
              tagId = hexRecords[0]
              selectedSource = 'hex'
              infoMessage = 'Sin UTF-8 ni serial. Usando HEX como respaldo.'
              console.log('⚠️ Usando HEX como respaldo:', tagId)
            }

            // ✅ Si NO hay serial ni registros válidos
            if (!tagId) {
              if (skipExistenceCheck) {
                resolveOnce({
                  success: false,
                  error: 'Tag sin ID válido. Registra el tag primero.'
                }, 'onreading-invalid-ndef')
                return
              }

              // Generar nuevo ID único y escribirlo en el tag
              const newTagId = generateNewTagId()
              tagId = newTagId
              infoMessage = 'No hay ID válido. Generando y escribiendo nuevo código.'

              console.log('⚠️ Tag sin ID válido, generando y escribiendo ID único:', newTagId)

              try {
                const message = buildSingleTextMessage(newTagId)

                // @ts-ignore - Web NFC API types
                await ndef.write(message)
                console.log('✅ ID único escrito en tag NFC:', newTagId)
              } catch (writeError) {
                console.warn('⚠️ No se pudo escribir ID en tag, posible solo lectura:', writeError)
                resolveOnce({
                  success: false,
                  error: 'No se pudo escribir en el tag NFC. Puede ser de solo lectura o estar bloqueado.'
                }, 'onwriting-failed')
                return
              }
            }

            if (!tagId) {
              resolveOnce({
                success: false,
                error: 'No se pudo obtener un ID válido del tag'
              }, 'onreading-no-tag-id')
              return
            }

            // ✅ Solo verificar si el tag ya está asociado si NO se omite la verificación
            // (útil cuando estás buscando prendas existentes para devolver al closet)
            if (!skipExistenceCheck) {
              const tagCheck = await checkTagExists(tagId)
              if (tagCheck.exists) {
                resolveOnce({
                  success: false,
                  error: `Este tag NFC ya está asociado a ${tagCheck.entity === 'garment' ? 'la prenda' : 'la caja'} "${tagCheck.name}"`
                }, 'onreading-tag-exists')
                return
              }
            }

            // ✅ Resolver con éxito (esto detendrá el NDEFReader, pero con la flag no se resolverá de nuevo)
            resolveOnce({
              success: true,
              tagId: tagId,
              info: infoMessage,
              ndefTextRecords: ndefRecords,
              ndefHexRecords: ndefHexRecords,
              ndefRecordCount: ndefRecords.length,
              selectedSource: selectedSource
            }, 'onreading-success')
          } catch (error) {
            resolveOnce({
              success: false,
              error: 'Error al procesar el tag NFC'
            }, 'onreading-catch')
          }
        }

        ndef.onreadingerror = () => {
          // ✅ Verificar flag ANTES de llamar resolveOnce (previene race conditions)
          if (resolved) {
            return
          }

          // ✅ Solo resolver si aún no se ha resuelto (evita que stop() dispare este error)
          resolveOnce({
            success: false,
            error: 'Error al leer el tag NFC'
          }, 'onreadingerror')
        }

        // Timeout después de 30 segundos
        timeoutId = setTimeout(() => {
          resolveOnce({
            success: false,
            error: 'Tiempo de espera agotado'
          }, 'timeout')
        }, 30000)
      })
    } catch (error) {
      // ✅ Detener el NDEFReader si hay error al iniciar
      try { ndef?.stop() } catch {}
      try { abortarEscaneo.abort() } catch {}
      if (timeoutId) clearTimeout(timeoutId)
      return {
        success: false,
        error: 'Error al iniciar la lectura NFC'
      }
    } finally {
      setIsReading(false)
    }
  }, [checkNFCSupport, generateMacLikeId, checkTagExists, generateNewTagId, normalizeNfcId, isValidNfcId, buildSingleTextMessage, toHexString])

  // Escribir tag NFC
  const writeNFCTag = useCallback(async (tagId: string): Promise<NFCWriteResult> => {
    if (!checkNFCSupport()) {
      return {
        success: false,
        error: 'Web NFC no está soportado en este navegador'
      }
    }

    // Escribir mientras hay una lectura escuchando confunde al lector: el mismo
    // acercamiento dispara la lectura y la escritura
    detenerLecturaActiva('se va a escribir en el tag')

    setIsWriting(true)

    try {
      // @ts-ignore - Web NFC API types
      const ndef = new NDEFReader()

      // Crear mensaje NDEF con un solo registro UTF-8 (sobrescribe el contenido anterior)
      const message = buildSingleTextMessage(tagId)

      await ndef.scan()

      return new Promise((resolve) => {
        let hasWritten = false

        ndef.onreading = async (event: any) => {
          if (hasWritten) return // Evitar múltiples escrituras
          hasWritten = true

          try {
            // @ts-ignore - Web NFC API types
            await ndef.write(message)
            
            // ✅ Si write() no lanza error, la escritura fue exitosa
            // No verificamos porque puede causar falsos negativos por timing
            console.log('✅ Tag NFC escrito exitosamente con ID:', tagId)
            
            // Detener el reader
            try { 
              if (ndef && typeof ndef.stop === 'function') {
                ndef.stop()
              }
            } catch {}
            
            resolve({
              success: true,
              tagId: tagId
            })
          } catch (error) {
            console.error('❌ Error al escribir tag NFC:', error)
            resolve({
              success: false,
              error: 'No se pudo escribir en el tag NFC. Puede ser de solo lectura o estar bloqueado.'
            })
          }
        }

        ndef.onreadingerror = () => {
          if (hasWritten) return
          resolve({
            success: false,
            error: 'Error al acceder al tag NFC. Verifica si el tag permite escritura.'
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
    // Antes se creaba un NDEFReader nuevo y se le llamaba a stop(): eso detiene
    // el objeto recién creado, no el que estaba escuchando, así que el lector
    // seguía vivo y entregaba la siguiente lectura a un flujo ya cerrado
    detenerLecturaActiva('lectura cancelada')
    setIsReading(false)
    setIsWriting(false)
  }, [])

  return {
    isSupported,
    isReading,
    isWriting,
    checkNFCSupport,
    getNFCSupportInfo,
    readNFCTag,
    writeNFCTag,
    cancelNFC,
    generateNewTagId,
    checkTagExists
  }
}
