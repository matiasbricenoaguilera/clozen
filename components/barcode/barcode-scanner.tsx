'use client'

import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, X, Camera } from 'lucide-react'

interface BarcodeScannerProps {
  onSuccess: (code: string) => void
  onError?: (error: string) => void
  onClose?: () => void
  title?: string
  description?: string
  continuous?: boolean // Si es true, continúa escaneando después de cada lectura
}

export function BarcodeScanner({
  onSuccess,
  onError,
  onClose,
  title = 'Escanear Código de Barras',
  description = 'Apunta la cámara hacia el código de barras',
  continuous = false
}: BarcodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState('')
  const [cameraId, setCameraId] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const lastScannedCodeRef = useRef<string>('')
  const lastScanTimeRef = useRef<number>(0)

  // Detener escáner al desmontar
  useEffect(() => {
    return () => {
      stopScanner()
    }
  }, [])

  const stopScanner = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop()
        await scannerRef.current.clear()
      } catch (err) {
        console.error('Error stopping scanner:', err)
      }
      scannerRef.current = null
      setIsScanning(false)
    }
  }

  const startScanner = async () => {
    try {
      setError('')
      
      // Verificar permisos de cámara primero
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        // Detener el stream inmediatamente, solo queríamos verificar permisos
        stream.getTracks().forEach(track => track.stop())
      } catch (permError: any) {
        if (permError.name === 'NotAllowedError' || permError.name === 'PermissionDeniedError') {
          throw new Error('Permisos de cámara denegados. Por favor, permite el acceso a la cámara en la configuración del navegador.')
        } else if (permError.name === 'NotFoundError' || permError.name === 'DevicesNotFoundError') {
          throw new Error('No se encontró ninguna cámara en el dispositivo.')
        } else if (permError.name === 'NotReadableError' || permError.name === 'TrackStartError') {
          throw new Error('La cámara está siendo usada por otra aplicación. Cierra otras apps que usen la cámara e intenta de nuevo.')
        } else {
          throw new Error(`Error de permisos: ${permError.message}`)
        }
      }
      
      // Crear instancia del escáner
      const html5QrCode = new Html5Qrcode('barcode-reader')
      scannerRef.current = html5QrCode

      // Obtener lista de cámaras disponibles
      const devices = await Html5Qrcode.getCameras()
      
      if (devices.length === 0) {
        throw new Error('No se encontraron cámaras disponibles')
      }

      console.log('📷 Cámaras disponibles:', devices.map(d => ({ id: d.id, label: d.label })))

      // Usar la cámara trasera si está disponible, sino la primera
      const backCamera = devices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear') ||
        device.label.toLowerCase().includes('environment') ||
        device.label.toLowerCase().includes('facing back')
      )
      
      const selectedCamera = backCamera || devices[0]
      setCameraId(selectedCamera.id)
      console.log('📷 Cámara seleccionada:', selectedCamera.label)

      // Detectar si es móvil
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      const isAndroid = /Android/i.test(navigator.userAgent)

      // Configuración adaptativa para móviles
      // En móviles, usar porcentajes del viewport en lugar de píxeles fijos
      const qrboxSize = isMobile 
        ? { width: 250, height: 250 } // Más pequeño para móviles
        : { width: 300, height: 300 }

      // Configuración para códigos de barras - simplificada para Android
      const config: any = {
        fps: isAndroid ? 5 : 10,
        qrbox: qrboxSize,
        aspectRatio: 1.0,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.ITF
        ]
      }

      // En Android, intentar sin videoConstraints (más compatible)
      if (isAndroid) {
        config.disableFlip = false
        // No usar videoConstraints en Android, dejar que html5-qrcode maneje la selección
      }

      // Iniciar escaneo con manejo de errores mejorado
      try {
        await html5QrCode.start(
          selectedCamera.id,
          config,
          (decodedText: string) => {
            // Callback cuando se detecta un código
            const now = Date.now()
            
            // Prevenir escaneos duplicados muy rápidos (debounce de 1 segundo)
            if (decodedText === lastScannedCodeRef.current && (now - lastScanTimeRef.current) < 1000) {
              return
            }

            lastScannedCodeRef.current = decodedText
            lastScanTimeRef.current = now

            // Llamar callback de éxito
            onSuccess(decodedText)

            // Si no es continuo, detener después de escanear
            if (!continuous) {
              stopScanner()
            }
          },
          (errorMessage: string) => {
            // Ignorar errores de "no se encontró código" (es normal mientras escanea)
            if (!errorMessage.includes('No QR code found') && !errorMessage.includes('NotFoundException')) {
              console.log('Scan error:', errorMessage)
            }
          }
        )
      } catch (startError: any) {
        // Manejar errores específicos de html5-qrcode.start()
        console.error('❌ Error en html5QrCode.start():', startError)
        
        if (startError.message && startError.message.includes('Could not start video source')) {
          throw new Error('No se pudo iniciar la cámara. Verifica que: 1) No haya otras apps usando la cámara, 2) Los permisos estén habilitados, 3) El dispositivo tenga cámara disponible.')
        } else if (startError.message && startError.message.includes('Permission denied')) {
          throw new Error('Permisos de cámara denegados. Ve a Configuración → Aplicaciones → Chrome → Permisos → Cámara → Permitir')
        } else if (startError.message && startError.message.includes('device not found')) {
          throw new Error('Cámara no encontrada. Verifica que el dispositivo tenga cámara disponible.')
        } else {
          throw new Error(`Error al iniciar cámara: ${startError.message || startError.toString()}`)
        }
      }

      setIsScanning(true)
    } catch (err: any) {
      console.error('❌ Error starting barcode scanner:', err)
      
      // Mensajes de error más descriptivos
      let errorMsg = 'Error al iniciar el escáner de códigos de barras'
      
      if (err.message) {
        errorMsg = err.message
      } else if (err.name === 'NotAllowedError') {
        errorMsg = 'Permisos de cámara denegados. Por favor, permite el acceso a la cámara.'
      } else if (err.name === 'NotFoundError') {
        errorMsg = 'No se encontró ninguna cámara en el dispositivo.'
      } else if (err.name === 'NotReadableError') {
        errorMsg = 'La cámara está siendo usada por otra aplicación. Cierra otras apps que usen la cámara.'
      } else if (err.name === 'OverconstrainedError') {
        errorMsg = 'La cámara no soporta las configuraciones requeridas.'
      } else if (err.toString().includes('getUserMedia')) {
        errorMsg = 'Error al acceder a la cámara. Verifica los permisos del navegador.'
      }
      
      setError(errorMsg)
      onError?.(errorMsg)
      setIsScanning(false)
    }
  }

  const handleStart = async () => {
    await startScanner()
  }

  const handleStop = async () => {
    await stopScanner()
    onClose?.()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={handleStop}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="relative">
        <div
          id="barcode-reader"
          className="w-full rounded-lg overflow-hidden bg-black"
          style={{ minHeight: '300px' }}
        />
        {!isScanning && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-lg">
            <div className="text-center space-y-2">
              <Camera className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Presiona "Iniciar Escaneo" para activar la cámara
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {!isScanning ? (
          <Button onClick={handleStart} className="flex-1">
            <Camera className="h-4 w-4 mr-2" />
            Iniciar Escaneo
          </Button>
        ) : (
          <Button onClick={handleStop} variant="destructive" className="flex-1">
            Detener Escaneo
          </Button>
        )}
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        <p>• Asegúrate de tener buena iluminación</p>
        <p>• Mantén el código de barras estable frente a la cámara</p>
        <p>• Funciona con códigos EAN-13, EAN-8, CODE-128, CODE-39, UPC-A, UPC-E</p>
        {error && error.includes('permiso') && (
          <p className="text-yellow-600 dark:text-yellow-400 font-medium mt-2">
            💡 En Android: Ve a Configuración → Aplicaciones → Chrome → Permisos → Cámara → Permitir
          </p>
        )}
      </div>
    </div>
  )
}
