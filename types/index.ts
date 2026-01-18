import { Database } from '@/lib/supabase'

// Database types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]

// User types
export type User = Tables<'users'>
export type UserRole = 'user' | 'admin'

// Box types
export type Box = Tables<'boxes'> & {
  garment_count?: number
  max_capacity?: number // Capacidad máxima de prendas (default: 15)
}

// Garment types
export type Garment = Tables<'garments'>
export type GarmentType = string // 'camisa', 'pantalon', 'vestido', etc.
export type Season = 'verano' | 'invierno' | 'otoño' | 'primavera' | 'all'
export type Style = string[] // ['casual', 'formal', 'deportivo']

// Outfit types
export type Outfit = Tables<'outfits'>

// NFC types
export type NFCTag = Tables<'nfc_tags'>

// Weather types
export interface WeatherData {
  temperature: number
  humidity: number
  description: string
  icon: string
  city: string
}

// Vision API types
export interface VisionAnalysis {
  colors: string[]
  labels: string[]
  text: string[]
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Form types
export interface LoginForm {
  email: string
  password: string
}

export interface RegisterForm {
  email: string
  password: string
  fullName: string
}

export interface GarmentForm {
  name: string
  type: string
  season?: Season
  style: string[]
  boxId?: string
  image?: File
}

export interface BoxForm {
  name: string
  description?: string
  location?: string
  nfcTagId?: string
}

// NFC types
export interface NFCReadResult {
  tagId?: string
  success: boolean
  error?: string
  info?: string
}

export interface NFCWriteResult {
  success: boolean
  tagId?: string
  error?: string
}

// AI Recommendation types
export interface OutfitRecommendation {
  garments: Garment[]
  reasoning: string
  weatherConsiderations: string[]
  occasion: string
}

// Component props types
export interface ClosetGridProps {
  garments: Garment[]
  onGarmentClick: (garment: Garment) => void
  loading?: boolean
}

export interface BoxCardProps {
  box: Box
  garmentCount: number
  onClick: () => void
}
