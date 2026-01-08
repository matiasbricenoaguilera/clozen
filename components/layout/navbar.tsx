'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Shirt, Sun, Moon, LogOut, Settings, Package, Sparkles, List, Home, Menu, X } from 'lucide-react'

export function Navbar() {
  const { theme, setTheme } = useTheme()
  const { userProfile, signOut } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
    setMobileMenuOpen(false)
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center px-4">
        <Link href="/" className="flex items-center space-x-2 flex-shrink-0">
          <Shirt className="h-6 w-6" />
          <span className="font-bold text-xl hidden sm:inline">Clozen</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex flex-1 items-center justify-end space-x-2">
          {/* Botón Home - Visible siempre */}
          <Link href="/">
            <Button variant="ghost" size="sm" className="hidden lg:flex">
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
            <div className="flex items-center space-x-1">
              {/* Barra de navegación principal - siempre visible para usuarios autenticados */}
              <Link href="/closet">
                <Button variant="ghost" size="sm" className="hidden lg:flex">
                  <Shirt className="h-4 w-4 mr-2" />
                  Mi Closet
                </Button>
              </Link>
              <Link href="/closet/recommendations">
                <Button variant="ghost" size="sm" className="hidden lg:flex">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Recomendaciones
                </Button>
              </Link>

              {/* Barra de administración - solo visible para admins */}
              {userProfile.role === 'admin' && (
                <>
                  <Link href="/admin/organize">
                    <Button variant="outline" size="sm" className="hidden xl:flex">
                      <Package className="h-4 w-4 mr-2" />
                      Organizar
                    </Button>
                  </Link>
                  <Link href="/admin/in-use">
                    <Button variant="outline" size="sm" className="hidden xl:flex">
                      <List className="h-4 w-4 mr-2" />
                      En Uso
                    </Button>
                  </Link>
                  <Link href="/admin/boxes">
                    <Button variant="outline" size="sm" className="hidden xl:flex">
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
              <Button variant="ghost" size="sm" onClick={handleLogout} className="hidden lg:flex">
                <LogOut className="h-4 w-4 mr-2" />
                Cerrar sesión
              </Button>
            ) : (
              <>
                <Link href="/auth/login">
                  <Button variant="ghost" size="sm" className="hidden lg:flex">
                    Iniciar sesión
                  </Button>
                </Link>
                <Link href="/auth/register">
                  <Button size="sm" className="hidden lg:flex">
                    Registrarse
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Mobile Menu Button */}
        <div className="flex md:hidden flex-1 items-center justify-end space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="mr-2"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Cambiar tema</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t bg-background">
          <div className="container px-4 py-4 space-y-2">
            <Link href="/" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="ghost" className="w-full justify-start">
                <Home className="h-4 w-4 mr-2" />
                Home
              </Button>
            </Link>

            {userProfile && (
              <>
                <Link href="/closet" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start">
                    <Shirt className="h-4 w-4 mr-2" />
                    Mi Closet
                  </Button>
                </Link>
                <Link href="/closet/recommendations" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Recomendaciones
                  </Button>
                </Link>

                {userProfile.role === 'admin' && (
                  <>
                    <Link href="/admin/organize" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="outline" className="w-full justify-start">
                        <Package className="h-4 w-4 mr-2" />
                        Organizar
                      </Button>
                    </Link>
                    <Link href="/admin/in-use" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="outline" className="w-full justify-start">
                        <List className="h-4 w-4 mr-2" />
                        En Uso
                      </Button>
                    </Link>
                    <Link href="/admin/boxes" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="outline" className="w-full justify-start">
                        <Settings className="h-4 w-4 mr-2" />
                        Cajas
                      </Button>
                    </Link>
                  </>
                )}

                <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Cerrar sesión
                </Button>
              </>
            )}

            {!userProfile && (
              <>
                <Link href="/auth/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start">
                    Iniciar sesión
                  </Button>
                </Link>
                <Link href="/auth/register" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full justify-start">
                    Registrarse
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
