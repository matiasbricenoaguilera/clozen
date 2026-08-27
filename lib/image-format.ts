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

/**
 * Redimensiona a un máximo de `maxDimension` px (lado mayor) y comprime a JPEG.
 *
 * Si algo falla —un formato que el canvas no sabe decodificar, un `toBlob` que
 * devuelve null— resuelve con el archivo original en vez de romper el guardado.
 */
export async function compressImage(
  file: File,
  maxDimension = 1200,
  quality = 0.8
): Promise<File> {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img
      if (width > height) {
        if (width > maxDimension) {
          height = (height * maxDimension) / width
          width = maxDimension
        }
      } else if (height > maxDimension) {
        width = (width * maxDimension) / height
        height = maxDimension
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')?.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        blob => {
          resolve(
            blob
              ? new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() })
              : file
          )
        },
        'image/jpeg',
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file)
    }

    img.src = url
  })
}

/** Giros que admite `rotateImage`, en grados en el sentido de las agujas del reloj */
export type Rotacion = 0 | 90 | 180 | 270

/** Suma un giro al acumulado y lo deja siempre entre 0 y 270 */
export function sumarRotacion(actual: Rotacion, delta: number): Rotacion {
  return (((actual + delta) % 360) + 360) % 360 as Rotacion
}

/**
 * Devuelve el archivo girado `grados` en el sentido de las agujas del reloj.
 *
 * En 90° y 270° el lienzo intercambia ancho y alto, que es lo que hace que la
 * foto quede derecha de verdad y no recortada.
 *
 * Ojo: vuelve a comprimir el JPEG, así que no es una operación sin pérdida.
 * Por eso la app acumula el giro en el preview y solo llama aquí al guardar.
 */
export async function rotateImage(file: File, grados: Rotacion, quality = 0.9): Promise<File> {
  if (grados === 0) return file

  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      const giroDeCuarto = grados === 90 || grados === 270
      const canvas = document.createElement('canvas')
      canvas.width = giroDeCuarto ? img.height : img.width
      canvas.height = giroDeCuarto ? img.width : img.height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(file)
        return
      }

      // Girar alrededor del centro del lienzo ya intercambiado
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate((grados * Math.PI) / 180)
      ctx.drawImage(img, -img.width / 2, -img.height / 2)

      canvas.toBlob(
        blob => {
          resolve(
            blob
              ? new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() })
              : file
          )
        },
        'image/jpeg',
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file)
    }

    img.src = url
  })
}

/**
 * Ruta dentro del bucket `garments` a partir de la URL pública.
 *
 * `.../object/public/garments/garments/{userId}/{archivo}.jpg`
 *                             ^^^^^^^^ nombre del bucket, fuera de la ruta
 */
export function storagePathFromUrl(imageUrl: string): string | null {
  const marca = '/object/public/garments/'
  const indice = imageUrl.indexOf(marca)
  if (indice === -1) return null

  const ruta = imageUrl.slice(indice + marca.length).split('?')[0]
  return ruta || null
}
