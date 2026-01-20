'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/admin-layout';
import TokensManagement from '@/components/admin/tokens-management';
import { Loader2 } from 'lucide-react';

export default function TokensPage() {
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
    <AdminLayout currentUser={session.user?.email || ''} onLogout={() => {}}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Token Management</h1>
          <p className="text-muted-foreground">Create and manage download tokens</p>
        </div>

        <TokensManagement />
      </div>
    </AdminLayout>
  );
}
