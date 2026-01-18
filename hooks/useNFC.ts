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
              resolveOnce({
                success: false,
                error: 'No se pudo leer el ID del tag'
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
              tagId: tagId
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
    getNFCSupportInfo,
    readNFCTag,
    writeNFCTag,
    cancelNFC,
    generateNewTagId,
    checkTagExists
  }
}
