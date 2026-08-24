/**
 * Fuente única de la taxonomía de prendas.
 *
 * La usan tanto el formulario (`src/app/closet/add/page.tsx`) como el
 * analizador de imágenes (`src/app/api/analyze-garment/route.ts`), de modo que
 * la IA solo puede sugerir valores que el formulario acepta. Si añades un tipo
 * aquí, queda disponible en ambos sitios a la vez.
 */

export const GARMENT_TYPES = [
  'abrigo',
  'accesorios',
  'bata',
  'bermuda',
  'bikini',
  'blusa',
  'bolso',
  'botas',
  'camisa',
  'camiseta',
  'chaleco',
  'chaqueta',
  'cinturón',
  'deportiva',
  'falda',
  'jersey',
  'pantalon',
  'pantalón corto',
  'pijama',
  'polera',
  'polerón',
  'ropa de casa',
  'ropa de trabajo',
  'ropa deportiva',
  'ropa interior',
  'sandalias',
  'suéter',
  'sweater',
  'traje de baño',
  'vestido',
  'zapatillas',
  'zapatos'
] as const // Ordenados alfabéticamente para fácil búsqueda

export const SEASONS = [
  { value: 'verano', label: 'Verano' },
  { value: 'invierno', label: 'Invierno' },
  { value: 'otoño', label: 'Otoño' },
  { value: 'primavera', label: 'Primavera' },
  { value: 'all', label: 'Todo el año' }
] as const

export const SEASON_VALUES = SEASONS.map(s => s.value)

export const STYLES = [
  'casual', 'formal', 'deportivo', 'elegante', 'bohemio', 'clásico',
  'moderno', 'vintage', 'minimalista', 'colorido'
] as const

export type GarmentTypeValue = (typeof GARMENT_TYPES)[number]
export type SeasonValue = (typeof SEASONS)[number]['value']
export type StyleValue = (typeof STYLES)[number]

/** Sugerencia devuelta por el analizador de imágenes */
export interface GarmentSuggestion {
  name: string
  type: GarmentTypeValue | ''
  color: string
  season: SeasonValue | ''
  style: StyleValue[]
}
