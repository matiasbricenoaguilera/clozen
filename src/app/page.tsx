'use client'

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SupabaseWarning } from "@/components/ui/supabase-warning";
import { Shirt, Smartphone, Zap, Cloud } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">

      {!isSupabaseConfigured && (
        <div className="container mx-auto px-4 py-4">
          <SupabaseWarning />
        </div>
      )}

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-6xl">
            Tu Closet Digital
            <span className="text-primary"> Inteligente</span>
          </h1>
          <p className="mb-8 text-xl text-muted-foreground">
            Organiza tu ropa con NFC, recibe recomendaciones personalizadas basadas en el clima
            y descubre nuevos estilos con IA. Todo desde tu teléfono.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link href="/auth/register">
              <Button size="lg" className="w-full sm:w-auto">
                Comenzar Ahora
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Iniciar Sesión
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 rounded-full bg-primary/10 p-3">
              <Smartphone className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">NFC Integrado</h3>
            <p className="text-muted-foreground">
              Escanea y organiza tus prendas con tags NFC NTAG213
            </p>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="mb-4 rounded-full bg-primary/10 p-3">
              <Zap className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">IA Inteligente</h3>
            <p className="text-muted-foreground">
              Recomendaciones personalizadas basadas en tu estilo y clima
            </p>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="mb-4 rounded-full bg-primary/10 p-3">
              <Cloud className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">Análisis Visual</h3>
            <p className="text-muted-foreground">
              Sube fotos y automáticamente clasifica colores y tipos
            </p>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="mb-4 rounded-full bg-primary/10 p-3">
              <Shirt className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">Organización Total</h3>
            <p className="text-muted-foreground">
              Gestiona cajas, prendas y outfits con rotación inteligente
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-4 text-3xl font-bold">
            ¿Listo para organizar tu closet?
          </h2>
          <p className="mb-8 text-muted-foreground">
            Únete a miles de personas que ya están usando Clozen para mantener su guardarropa organizado y actualizado.
          </p>
          <Link href="/auth/register">
            <Button size="lg">
              Crear Mi Cuenta
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
