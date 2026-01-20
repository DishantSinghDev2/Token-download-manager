'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import AdminLayout from '@/components/admin/admin-layout';
import DashboardMetrics from '@/components/admin/dashboard-metrics';
import RecentActivity from '@/components/admin/recent-activity';
import { Loader2 } from 'lucide-react';

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/admin/login');
    } else if (status === 'authenticated') {
      setLoading(false);
    }
  }, [status, router]);

  if (loading || status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <AdminLayout currentUser={session.user?.email || ''} onLogout={() => signOut()}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">System overview and statistics</p>
        </div>

        <DashboardMetrics />
        <RecentActivity />
      </div>
    </AdminLayout>
  );
}
