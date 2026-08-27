import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Debug en desarrollo para verificar variables de entorno
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('🔍 Supabase Config Check:', {
    url: supabaseUrl ? '✅ Configurada' : '❌ No configurada',
    key: supabaseAnonKey ? '✅ Configurada' : '❌ No configurada',
    urlPreview: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'N/A',
    fullUrl: supabaseUrl || 'NO CONFIGURADA',
    urlStartsWithHttp: supabaseUrl.startsWith('http'),
    isConfigured: !!(supabaseUrl && supabaseAnonKey)
  })
  
  // Advertencia si la URL no empieza con http
  if (supabaseUrl && !supabaseUrl.startsWith('http')) {
    console.error('❌ ERROR: La URL de Supabase debe empezar con https://')
    console.error('URL actual:', supabaseUrl)
  }
}

// Respuesta única del modo demo
const RESPUESTA_DEMO = { data: null, error: { message: 'Supabase no configurado' }, count: null }

/**
 * Constructor de queries de mentira para el modo demo.
 *
 * Devuelve siempre el mismo objeto, así que **cualquier** cadena de PostgREST
 * funciona: `.select().eq().single()`, `.update().in().select()`,
 * `.delete().eq().select()`... Antes cada cadena nueva había que añadirla a
 * mano aquí, y la que faltaba reventaba el modo demo con `is not a function`.
 *
 * Es "thenable": un `await` sobre él resuelve la respuesta de demo, se haya
 * llamado a `.single()` o no.
 */
type QueryDemo = {
  then: (resolve: (valor: typeof RESPUESTA_DEMO) => void) => void
} & Record<string, unknown>

function crearQueryDemo(): QueryDemo {
  const base: QueryDemo = {
    then: (resolve: (valor: typeof RESPUESTA_DEMO) => void) => resolve(RESPUESTA_DEMO)
  }

  const query: QueryDemo = new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop as string]
      // Cualquier otro método del constructor de queries devuelve la cadena
      return () => query
    }
  })

  return query
}

// Si no hay credenciales, crear un cliente dummy que no haga requests reales
export const supabase = supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http')
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    })
  : {
      // Cliente dummy que no hace requests
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        signInWithPassword: () => Promise.resolve({ data: null, error: { message: 'Supabase no configurado' } }),
        signUp: () => Promise.resolve({ data: null, error: { message: 'Supabase no configurado' } }),
        signOut: () => Promise.resolve({ error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
      },
      from: () => crearQueryDemo(),
      storage: {
        from: () => ({
          upload: () => Promise.resolve({ data: null, error: { message: 'Supabase no configurado' } }),
          getPublicUrl: () => ({ data: { publicUrl: '' } })
        })
      }
    } as any

// Flag para saber si Supabase está configurado
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey)

// Tipos de base de datos
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          role: 'user' | 'admin'
          full_name: string | null
          city: string | null
          preferences: any | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          role?: 'user' | 'admin'
          full_name?: string | null
          city?: string | null
          preferences?: any | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: 'user' | 'admin'
          full_name?: string | null
          city?: string | null
          preferences?: any | null
          created_at?: string
          updated_at?: string
        }
      }
      boxes: {
        Row: {
          id: string
          name: string
          description: string | null
          nfc_tag_id: string | null
          location: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          nfc_tag_id?: string | null
          location?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          nfc_tag_id?: string | null
          location?: string | null
          created_by?: string
          created_at?: string
        }
      }
      garments: {
        Row: {
          id: string
          user_id: string
          name: string
          type: string
          color: string | null
          season: 'verano' | 'invierno' | 'otoño' | 'primavera' | 'all' | null
          style: string[] | null
          image_url: string | null
          box_id: string | null
          nfc_tag_id: string | null
          barcode_id: string | null
          status: 'available' | 'in_use'
          last_used: string | null
          usage_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type: string
          color?: string | null
          season?: 'verano' | 'invierno' | 'otoño' | 'primavera' | 'all' | null
          style?: string[] | null
          image_url?: string | null
          box_id?: string | null
          nfc_tag_id?: string | null
          barcode_id?: string | null
          status?: 'available' | 'in_use'
          last_used?: string | null
          usage_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          type?: string
          color?: string | null
          season?: 'verano' | 'invierno' | 'otoño' | 'primavera' | 'all' | null
          style?: string[] | null
          image_url?: string | null
          box_id?: string | null
          nfc_tag_id?: string | null
          barcode_id?: string | null
          status?: 'available' | 'in_use'
          last_used?: string | null
          usage_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      outfits: {
        Row: {
          id: string
          user_id: string
          garment_ids: string[]
          weather_conditions: any | null
          occasion: string | null
          ai_prompt: string | null
          rating: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          garment_ids: string[]
          weather_conditions?: any | null
          occasion?: string | null
          ai_prompt?: string | null
          rating?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          garment_ids?: string[]
          weather_conditions?: any | null
          occasion?: string | null
          ai_prompt?: string | null
          rating?: number | null
          created_at?: string
        }
      }
      usage_history: {
        Row: {
          id: string
          user_id: string
          garment_id: string
          outfit_id: string | null
          usage_type: 'outfit' | 'manual' | 'recommendation'
          weather_at_use: any | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          garment_id: string
          outfit_id?: string | null
          usage_type: 'outfit' | 'manual' | 'recommendation'
          weather_at_use?: any | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          garment_id?: string
          outfit_id?: string | null
          usage_type?: 'outfit' | 'manual' | 'recommendation'
          weather_at_use?: any | null
          created_at?: string
        }
      }
      nfc_tags: {
        Row: {
          id: string
          tag_id: string
          entity_type: 'box' | 'garment'
          entity_id: string
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          tag_id: string
          entity_type: 'box' | 'garment'
          entity_id: string
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          tag_id?: string
          entity_type?: 'box' | 'garment'
          entity_id?: string
          created_by?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
