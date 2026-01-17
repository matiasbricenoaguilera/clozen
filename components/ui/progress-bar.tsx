'use client'

import { useEffect, useState } from 'react'

interface ProgressBarProps {
  loading: boolean
}

export function ProgressBar({ loading }: ProgressBarProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (loading) {
      // Simular progreso gradual (máximo 90% hasta que termine)
      setProgress(0)
      const interval = setInterval(() => {
        setProgress((prev) => {
          // Incrementar progreso gradualmente hasta 90%
          if (prev < 90) {
            // Inicio rápido (0-40% en 1 segundo)
            if (prev < 40) {
              return prev + 15
            }
            // Medio lento (40-70% en 2 segundos)
            if (prev < 70) {
              return prev + 5
            }
            // Final muy lento (70-90% en 3 segundos)
            return prev + 1
          }
          return prev
        })
      }, 100)

      return () => clearInterval(interval)
    } else {
      // Cuando termine de cargar, completar al 100% y luego ocultar
      setProgress(100)
      const timeout = setTimeout(() => {
        setProgress(0)
      }, 300)
      return () => clearTimeout(timeout)
    }
  }, [loading])

  if (!loading && progress === 0) {
    return null
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-1 bg-transparent">
      <div
        className="h-full bg-primary transition-all duration-300 ease-out"
        style={{
          width: `${progress}%`,
          transition: loading ? 'width 0.1s ease-out' : 'width 0.3s ease-out',
        }}
      />
    </div>
  )
}
