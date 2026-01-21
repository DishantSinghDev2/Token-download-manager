import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <h1 className="text-3xl font-bold text-center mb-2">
            Token Download Manager
          </h1>
          <p className="text-center text-gray-600 mb-8">
            High-speed download manager with token-based access control
          </p>
          <div className="space-y-4">
            <Link href="/admin/login" className="block">
              <Button className="w-full" size="lg">
                Admin Login
              </Button>
            </Link>
            <div className="text-center text-sm text-gray-500">
              Have a token? Use your token link to access downloads
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
