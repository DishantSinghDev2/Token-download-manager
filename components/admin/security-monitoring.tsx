'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SecurityMonitoring() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Security Monitoring</CardTitle>
        <CardDescription>Monitor suspicious activity and manage blocked IPs</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-center py-8">Security monitoring interface coming soon</p>
      </CardContent>
    </Card>
  );
}
