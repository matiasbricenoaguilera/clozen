'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Upload, Image as ImageIcon, Loader2, X, CheckCircle, AlertCircle, Shirt } from 'lucide-react'
import type { SimilarOutfit, PinterestOutfitAnalysis, Garment } from '@/types'
import Image from 'next/image'

interface PinterestOutfitAnalyzerProps {
  userId: string
  onOutfitSelect?: (outfit: Garment[]) => void
}

export function PinterestOutfitAnalyzer({ userId, onOutfitSelect }: PinterestOutfitAnalyzerProps) {
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState<string>('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<PinterestOutfitAnalysis | null>(null)
  const [similarOutfits, setSimilarOutfits] = useState<SimilarOutfit[]>([])
  const [error, setError] = useState<string>('')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Por favor selecciona un archivo de imagen')
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('La imagen debe ser menor a 10MB')
        return
      }
      setImageFile(file)
      setImageUrl('')
      setPreviewUrl(URL.createObjectURL(file))
      setError('')
      setAnalysis(null)
      setSimilarOutfits([])
    }
  }

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value
    setImageUrl(url)
    if (url) {
      setImageFile(null)
      setPreviewUrl(url)
      setError('')
      setAnalysis(null)
      setSimilarOutfits([])
    }
  }

  const handleAnalyze = async () => {
    if (!imageFile && !imageUrl) {
      setError('Por favor selecciona una imagen o ingresa una URL')
      return
    }

    setAnalyzing(true)
    setError('')
    setAnalysis(null)
    setSimilarOutfits([])

    try {
      const formData = new FormData()
      if (imageFile) {
        formData.append('image', imageFile)
      } else if (imageUrl) {
        formData.append('imageUrl', imageUrl)
      }
      formData.append('userId', userId)

      const response = await fetch('/api/analyze-pinterest-outfit', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Error al analizar la imagen')
      }

      // ✅ LOGS DETALLADOS EN CLIENTE (consola del navegador F12)
      console.log('🔍 ===== ANÁLISIS DE IMAGEN PINTEREST =====')
      console.log('📸 Análisis recibido:', {
        detectedGarments: data.analysis.detectedGarments,
        dominantColors: data.analysis.dominantColors,
        style: data.analysis.style,
        labels: data.analysis.labels?.slice(0, 10)
      })
      
      if (data.analysis.detectedGarments.length > 0) {
        console.log('👕 Prendas detectadas en la imagen:')
        data.analysis.detectedGarments.forEach((garment: any, idx: number) => {
          console.log(`   ${idx + 1}. ${garment.type} (${Math.round(garment.confidence * 100)}% confianza)`)
        })
      } else {
        console.log('⚠️ No se detectaron prendas específicas en la imagen')
        console.log('   Labels encontrados:', data.analysis.labels?.slice(0, 10))
      }
      
      if (data.analysis.dominantColors.length > 0) {
        console.log('🎨 Colores dominantes:', data.analysis.dominantColors)
      }
      
      // Mostrar información de debug si está disponible
      if (data.debug) {
        console.log('🔧 DEBUG Info:')
        console.log(`   Total prendas en closet: ${data.debug.totalGarments}`)
        console.log(`   Tipos en closet: ${data.debug.garmentTypes.join(', ')}`)
        console.log(`   Tipos detectados: ${data.debug.detectedTypes.join(', ')}`)
        
        // Verificar si hay coincidencias de tipos
        const matchingTypes = data.debug.detectedTypes.filter((detectedType: string) => 
          data.debug.garmentTypes.some((closetType: string) => 
            closetType.toLowerCase().includes(detectedType.toLowerCase()) ||
            detectedType.toLowerCase().includes(closetType.toLowerCase())
          )
        )
        
        if (matchingTypes.length > 0) {
          console.log(`   ✅ Tipos que coinciden: ${matchingTypes.join(', ')}`)
        } else {
          console.log(`   ❌ Ningún tipo detectado coincide con los tipos en tu closet`)
          console.log(`   Esto explica por qué no se encontraron outfits similares`)
        }
      }
      
      console.log('✅ Outfits similares encontrados:', data.similarOutfits.length)
      if (data.similarOutfits.length > 0) {
        data.similarOutfits.forEach((outfit: any, idx: number) => {
          console.log(`   ${idx + 1}. Score: ${Math.round(outfit.similarityScore)}% - ${outfit.reasoning}`)
          console.log(`      Prendas: ${outfit.garments.map((g: any) => `${g.name} (${g.type})`).join(', ')}`)
        })
      } else {
        console.log('❌ No se encontraron outfits similares')
        console.log('   Posibles razones:')
        console.log('   - Tipos detectados:', data.analysis.detectedGarments.map((g: any) => g.type))
        console.log('   - Revisa la consola del servidor para más detalles')
      }
      console.log('==========================================')

      setAnalysis(data.analysis)
      setSimilarOutfits(data.similarOutfits || [])

      if (data.similarOutfits.length === 0) {
        setError('No se encontraron outfits similares en tu closet')
      }
    } catch (err: any) {
      console.error('Error analizando imagen:', err)
      setError(err.message || 'Error al analizar la imagen. Asegúrate de que GOOGLE_VISION_API_KEY esté configurada.')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleClear = () => {
    setImageFile(null)
    setImageUrl('')
    setPreviewUrl(null)
    setAnalysis(null)
    setSimilarOutfits([])
    setError('')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          Buscar Outfits Similares de Pinterest
        </CardTitle>
        <CardDescription>
          Sube una imagen de Pinterest o ingresa una URL para encontrar outfits similares en tu closet
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input de archivo */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Subir imagen</label>
          <div className="flex gap-2">
            <Input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="flex-1"
              disabled={analyzing}
            />
            {previewUrl && (
              <Button
                variant="outline"
                size="icon"
                onClick={handleClear}
                disabled={analyzing}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Input de URL */}
        <div className="space-y-2">
          <label className="text-sm font-medium">O ingresa URL de imagen</label>
          <Input
            type="url"
            placeholder="https://..."
            value={imageUrl}
            onChange={handleUrlChange}
            disabled={analyzing || !!imageFile}
          />
        </div>

        {/* Preview de imagen */}
        {previewUrl && (
          <div className="relative w-full h-48 rounded-lg overflow-hidden border">
            <Image
              src={previewUrl}
              alt="Preview"
              fill
              className="object-contain"
              unoptimized
            />
          </div>
        )}

        {/* Botón analizar */}
        <Button
          onClick={handleAnalyze}
          disabled={analyzing || (!imageFile && !imageUrl)}
          className="w-full"
          size="lg"
        >
          {analyzing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analizando...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Analizar Imagen
            </>
          )}
        </Button>

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Resultados del análisis */}
        {analysis && (
          <div className="space-y-4 border-t pt-4">
            <div>
              <h3 className="font-semibold mb-2">Análisis de la imagen:</h3>
              <div className="space-y-2">
                {analysis.detectedGarments.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Prendas detectadas:</p>
                    <div className="flex flex-wrap gap-2">
                      {analysis.detectedGarments.map((garment, idx) => (
                        <Badge key={idx} variant="secondary">
                          {garment.type} ({Math.round(garment.confidence * 100)}%)
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {analysis.dominantColors.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Colores dominantes:</p>
                    <div className="flex flex-wrap gap-2">
                      {analysis.dominantColors.map((color, idx) => (
                        <div
                          key={idx}
                          className="w-8 h-8 rounded-full border-2 border-gray-300"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {analysis.style.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Estilo:</p>
                    <div className="flex flex-wrap gap-2">
                      {analysis.style.map((style, idx) => (
                        <Badge key={idx} variant="outline">
                          {style}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Outfits similares */}
        {similarOutfits.length > 0 && (
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold">Outfits similares encontrados:</h3>
            <div className="space-y-3">
              {similarOutfits.map((outfit, idx) => (
                <Card key={idx} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium mb-1">
                        Similitud: {Math.round(outfit.similarityScore)}%
                      </p>
                      <p className="text-xs text-muted-foreground">{outfit.reasoning}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onOutfitSelect?.(outfit.garments)}
                    >
                      Usar
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                    {outfit.garments.map((garment) => (
                      <div
                        key={garment.id}
                        className="flex flex-col items-center p-2 border rounded-lg"
                      >
                        {garment.image_url ? (
                          <div className="relative w-full h-20 rounded overflow-hidden mb-1">
                            <Image
                              src={garment.image_url}
                              alt={garment.name}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <div className="w-full h-20 bg-muted rounded flex items-center justify-center mb-1">
                            <Shirt className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <p className="text-xs text-center font-medium truncate w-full">
                          {garment.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{garment.type}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {analysis && similarOutfits.length === 0 && !error && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No se encontraron outfits similares en tu closet. Intenta con otra imagen o agrega más prendas a tu closet.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
