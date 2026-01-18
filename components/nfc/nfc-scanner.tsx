'use client'

import { useState, useEffect, useRef } from 'react'
import { useNFC } from '@/hooks/useNFC'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Smartphone, AlertCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react'

interface NFCScannerProps {
  mode: 'read' | 'write'
  onSuccess: (tagId: string) => void
  onError?: (error: string) => void
  expectedTagId?: string // Para modo write
  title?: string
  description?: string
  continuous?: boolean // Si es true, continúa escaneando después de cada lectura exitosa
  skipExistenceCheck?: boolean // Si es true, omite la verificación de existencia del tag (útil para buscar prendas existentes)
}

export function NFCScanner({
  mode,
  onSuccess,
  onError,
  expectedTagId,
  title,
  description,
  continuous = false,
  skipExistenceCheck = false
}: NFCScannerProps) {
  const { isSupported, isReading, isWriting, readNFCTag, writeNFCTag, cancelNFC, getNFCSupportInfo } = useNFC()
  const [status, setStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [detectedTagId, setDetectedTagId] = useState('')
  const [supportInfo, setSupportInfo] = useState<any>(null)
  const isScanningRef = useRef(false) // Prevenir múltiples escaneos simultáneos
  const autoStartedRef = useRef(false) // Prevenir inicio automático múltiple
  const lastSuccessTimeRef = useRef<number>(0) // Rastrear tiempo del último éxito para ignorar errores falsos

  useEffect(() => {
    // Obtener información detallada al montar
    const info = getNFCSupportInfo()
    setSupportInfo(info)
  }, [getNFCSupportInfo])

  // ✅ Iniciar escaneo automáticamente si está en modo continuo
  useEffect(() => {
    if (continuous && status === 'idle' && isSupported && mode === 'read' && !autoStartedRef.current) {
      autoStartedRef.current = true
      handleStartScan()
    }
  }, [continuous, isSupported, mode, status]) // Solo cuando cambian estas props

  const handleStartScan = async () => {
    // ✅ Prevenir múltiples escaneos simultáneos
    if (isScanningRef.current) return
    isScanningRef.current = true

    setStatus('scanning')
    setErrorMessage('')
    setDetectedTagId('')

    try {
      if (mode === 'read') {
        const result = await readNFCTag(skipExistenceCheck)
        if (result.success && result.tagId) {
          setDetectedTagId(result.tagId)
          onSuccess(result.tagId)
          lastSuccessTimeRef.current = Date.now() // ✅ Registrar tiempo del éxito
          
          // ✅ Si está en modo continuo, automáticamente reiniciar escaneo
          if (continuous) {
            // Esperar más tiempo antes de reiniciar para asegurar que el NDEFReader anterior esté completamente detenido
            setTimeout(() => {
              isScanningRef.current = false
              setStatus('scanning')
              setDetectedTagId('')
              handleStartScan()
            }, 1000) // Aumentado de 500ms a 1000ms para dar más tiempo de limpieza
          } else {
            isScanningRef.current = false
            setStatus('success')
          }
        } else {
          // ✅ Solo llamar onError si no hubo un éxito muy reciente (< 200ms)
          const timeSinceLastSuccess = Date.now() - lastSuccessTimeRef.current
          const isRecentSuccess = timeSinceLastSuccess < 200
          
          if (isRecentSuccess) {
            // Ignorar el error si fue muy reciente (probablemente falso positivo de stop())
            console.log('⚠️ Error ignorado - muy reciente después de éxito:', result.error)
          } else {
            // Es un error real, mostrar y manejar normalmente
            setErrorMessage(result.error || 'Error desconocido')
            setStatus('error')
            onError?.(result.error || 'Error desconocido')
          }
          
          // ✅ En modo continuo, también reiniciar el escaneo después de un error
          if (continuous) {
            // Reiniciar después de un breve momento
            setTimeout(() => {
              isScanningRef.current = false
              setStatus('scanning')
              setErrorMessage('')
              setDetectedTagId('')
              handleStartScan()
            }, isRecentSuccess ? 1000 : 1000) // Mismo tiempo para ambos casos
          } else if (!isRecentSuccess) {
            // Solo mostrar error si no es reciente
            isScanningRef.current = false
          }
        }
      } else if (mode === 'write' && expectedTagId) {
        const result = await writeNFCTag(expectedTagId)
        isScanningRef.current = false
        if (result.success) {
          setStatus('success')
          onSuccess(expectedTagId)
        } else {
          setErrorMessage(result.error || 'Error desconocido')
          setStatus('error')
          onError?.(result.error || 'Error desconocido')
        }
      }
    } catch (error) {
      isScanningRef.current = false
      setErrorMessage('Error inesperado')
      setStatus('error')
      onError?.('Error inesperado')
    }
  }

  const handleCancel = async () => {
    isScanningRef.current = false
    await cancelNFC()
    setStatus('idle')
    setErrorMessage('')
    setDetectedTagId('')
  }

  if (!isSupported) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <p className="font-medium">Web NFC no está disponible</p>

            {supportInfo && (
              <div className="text-sm space-y-1">
                {!supportInfo.hasNDEFReader && (
                  <p>❌ NDEFReader no soportado en este navegador</p>
                )}

                {!supportInfo.isSecureContext && (
                  <p>❌ Se requiere HTTPS o localhost (actualmente: {supportInfo.protocol} - {supportInfo.hostname})</p>
                )}

                {supportInfo.chromeVersion && supportInfo.chromeVersion < 89 && (
                  <p>⚠️ Chrome versión {supportInfo.chromeVersion} - Se requiere Chrome 89+</p>
                )}

                {supportInfo.androidVersion && parseFloat(supportInfo.androidVersion) < 8.1 && (
                  <p>⚠️ Android {supportInfo.androidVersion} - Se requiere Android 8.1+</p>
                )}

                {!supportInfo.isChromeAndroid && supportInfo.isMobile && (
                  <p>⚠️ No es Chrome Android - Web NFC solo funciona en Chrome</p>
                )}

                {!supportInfo.isMobile && (
                  <p>⚠️ Recomendado: Dispositivo móvil</p>
                )}

                {/* ✅ AGREGAR: Mostrar información útil si todo parece correcto */}
                {supportInfo.hasNDEFReader && supportInfo.isSecureContext && supportInfo.isChromeAndroid && (
                  <div className="text-green-600 dark:text-green-400 space-y-1 mt-3 pt-3 border-t border-green-300 dark:border-green-700">
                    <p>✅ NDEFReader disponible</p>
                    <p>✅ Contexto seguro (HTTPS/localhost)</p>
                    <p>✅ Chrome Android detectado</p>
                    {supportInfo.chromeVersion && <p>✅ Chrome versión {supportInfo.chromeVersion}</p>}
                    {supportInfo.androidVersion && <p>✅ Android {supportInfo.androidVersion}</p>}
                    <div className="mt-3 pt-3 border-t border-green-300 dark:border-green-700">
                      <p className="font-medium text-yellow-600 dark:text-yellow-400">⚠️ Si aún no funciona, verifica:</p>
                      <ul className="list-disc list-inside ml-2 text-xs space-y-0.5 mt-1">
                        <li>NFC activado en el dispositivo</li>
                        <li>Permisos de NFC para Chrome (Configuración &gt; Apps &gt; Chrome &gt; Permisos)</li>
                        <li>Reiniciar Chrome después de activar NFC</li>
                        <li>Probar en modo incógnito (para descartar extensiones)</li>
                        <li>El dispositivo tiene hardware NFC</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="text-xs text-muted-foreground mt-3">
              <p><strong>Solución:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Usa Chrome en Android (versión 89+)</li>
                <li>Asegúrate de acceder por HTTPS</li>
                <li>Activa NFC en tu teléfono</li>
                <li>Para desarrollo local: usa ngrok o similar para HTTPS</li>
              </ul>
            </div>
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          {title || (mode === 'read' ? 'Escanear Tag NFC' : 'Escribir Tag NFC')}
        </CardTitle>
        <CardDescription>
          {description ||
            (mode === 'read'
              ? 'Acércate un tag NFC NTAG213 para leer su contenido'
              : 'Acércate un tag NFC NTAG213 para escribir el ID'
            )
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Estado del proceso */}
        {status === 'scanning' && (
          <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <div>
              <p className="font-medium text-blue-900 dark:text-blue-100">
                {continuous 
                  ? 'Escaneando continuamente...' 
                  : (mode === 'read' ? 'Leyendo tag NFC...' : 'Escribiendo tag NFC...')}
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {continuous 
                  ? 'Acércate tags NFC al teléfono (se agregarán automáticamente)' 
                  : 'Acércate el tag NFC al teléfono'}
              </p>
              {continuous && detectedTagId && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  ✓ Último código leído: {detectedTagId}
                </p>
              )}
            </div>
          </div>
        )}

        {status === 'success' && !continuous && (
          <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-medium text-green-900 dark:text-green-100">
                ¡Operación exitosa!
              </p>
              {detectedTagId && (
                <p className="text-sm text-green-700 dark:text-green-300">
                  Tag ID: <Badge variant="secondary">{detectedTagId}</Badge>
                </p>
              )}
            </div>
          </div>
        )}

        {status === 'error' && errorMessage && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {/* Información del tag esperado (modo write) */}
        {mode === 'write' && expectedTagId && (
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-1">ID a escribir:</p>
            <Badge variant="outline">{expectedTagId}</Badge>
          </div>
        )}

        {/* Botones de acción */}
        <div className="flex gap-2">
          {status === 'idle' && (
            <Button onClick={handleStartScan} className="flex-1">
              {mode === 'read' ? 'Escanear Tag' : 'Escribir Tag'}
            </Button>
          )}

          {status === 'scanning' && (
            <Button onClick={handleCancel} variant="outline" className="flex-1">
              Cancelar
            </Button>
          )}

          {status === 'success' && (
            <Button onClick={() => setStatus('idle')} variant="outline" className="flex-1">
              Escanear Otro
            </Button>
          )}

          {status === 'error' && (
            <Button onClick={handleStartScan} className="flex-1">
              Reintentar
            </Button>
          )}
        </div>

        {/* Instrucciones adicionales */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Asegúrate de que NFC esté activado en tu teléfono</p>
          <p>• Solo funciona con tags NTAG213 compatibles</p>
          <p>• Mantén el tag cerca del teléfono hasta completar la operación</p>
        </div>
      </CardContent>
    </Card>
  )
}



