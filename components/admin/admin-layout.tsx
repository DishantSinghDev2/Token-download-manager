'use client';

import React from "react"

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Zap, Download, Users, Shield, LogOut, Menu, X } from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
  currentUser: string;
  onLogout: () => void;
}

export default function AdminLayout({ children, currentUser, onLogout }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navItems = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/tokens', label: 'Tokens', icon: Zap },
    { href: '/admin/downloads', label: 'Downloads', icon: Download },
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/security', label: 'Security', icon: Shield },
  ];

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'w-64' : 'w-0'
        } bg-sidebar border-r border-border transition-all duration-300 overflow-hidden flex flex-col`}
      >
        <div className="p-4 border-b border-border">
          <h1 className="text-xl font-bold text-sidebar-foreground">Download Manager</h1>
        </div>

        <nav className="flex-1 overflow-y-auto space-y-1 p-4">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}>
              <div className="flex items-center gap-3 px-4 py-2 rounded-md text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
                <Icon className="h-5 w-5" />
                <span className="text-sm font-medium">{label}</span>
              </div>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="text-xs text-sidebar-foreground/70 mb-4">Signed in as {currentUser}</div>
          <Button onClick={onLogout} variant="outline" size="sm" className="w-full justify-start bg-transparent">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-card border-b border-border p-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <div className="text-sm text-muted-foreground">{new Date().toLocaleDateString()}</div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
