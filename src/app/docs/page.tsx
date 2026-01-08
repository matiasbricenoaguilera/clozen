import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings, Database, Zap, Smartphone } from "lucide-react";

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-background">

      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al inicio
            </Button>
          </Link>

          <h1 className="text-3xl font-bold mb-2">📚 Documentación de Clozen</h1>
          <p className="text-muted-foreground">
            Guía completa para configurar y usar Clozen
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Configuración Básica */}
          <div className="border rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Settings className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-semibold">Configuración Básica</h2>
            </div>
            <p className="text-muted-foreground mb-4">
              Cómo configurar Supabase y las variables de entorno necesarias.
            </p>
            <div className="space-y-2">
              <Link href="#supabase-setup">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  🗄️ Configurar Supabase
                </Button>
              </Link>
              <Link href="#env-variables">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  🔧 Variables de Entorno
                </Button>
              </Link>
              <Link href="#database-schema">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  📊 Esquema de Base de Datos
                </Button>
              </Link>
            </div>
          </div>

          {/* APIs Externas */}
          <div className="border rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Zap className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-semibold">APIs Externas</h2>
            </div>
            <p className="text-muted-foreground mb-4">
              Configuración de servicios externos para funcionalidades avanzadas.
            </p>
            <div className="space-y-2">
              <Link href="#google-vision">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  🤖 Google Vision API
                </Button>
              </Link>
              <Link href="#openai">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  🧠 OpenAI GPT
                </Button>
              </Link>
              <Link href="#openweather">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  🌤️ OpenWeatherMap
                </Button>
              </Link>
            </div>
          </div>

          {/* NFC */}
          <div className="border rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Smartphone className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-semibold">Sistema NFC</h2>
            </div>
            <p className="text-muted-foreground mb-4">
              Cómo usar los tags NFC NTAG213 para organizar tu closet.
            </p>
            <div className="space-y-2">
              <Link href="#nfc-basics">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  📱 Conceptos Básicos NFC
                </Button>
              </Link>
              <Link href="#nfc-setup">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  ⚙️ Configuración NFC
                </Button>
              </Link>
              <Link href="#nfc-usage">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  🎯 Uso del NFC
                </Button>
              </Link>
            </div>
          </div>

          {/* Solución de Problemas */}
          <div className="border rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Database className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-semibold">Solución de Problemas</h2>
            </div>
            <p className="text-muted-foreground mb-4">
              Resolución de problemas comunes y errores frecuentes.
            </p>
            <div className="space-y-2">
              <Link href="#auth-errors">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  🔐 Errores de Autenticación
                </Button>
              </Link>
              <Link href="#network-errors">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  🌐 Errores de Red
                </Button>
              </Link>
              <Link href="#admin-setup">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  👑 Configurar Admin
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Archivos de Configuración */}
        <div className="mt-8 border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">📁 Archivos de Configuración</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="border rounded p-4">
              <h3 className="font-medium mb-2">CONFIGURACION.md</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Guía completa de configuración paso a paso.
              </p>
              <Button size="sm" variant="outline">
                Ver Archivo
              </Button>
            </div>
            <div className="border rounded p-4">
              <h3 className="font-medium mb-2">CREAR_ADMIN_README.md</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Cómo crear y configurar cuenta de administrador.
              </p>
              <Button size="sm" variant="outline">
                Ver Archivo
              </Button>
            </div>
            <div className="border rounded p-4">
              <h3 className="font-medium mb-2">supabase-schema.sql</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Esquema completo de la base de datos.
              </p>
              <Button size="sm" variant="outline">
                Ver Archivo
              </Button>
            </div>
          </div>
        </div>

        {/* Enlaces Rápidos */}
        <div className="mt-8 text-center">
          <p className="text-muted-foreground mb-4">
            ¿Necesitas ayuda específica? Estos enlaces pueden ser útiles:
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Link href="https://supabase.com" target="_blank">
              <Button variant="outline">
                🗄️ Supabase
              </Button>
            </Link>
            <Link href="https://console.cloud.google.com" target="_blank">
              <Button variant="outline">
                🤖 Google Cloud
              </Button>
            </Link>
            <Link href="https://platform.openai.com" target="_blank">
              <Button variant="outline">
                🧠 OpenAI
              </Button>
            </Link>
            <Link href="https://openweathermap.org" target="_blank">
              <Button variant="outline">
                🌤️ OpenWeatherMap
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}



