'use client'

import { useState, useEffect } from 'react'
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
}

export function NFCScanner({
  mode,
  onSuccess,
  onError,
  expectedTagId,
  title,
  description
}: NFCScannerProps) {
  const { isSupported, isReading, isWriting, readNFCTag, writeNFCTag, cancelNFC, getNFCSupportInfo } = useNFC()
  const [status, setStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [detectedTagId, setDetectedTagId] = useState('')
  const [supportInfo, setSupportInfo] = useState<any>(null)

  useEffect(() => {
    // Obtener información detallada al montar
    const info = getNFCSupportInfo()
    setSupportInfo(info)
  }, [getNFCSupportInfo])

  const handleStartScan = async () => {
    setStatus('scanning')
    setErrorMessage('')
    setDetectedTagId('')

    try {
      if (mode === 'read') {
        const result = await readNFCTag()
        if (result.success && result.tagId) {
          setDetectedTagId(result.tagId)
          setStatus('success')
          onSuccess(result.tagId)
        } else {
          setErrorMessage(result.error || 'Error desconocido')
          setStatus('error')
          onError?.(result.error || 'Error desconocido')
        }
      } else if (mode === 'write' && expectedTagId) {
        const result = await writeNFCTag(expectedTagId)
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
      setErrorMessage('Error inesperado')
      setStatus('error')
      onError?.('Error inesperado')
    }
  }

  const handleCancel = async () => {
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

                {!supportInfo.isHTTPS && (
                  <p>❌ Se requiere HTTPS (actualmente: {supportInfo.protocol})</p>
                )}

                {!supportInfo.isChromeAndroid && (
                  <p>⚠️ Recomendado: Chrome en Android</p>
                )}

                {!supportInfo.isMobile && (
                  <p>⚠️ Recomendado: Dispositivo móvil</p>
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
                {mode === 'read' ? 'Leyendo tag NFC...' : 'Escribiendo tag NFC...'}
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Acércate el tag NFC al teléfono
              </p>
            </div>
          </div>
        )}

        {status === 'success' && (
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



