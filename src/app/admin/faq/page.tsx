'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, AlertCircle, HelpCircle, Tag, Smartphone } from 'lucide-react'

export default function AdminFAQPage() {
  return (
    <div className="space-y-6 pb-16">
      <div>
        <h1 className="text-3xl font-bold">Preguntas Frecuentes (FAQ)</h1>
        <p className="text-muted-foreground mt-2">
          Respuestas a las preguntas más comunes sobre el uso del sistema NFC
        </p>
      </div>

      {/* Tags NFC Duplicados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            ¿Qué pasa si dos tags NFC tienen el mismo código?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Problema</AlertTitle>
            <AlertDescription>
              Algunos tags NFC económicos pueden tener serial numbers duplicados.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <p className="font-medium">Solución:</p>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Ve a <Badge variant="outline">Admin → Gestionar Tags</Badge></li>
              <li>Click en <Badge>Escribir nuevo ID</Badge></li>
              <li>Escanea el tag que quieres diferenciar</li>
              <li>El sistema generará un UUID único automáticamente</li>
              <li>Mantén el tag quieto hasta ver ✅ "Tag NFC escrito exitosamente"</li>
            </ol>
          </div>

          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Priorización del sistema</AlertTitle>
            <AlertDescription>
              El sistema siempre prioriza <strong>UTF-8</strong> sobre serial number.
              Si escribes un UUID único, el serial duplicado será ignorado.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Compatibilidad */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            ¿En qué dispositivos funciona NFC?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="font-medium text-green-600 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                ✅ Compatible
              </p>
              <ul className="text-sm space-y-1 list-disc list-inside">
                <li>Chrome en Android 10+</li>
                <li>Tags NTAG213, NTAG215, NTAG216</li>
                <li>Tags NFC Forum Type 2</li>
              </ul>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-red-600 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                ❌ No compatible
              </p>
              <ul className="text-sm space-y-1 list-disc list-inside">
                <li>iPhone/iOS</li>
                <li>Firefox, Safari, Edge</li>
                <li>Tags con protección de escritura</li>
                <li>Tags Mifare Classic</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error al escribir */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            ¿Por qué falla la escritura de tags?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <p className="font-medium text-sm">1. Tag en movimiento</p>
              <p className="text-sm text-muted-foreground">
                Mantén el tag completamente quieto durante 3 segundos mientras se escribe.
              </p>
            </div>
            <div>
              <p className="font-medium text-sm">2. Tag de solo lectura</p>
              <p className="text-sm text-muted-foreground">
                Algunos tags tienen protección de escritura activada. Verifica con otra app NFC.
              </p>
            </div>
            <div>
              <p className="font-medium text-sm">3. NFC desactivado</p>
              <p className="text-sm text-muted-foreground">
                Verifica que NFC esté activado en Configuración → Conexiones → NFC.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Más preguntas */}
      <Card>
        <CardHeader>
          <CardTitle>Otras preguntas frecuentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <details className="group">
            <summary className="font-medium cursor-pointer hover:text-primary">
              ¿Puedo usar tags sin escribir UUID?
            </summary>
            <p className="text-sm text-muted-foreground mt-2">
              Sí, si el serial number es único. El sistema funciona con ambos formatos.
            </p>
          </details>

          <details className="group">
            <summary className="font-medium cursor-pointer hover:text-primary">
              ¿Qué pasa si borro accidentalmente el UUID?
            </summary>
            <p className="text-sm text-muted-foreground mt-2">
              Puedes escribir uno nuevo en cualquier momento desde Admin → Gestionar Tags → Escribir nuevo ID.
            </p>
          </details>

          <details className="group">
            <summary className="font-medium cursor-pointer hover:text-primary">
              ¿El UUID se borra si escaneo el tag muchas veces?
            </summary>
            <p className="text-sm text-muted-foreground mt-2">
              No. El UUID queda grabado permanentemente hasta que lo sobrescribas.
            </p>
          </details>

          <details className="group">
            <summary className="font-medium cursor-pointer hover:text-primary">
              ¿Funciona con códigos de barras duplicados?
            </summary>
            <p className="text-sm text-muted-foreground mt-2">
              No. Los códigos de barras son solo lectura. Para códigos duplicados, necesitas reimprimir etiquetas con códigos únicos.
            </p>
          </details>
        </CardContent>
      </Card>
    </div>
  )
}
