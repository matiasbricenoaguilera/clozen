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
      
      // Crear instancia del escáner
      const html5QrCode = new Html5Qrcode('barcode-reader')
      scannerRef.current = html5QrCode

      // Obtener lista de cámaras disponibles
      const devices = await Html5Qrcode.getCameras()
      
      if (devices.length === 0) {
        throw new Error('No se encontraron cámaras disponibles')
      }

      // Usar la cámara trasera si está disponible, sino la primera
      const backCamera = devices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear') ||
        device.label.toLowerCase().includes('environment')
      )
      
      const selectedCamera = backCamera || devices[0]
      setCameraId(selectedCamera.id)

      // Configuración para códigos de barras
      const config = {
        fps: 10,
        qrbox: { width: 300, height: 300 },
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

      // Iniciar escaneo
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

      setIsScanning(true)
    } catch (err: any) {
      console.error('Error starting barcode scanner:', err)
      const errorMsg = err.message || 'Error al iniciar el escáner de códigos de barras'
      setError(errorMsg)
      onError?.(errorMsg)
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
      </div>
    </div>
  )
}
