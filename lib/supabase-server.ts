import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export interface AuthenticatedContext {
  supabase: SupabaseClient
  user: User
}

export interface AuthError {
  error: string
  status: 401 | 500
}

/**
 * Autentica una petición a una API route usando el header
 * `Authorization: Bearer <access_token>` que envía el cliente.
 *
 * Devuelve un cliente de Supabase que actúa EN NOMBRE del usuario, por lo
 * que todas las consultas siguen pasando por RLS. Nunca uses el userId que
 * venga en el body/formData: usa siempre `user.id` de esta función.
 *
 * La sesión de Supabase vive en localStorage (no en cookies), así que el
 * servidor no puede leerla solo: el cliente debe mandar el token.
 */
export async function authenticateRequest(
  request: Request
): Promise<AuthenticatedContext | AuthError> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return { error: 'Supabase no está configurado en el servidor', status: 500 }
  }

  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : ''

  if (!token) {
    return { error: 'No autenticado: falta el token de sesión', status: 401 }
  }

  // Cliente por petición: sin persistencia y con el token del usuario,
  // de modo que auth.uid() sea correcto dentro de las políticas RLS.
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: {
      headers: { Authorization: `Bearer ${token}` }
    }
  })

  // Valida la firma y la expiración del token contra el servidor de Auth.
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data?.user) {
    return { error: 'Sesión inválida o expirada', status: 401 }
  }

  return { supabase, user: data.user }
}

export function isAuthError(
  result: AuthenticatedContext | AuthError
): result is AuthError {
  return 'error' in result
}
