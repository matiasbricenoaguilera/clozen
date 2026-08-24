'use client'

import { supabase } from '@/lib/supabase'

/** Margen antes de la expiración: si queda menos, se refresca antes de usarlo */
const MARGEN_MS = 60_000

/**
 * Devuelve un access_token vigente para llamar a las API routes.
 *
 * `getSession()` lee la sesión de localStorage y puede devolver un token ya
 * caducado si la pestaña estuvo inactiva o el refresco automático no llegó a
 * correr. Enviarlo así provoca un 401 del servidor, que al usuario le aparece
 * como "sesión inválida" sin motivo aparente.
 *
 * Devuelve null si no hay sesión utilizable: quien llama decide qué avisar.
 */
export async function getFreshAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  let session = data?.session ?? null

  const caducaPronto =
    session?.expires_at != null &&
    session.expires_at * 1000 < Date.now() + MARGEN_MS

  if (session && caducaPronto) {
    const { data: refrescada, error } = await supabase.auth.refreshSession()
    if (error) {
      console.warn('No se pudo refrescar la sesión:', error.message)
      return null
    }
    session = refrescada?.session ?? null
  }

  return session?.access_token ?? null
}
