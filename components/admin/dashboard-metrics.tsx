'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface Metrics {
  cpuUsagePercent: number;
  ramUsagePercent: number;
  diskUsagePercent: number;
  networkInMbps: number;
  networkOutMbps: number;
  activeDownloadsCount: number;
  redisHealthy: boolean;
  mongoHealthy: boolean;
}

export default function DashboardMetrics() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/admin/metrics');
        if (response.ok) {
          const data = await response.json();
          setMetrics(data);
        }
      } catch (error) {
        console.error('Error fetching metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <div className="h-4 bg-secondary rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-secondary rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Unable to load metrics</p>
        </CardContent>
      </Card>
    );
  }

  const MetricCard = ({ title, value, unit, alert }: { title: string; value: number; unit: string; alert?: boolean }) => (
    <Card className={alert && value > 80 ? 'border-destructive' : ''}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {typeof value === 'number' ? value.toFixed(1) : value}
          {unit}
        </div>
        {alert && value > 80 && (
          <p className="text-xs text-destructive mt-1">High usage detected</p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Resource Metrics */}
      <div>
        <h2 className="text-lg font-semibold mb-4">System Resources</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="CPU Usage" value={metrics.cpuUsagePercent} unit="%" alert />
          <MetricCard title="RAM Usage" value={metrics.ramUsagePercent} unit="%" alert />
          <MetricCard title="Disk Usage" value={metrics.diskUsagePercent} unit="%" alert />
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Active Downloads</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.activeDownloadsCount}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Network Metrics */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Network</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricCard title="Network In" value={metrics.networkInMbps} unit=" Mbps" />
          <MetricCard title="Network Out" value={metrics.networkOutMbps} unit=" Mbps" />
        </div>
      </div>

      {/* Health Status */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Service Health</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <span className="font-medium">Redis</span>
                {metrics.redisHealthy ? (
                  <Badge variant="outline" className="bg-green-500/10">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Healthy
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-destructive/10">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Unhealthy
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <span className="font-medium">MongoDB</span>
                {metrics.mongoHealthy ? (
                  <Badge variant="outline" className="bg-green-500/10">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Healthy
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-destructive/10">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Unhealthy
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
