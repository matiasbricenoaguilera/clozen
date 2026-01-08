'use client'

import { useState, useEffect, useCallback } from 'react'
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { User as UserType } from '@/types'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [userProfile, setUserProfile] = useState<UserType | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUserProfile = useCallback(async (userId: string) => {
    console.log('🔍 [useAuth] Obteniendo perfil para usuario:', userId)
    
    // Timeout de 10 segundos para evitar que se quede colgado
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout al obtener perfil')), 10000)
    })

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
        }
        
        setUserProfile(null)
      } else {
        console.log('✅ [useAuth] Perfil obtenido:', {
          id: data.id,
          email: data.email,
          role: data.role,
          full_name: data.full_name
        })
        setUserProfile(data)
      }
    } catch (error) {
      console.error('❌ [useAuth] Excepción al obtener perfil:', error)
      if (error instanceof Error && error.message === 'Timeout al obtener perfil') {
        console.error('⏱️ [useAuth] Timeout: La consulta tardó más de 10 segundos. Verifica RLS y conexión.')
      }
      setUserProfile(null)
    } finally {
      // SIEMPRE establecer loading en false, incluso si hay errores
      console.log('✅ [useAuth] Finalizando carga de perfil, estableciendo loading=false')
      setLoading(false)
    }
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
        if (session?.user) {
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
        console.log('🔄 [useAuth] Auth state changed:', event)
        setSession(session)
        setUser(session?.user ?? null)

        if (session?.user) {
          await fetchUserProfile(session.user.id)
        } else {
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
