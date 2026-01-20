'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/admin-layout';
import { Loader2 } from 'lucide-react';
import SecurityMonitoring from '@/components/admin/security-monitoring';

export default function SecurityPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/admin/login');
    else if (status === 'authenticated') setLoading(false);
  }, [status, router]);

  if (loading || status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <AdminLayout currentUser={session.user?.email || ''} onLogout={() => {}}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Security Monitoring</h1>
          <p className="text-muted-foreground">Monitor suspicious activity and manage IP blocks</p>
        </div>
        <SecurityMonitoring />
      </div>
    </AdminLayout>
  );
}
