'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import TokenPortalContent from '@/components/token-portal/token-portal-content';
import TokenAuthForm from '@/components/token-portal/token-auth-form';
import Loading from './loading';

export default function TokenPage({ params }: { params: { token: string } }) {
  const searchParams = useSearchParams();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [tokenData, setTokenData] = useState<any>(null);

  const handleAuthenticated = (data: any) => {
    setTokenData(data);
    setIsAuthenticated(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={<Loading />}>
        {!isAuthenticated ? (
          <TokenAuthForm token={params.token} password={searchParams.get('p') || ''} onAuthenticated={handleAuthenticated} />
        ) : (
          <TokenPortalContent token={params.token} tokenData={tokenData} />
        )}
      </Suspense>
    </div>
  );
}
