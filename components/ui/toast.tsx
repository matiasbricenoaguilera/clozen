'use client'

import * as React from 'react'
import * as ToastPrimitives from '@radix-ui/react-toast'
import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      // En móvil aparecen abajo (al alcance del pulgar), en escritorio arriba a la derecha
      'fixed bottom-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4',
      'sm:bottom-auto sm:right-0 sm:top-16 sm:flex-col sm:max-w-[420px]',
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  cn(
    'group pointer-events-auto relative flex w-full items-start justify-between gap-3',
    'overflow-hidden rounded-md border p-4 pr-10 shadow-lg',
    'data-[state=open]:animate-toast-in data-[state=closed]:animate-toast-out',
    'data-[swipe=end]:animate-toast-out data-[swipe=move]:transition-none'
  ),
  {
    variants: {
      variant: {
        default: 'border bg-background text-foreground',
        success: 'border-green-600/40 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100',
        destructive: 'border-destructive/50 bg-destructive text-destructive-foreground'
      }
    },
    defaultVariants: { variant: 'default' }
  }
)

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => (
  <ToastPrimitives.Root
    ref={ref}
    className={cn(toastVariants({ variant }), className)}
    {...props}
  />
))
Toast.displayName = ToastPrimitives.Root.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn('text-sm font-semibold', className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn('text-sm opacity-90', className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    // 44x44 para que sea cómodo de tocar en el móvil
    className={cn(
      'absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-md',
      'opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring',
      className
    )}
    aria-label="Cerrar notificación"
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose
}
