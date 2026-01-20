'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Activity {
  _id: string;
  tokenId: string;
  action: string;
  timestamp: string;
  ip: string;
  success: boolean;
}

export default function RecentActivity() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const response = await fetch('/api/admin/activities');
        if (response.ok) {
          const data = await response.json();
          setActivities(data.activities || []);
        }
      } catch (error) {
        console.error('Error fetching activities:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
    const interval = setInterval(fetchActivities, 15000); // Refresh every 15 seconds

    return () => clearInterval(interval);
  }, []);

  const actionColors: Record<string, string> = {
    login: 'bg-blue-500/10',
    download_start: 'bg-green-500/10',
    download_complete: 'bg-green-500/10',
    failed_attempt: 'bg-destructive/10',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest token usage and system events</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-secondary rounded animate-pulse" />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No recent activity</p>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <div
                key={activity._id}
                className={`flex items-center justify-between p-3 rounded-lg border ${actionColors[activity.action] || 'bg-secondary'}`}
              >
                <div>
                  <p className="font-medium text-sm">{activity.action}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(activity.timestamp).toLocaleString()} • {activity.ip}
                  </p>
                </div>
                <Badge variant="outline">
                  {activity.success ? 'Success' : 'Failed'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
