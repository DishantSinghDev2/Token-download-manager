"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function AdminNav() {
  const pathname = usePathname()

  const navItems = [
    { href: '/admin/dashboard', label: 'Dashboard' },
    { href: '/admin/tokens', label: 'Tokens' },
  ]

  return (
    <nav className="border-b bg-white">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/admin/dashboard" className="text-xl font-bold">
              Token Download Manager
            </Link>
            <div className="flex space-x-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    pathname === item.href
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={() => signOut({ callbackUrl: '/admin/login' })}
          >
            Sign Out
          </Button>
        </div>
      </div>
    </nav>
  )
}
