import { ProtectedRoute } from '@/components/auth/protected-route'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute requiredRole="admin">
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-muted-foreground">Panel de Administración</h1>
          </div>
          {children}
        </main>
      </div>
    </ProtectedRoute>
  )
}



