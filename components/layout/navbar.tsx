'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Shirt, Sun, Moon, LogOut, Settings, Package, Sparkles, List, Home } from 'lucide-react'

export function Navbar() {
  const { theme, setTheme } = useTheme()
  const { userProfile, signOut } = useAuth()

  // Log de diagnóstico
  useEffect(() => {
    if (userProfile) {
      console.log('🔍 [Navbar] userProfile:', {
        id: userProfile.id,
        email: userProfile.email,
        role: userProfile.role,
        full_name: userProfile.full_name
      })
      console.log('🔍 [Navbar] ¿Es admin?', userProfile.role === 'admin')
    } else {
      console.log('🔍 [Navbar] No hay userProfile')
    }
  }, [userProfile])

  const handleLogout = async () => {
    await signOut()
  }

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center px-4">
        <Link href="/" className="flex items-center space-x-2">
          <Shirt className="h-6 w-6" />
          <span className="font-bold text-xl">Clozen</span>
        </Link>

        <div className="flex flex-1 items-center justify-end space-x-4">
          {/* Botón Home - Visible siempre */}
          <Link href="/">
            <Button variant="ghost" size="sm">
              <Home className="h-4 w-4 mr-2" />
              Home
            </Button>
          </Link>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Cambiar tema</span>
          </Button>

          {/* Navigation Links - Show when authenticated */}
          {userProfile && (
            <div className="flex items-center space-x-2">
              {/* Barra de navegación principal - siempre visible para usuarios autenticados */}
              <Link href="/closet">
                <Button variant="ghost" size="sm">
                  <Shirt className="h-4 w-4 mr-2" />
                  Mi Closet
                </Button>
              </Link>
              <Link href="/closet/recommendations">
                <Button variant="ghost" size="sm">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Recomendaciones
                </Button>
              </Link>

              {/* Barra de administración - solo visible para admins */}
              {userProfile.role === 'admin' && (
                <>
                  <Link href="/admin/organize">
                    <Button variant="outline" size="sm">
                      <Package className="h-4 w-4 mr-2" />
                      Organizar
                    </Button>
                  </Link>
                  <Link href="/admin/in-use">
                    <Button variant="outline" size="sm">
                      <List className="h-4 w-4 mr-2" />
                      En Uso
                    </Button>
                  </Link>
                  <Link href="/admin/boxes">
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4 mr-2" />
                      Cajas
                    </Button>
                  </Link>
                </>
              )}
            </div>
          )}

          {/* Auth Buttons */}
          <div className="flex items-center space-x-2">
            {userProfile ? (
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Cerrar sesión
              </Button>
            ) : (
              <>
                <Link href="/auth/login">
                  <Button variant="ghost" size="sm">
                    Iniciar sesión
                  </Button>
                </Link>
                <Link href="/auth/register">
                  <Button size="sm">
                    Registrarse
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
