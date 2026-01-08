'use client'

import { useState, useEffect } from 'react'
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { User as UserType } from '@/types'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [userProfile, setUserProfile] = useState<UserType | null>(null)
  const [loading, setLoading] = useState(true)

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
  }, [])

  const fetchUserProfile = async (userId: string) => {
    try {
      console.log('🔍 [useAuth] Obteniendo perfil para usuario:', userId)
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.warn('❌ [useAuth] Error fetching user profile:', error)
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
      console.warn('❌ [useAuth] Error fetching user profile:', error)
      setUserProfile(null)
    } finally {
      setLoading(false)
    }
  }

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
        console.log('✅ [useAuth] signIn: Login exitoso')
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
