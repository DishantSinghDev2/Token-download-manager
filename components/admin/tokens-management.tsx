'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function TokensManagement() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Tokens</CardTitle>
            <CardDescription>Create and manage download tokens</CardDescription>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Token
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-center py-8">Token management interface coming soon</p>
      </CardContent>
    </Card>
  );
}
