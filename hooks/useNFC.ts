'use client'

import { useState, useCallback, useEffect } from 'react'
import { NFCReadResult, NFCWriteResult } from '@/types'
import { supabase } from '@/lib/supabase'

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
    
    // ✅ Web NFC API construye el header NDEF automáticamente
    // Pasamos bytes (Uint8Array) del texto, la API agrega status byte + lang code
    return {
      records: [
        {
          recordType: 'text',
          data: encoder.encode(value)  // Uint8Array del texto, no string directamente
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
                // ✅ Decodificar correctamente NDEF text records
                const data = new Uint8Array(record.data)
                const statusByte = data[0]
                const langCodeLength = statusByte & 0x3F
                const textData = data.slice(1 + langCodeLength)
                const textDecoder = new TextDecoder('utf-8')
                const decodedText = textDecoder.decode(textData)
                records.push(decodedText)
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/1b961dcc-97f3-4efd-a753-8f991e64f97f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useNFC.ts:141',message:'readNFCTag called',data:{skipExistenceCheck},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion

    if (!checkNFCSupport()) {
      return {
        success: false,
        error: 'Web NFC no está soportado en este navegador'
      }
    }

    setIsReading(true)

    // ✅ Guardar referencia al NDEFReader para poder detenerlo
    let ndef: any = null
    let timeoutId: NodeJS.Timeout | null = null
    let resolved = false // ✅ Flag para prevenir múltiples resoluciones

    try {
      // @ts-ignore - Web NFC API types
      ndef = new NDEFReader()

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/1b961dcc-97f3-4efd-a753-8f991e64f97f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useNFC.ts:157',message:'NDEFReader created, calling scan',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion

      await ndef.scan()

      return new Promise((resolve) => {
        const resolveOnce = (result: NFCReadResult, source: string) => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/1b961dcc-97f3-4efd-a753-8f991e64f97f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useNFC.ts:164',message:'resolveOnce called',data:{resolved,source,success:result.success,error:result.error?.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion

          if (resolved) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/1b961dcc-97f3-4efd-a753-8f991e64f97f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useNFC.ts:169',message:'resolveOnce blocked - already resolved',data:{source},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            return // ✅ Prevenir múltiples resoluciones
          }
          
          // ✅ ESTABLECER flag ANTES de hacer cualquier otra cosa (crítico para prevenir race conditions)
          resolved = true
          
          // Limpiar antes de resolver
          try { 
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/1b961dcc-97f3-4efd-a753-8f991e64f97f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useNFC.ts:176',message:'Calling ndef.stop()',data:{source},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            ndef?.stop() 
          } catch {}
          if (timeoutId) clearTimeout(timeoutId)
          
          // ✅ REMOVER listeners DESPUÉS de detener (permite que stop() complete sin interferencias)
          try {
            ndef.onreading = null
            ndef.onreadingerror = null
          } catch {}
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/1b961dcc-97f3-4efd-a753-8f991e64f97f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useNFC.ts:183',message:'Resolving promise',data:{source,success:result.success},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion

          resolve(result)
        }

        ndef.onreading = async (event: any) => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/1b961dcc-97f3-4efd-a753-8f991e64f97f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useNFC.ts:199',message:'onreading event fired',data:{resolved},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion

          try {
            // Leer el contenido del tag
            let tagId = ''

            // Leer registros NDEF de texto (UTF-8)
            const ndefRecords: string[] = []
            const ndefHexRecords: string[] = []
            for (const record of event.message.records) {
              if (record.recordType === 'text') {
                // ✅ Decodificar correctamente NDEF text records
                // NDEF text record format: [status byte][idioma][texto]
                const data = new Uint8Array(record.data)
                
                // El primer byte contiene flags y longitud del código de idioma
                const statusByte = data[0]
                const langCodeLength = statusByte & 0x3F // bits 0-5 = longitud del idioma
                
                // Saltar status byte (1) + código de idioma para obtener el texto real
                const textData = data.slice(1 + langCodeLength)
                const textDecoder = new TextDecoder('utf-8')
                const decodedText = textDecoder.decode(textData)
                
                ndefRecords.push(decodedText)
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
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/1b961dcc-97f3-4efd-a753-8f991e64f97f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useNFC.ts:268',message:'onreadingerror event fired',data:{resolved},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion

          // ✅ Verificar flag ANTES de llamar resolveOnce (previene race conditions)
          if (resolved) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/1b961dcc-97f3-4efd-a753-8f991e64f97f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useNFC.ts:273',message:'onreadingerror ignored - already resolved',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
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
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/1b961dcc-97f3-4efd-a753-8f991e64f97f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useNFC.ts:265',message:'Timeout fired',data:{resolved},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
          // #endregion

          resolveOnce({
            success: false,
            error: 'Tiempo de espera agotado'
          }, 'timeout')
        }, 30000)
      })
    } catch (error) {
      // ✅ Detener el NDEFReader si hay error al iniciar
      try { ndef?.stop() } catch {}
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
            console.log('✅ Escritura completada, esperando antes de verificar...')

            // 🛑 CRÍTICO: Detener el reader actual para evitar conflicto con la verificación
            try { 
              if (ndef && typeof ndef.stop === 'function') {
                ndef.stop()
                console.log('🛑 Reader detenido para permitir verificación')
              } else {
                console.log('⚠️ Reader no tiene método stop o ya está detenido')
              }
            } catch (stopError) {
              console.log('⚠️ Error al detener reader (ignorado):', stopError)
            }
            
            // ⏱️ Esperar 1500ms para que el tag complete la escritura física
            await new Promise(resolve => setTimeout(resolve, 1500))

            // ✅ Verificación automática: volver a leer y comprobar el ID escrito
            const verifyRecords = await readNdefTextRecordsOnce()
            console.log('🔍 Verificación - Registros leídos:', verifyRecords)
            console.log('🔍 Verificación - ID esperado:', tagId)

            // Comparar tanto normalizado como original (para flexibilidad)
            const writtenId = normalizeNfcId(tagId)
            const normalized = verifyRecords.map((r) => normalizeNfcId(r))
            const matchesNormalized = normalized.includes(writtenId)
            const matchesExact = verifyRecords.includes(tagId)
            
            console.log('🔍 Verificación - Normalizado:', { writtenId, normalized, matches: matchesNormalized })
            console.log('🔍 Verificación - Exacto:', { matchesExact })

            if (!matchesNormalized && !matchesExact) {
              const readValues = verifyRecords.length > 0 ? verifyRecords.join(', ') : '(vacío)'
              resolve({
                success: false,
                error: `No se pudo verificar el ID escrito. Esperado: "${tagId}", Leído: "${readValues}". El tag puede ser de solo lectura.`
              })
              return
            }

            console.log('✅ Verificación exitosa!')
            resolve({
              success: true,
              tagId: tagId
            })
          } catch (error) {
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
    getNFCSupportInfo,
    readNFCTag,
    writeNFCTag,
    cancelNFC,
    generateNewTagId,
    checkTagExists
  }
}
