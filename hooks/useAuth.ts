'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { User as UserType } from '@/types'

// Caché y deduplicación global para evitar múltiples llamadas simultáneas
const fetchingProfiles = new Map<string, Promise<UserType | null>>()
const profileCache = new Map<string, { profile: UserType; timestamp: number }>()

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [userProfile, setUserProfile] = useState<UserType | null>(null)
  const [loading, setLoading] = useState(true)
  const sessionProcessedRef = useRef(false)

  const fetchUserProfile = useCallback(async (userId: string, retryCount = 0): Promise<UserType | null> => {
    // ✅ CACHÉ: Si el perfil está en caché y es reciente (< 5 min), usarlo
    const cached = profileCache.get(userId)
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      console.log('✅ [useAuth] Usando perfil desde caché')
      setUserProfile(cached.profile)
      setLoading(false)
      return cached.profile
    }

    // ✅ DEDUPLICACIÓN: Si ya hay una llamada en curso para este usuario, esperarla
    if (fetchingProfiles.has(userId) && retryCount === 0) {
      console.log('⏳ [useAuth] Ya hay una llamada en curso para este usuario, esperando...')
      const existingPromise = fetchingProfiles.get(userId)!
      try {
        const result = await existingPromise
        return result
      } catch {
        // Si falla la llamada existente, continuar con nueva llamada
      }
    }

    console.log('🔍 [useAuth] Obteniendo perfil para usuario:', userId, retryCount > 0 ? `(reintento ${retryCount})` : '')
    
    // Timeout reducido a 10 segundos (más razonable, con retries si falla)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout al obtener perfil')), 10000)
    })

    // Crear la promesa y guardarla para deduplicación
    const profilePromise = (async () => {
    try {
      const queryPromise = supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      const { data, error } = await Promise.race([queryPromise, timeoutPromise])

      if (error) {
        console.warn('❌ [useAuth] Error fetching user profile:', error)
        console.warn('❌ [useAuth] Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        })
        
        // Si el usuario no existe en la tabla users, podría ser un problema de RLS
        // o el usuario no fue creado correctamente durante el registro
        if (error.code === 'PGRST116') {
          console.warn('⚠️ [useAuth] Usuario no encontrado en tabla users. Esto puede indicar un problema con el registro.')
            setUserProfile(null)
            setLoading(false)
            return null
          } else if (retryCount < 2) {
            // Reintentar hasta 2 veces con backoff exponencial
            const delay = Math.pow(2, retryCount) * 1000 // 1s, 2s
            console.log(`🔄 [useAuth] Reintentando en ${delay}ms...`)
            await new Promise(resolve => setTimeout(resolve, delay))
            return fetchUserProfile(userId, retryCount + 1)
          } else {
            // Después de 3 intentos, mantener el perfil anterior si existe
            console.warn('⚠️ [useAuth] No se pudo obtener el perfil después de varios intentos. Manteniendo sesión activa.')
            setLoading(false)
            return null
          }
      } else {
        console.log('✅ [useAuth] Perfil obtenido:', {
          id: data.id,
          email: data.email,
          role: data.role,
          full_name: data.full_name
        })
          
          // ✅ GUARDAR EN CACHÉ
          if (data) {
            profileCache.set(userId, { profile: data, timestamp: Date.now() })
          }
          
        setUserProfile(data)
          setLoading(false)
          return data
      }
    } catch (error) {
      console.error('❌ [useAuth] Excepción al obtener perfil:', error)
      if (error instanceof Error && error.message === 'Timeout al obtener perfil') {
          console.error('⏱️ [useAuth] Timeout: La consulta tardó más de 10 segundos.')
          
          if (retryCount < 2) {
            // Reintentar con backoff exponencial
            const delay = Math.pow(2, retryCount) * 1000 // 1s, 2s
            console.log(`🔄 [useAuth] Reintentando después de timeout en ${delay}ms...`)
            await new Promise(resolve => setTimeout(resolve, delay))
            return fetchUserProfile(userId, retryCount + 1)
          } else {
            console.warn('⚠️ [useAuth] Timeout después de varios intentos. Manteniendo sesión activa si existe.')
            setLoading(false)
            return null
          }
        } else {
          // Para otros errores, mantener el perfil anterior si hay sesión activa
          console.warn('⚠️ [useAuth] Error desconocido al obtener perfil. Manteniendo sesión activa.')
          setLoading(false)
          return null
        }
      } finally {
        // ✅ LIMPIAR: Eliminar de fetchingProfiles después de completar (solo si es la llamada original)
        if (retryCount === 0) {
          fetchingProfiles.delete(userId)
        }
      }
    })()

    // ✅ GUARDAR PROMESA PARA DEDUPLICACIÓN (solo si es la llamada original)
    if (retryCount === 0) {
      fetchingProfiles.set(userId, profilePromise)
    }

    return profilePromise
  }, [])

  useEffect(() => {
    // Si Supabase no está configurado, marcar como no cargando
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    // Obtener sesión inicial
    supabase.auth.getSession()
      .then(({ data: { session } }: { data: { session: Session | null } }) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user && !sessionProcessedRef.current) {
          sessionProcessedRef.current = true
          fetchUserProfile(session.user.id)
        } else {
          setLoading(false)
        }
      })
      .catch((error: unknown) => {
        console.warn('Supabase auth error:', error)
        setLoading(false)
      })

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        // ✅ IGNORAR INITIAL_SESSION si ya procesamos la sesión inicial
        if (event === 'INITIAL_SESSION' && sessionProcessedRef.current) {
          console.log('⏭️ [useAuth] Ignorando INITIAL_SESSION duplicado')
          return
        }

        console.log('🔄 [useAuth] Auth state changed:', event)
        setSession(session)
        setUser(session?.user ?? null)

        if (session?.user) {
          // Si es SIGNED_IN o TOKEN_REFRESHED, actualizar el flag
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            sessionProcessedRef.current = true
          }
          await fetchUserProfile(session.user.id)
        } else {
          // Si es SIGNED_OUT, resetear el flag y limpiar caché
          if (event === 'SIGNED_OUT') {
            sessionProcessedRef.current = false
            profileCache.clear()
          }
          setUserProfile(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [fetchUserProfile])

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      console.error('❌ [useAuth] signIn: Supabase no está configurado')
      return { data: null, error: { message: 'Supabase no está configurado. Ve a CONFIGURACION.md para instrucciones.' } }
    }
    
    console.log('🔍 [useAuth] signIn: Intentando iniciar sesión para:', email)
    console.log('🔍 [useAuth] signIn: Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
    console.log('🔍 [useAuth] signIn: Supabase cliente:', supabase ? '✅ Creado' : '❌ No creado')
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error) {
        console.error('❌ [useAuth] signIn: Error de autenticación:', error)
      } else {
        console.log('✅ [useAuth] signIn: Login exitoso, usuario:', data.user?.id)
        // El onAuthStateChange se encargará de obtener el perfil
      }
      
      return { data, error }
    } catch (err) {
      console.error('❌ [useAuth] signIn: Excepción capturada:', err)
      return { data: null, error: { message: `Error de conexión: ${err instanceof Error ? err.message : 'Desconocido'}` } }
    }
  }

  const signUp = async (email: string, password: string, fullName: string) => {
    if (!isSupabaseConfigured) {
      return { data: null, error: { message: 'Supabase no está configurado. Ve a CONFIGURACION.md para instrucciones.' } }
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })
    return { data, error }
  }

  const signOut = async () => {
    if (!isSupabaseConfigured) {
      return { error: null }
    }
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  const updateProfile = async (updates: Partial<UserType>) => {
    if (!user) return { error: new Error('No user logged in') }

    const { data, error } = await supabase
      .from('users')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .single()

    if (!error && data) {
      setUserProfile(data)
    }

    return { data, error }
  }

  return {
    user,
    session,
    userProfile,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
  }
}
