'use client'

/**
 * Conversión de HEIC/HEIF a JPEG en el navegador.
 *
 * Las fotos de iPhone salen en HEIC salvo que el ajuste de cámara sea
 * "Más compatible". Solo Safari sabe decodificarlo: en Chrome, Firefox y
 * Android el <canvas> falla al cargarlo, así que hay que convertirlo antes
 * de comprimir, subir a Storage o mandarlo a analizar.
 */

/** Detecta HEIC/HEIF. Algunos navegadores dejan `type` vacío, de ahí el nombre */
export function isHeic(file: File): boolean {
  const tipo = file.type.toLowerCase()
  if (tipo === 'image/heic' || tipo === 'image/heif') return true
  return /\.(heic|heif)$/i.test(file.name)
}

/**
 * Devuelve un File JPEG equivalente. La librería (2.7 MB) se carga bajo
 * demanda: quien sube JPEG nunca llega a descargarla.
 */
export async function heicToJpeg(file: File): Promise<File> {
  const { default: heic2any } = await import('heic2any')

  const resultado = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.9
  })

  // Un HEIC puede contener varias imágenes (ráfagas): nos quedamos con la primera
  const blob = Array.isArray(resultado) ? resultado[0] : resultado

  return new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
    type: 'image/jpeg',
    lastModified: Date.now()
  })
}

/** Normaliza cualquier imagen entrante a un formato que el resto del flujo entiende */
export async function toSupportedImage(file: File): Promise<File> {
  return isHeic(file) ? heicToJpeg(file) : file
}
