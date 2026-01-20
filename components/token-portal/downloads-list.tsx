'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Clock, Pause } from 'lucide-react';

interface Download {
  _id: string;
  filename: string;
  status: 'queued' | 'downloading' | 'paused' | 'completed' | 'failed';
  progress: number;
  speed: number;
  eta: number;
  downloadedSize: number;
  totalSize: number;
  createdAt: string;
  error?: string;
  publicDownloadUrl?: string;
}

interface DownloadsListProps {
  downloads: Download[];
  token: string;
}

export default function DownloadsList({ downloads, token }: DownloadsListProps) {
  if (downloads.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Downloads</CardTitle>
          <CardDescription>No downloads yet</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">Submit a download URL above to get started</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Your Downloads</CardTitle>
        <CardDescription>{downloads.length} download(s)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {downloads.map((download) => (
            <DownloadItem key={download._id} download={download} token={token} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DownloadItem({ download, token }: { download: Download; token: string }) {
  const statusConfig = {
    queued: { label: 'Queued', icon: Clock, color: 'bg-yellow-500' },
    downloading: { label: 'Downloading', icon: Clock, color: 'bg-blue-500' },
    paused: { label: 'Paused', icon: Pause, color: 'bg-orange-500' },
    completed: { label: 'Completed', icon: CheckCircle2, color: 'bg-green-500' },
    failed: { label: 'Failed', icon: Clock, color: 'bg-destructive' },
  };

  const config = statusConfig[download.status];
  const Icon = config.icon;

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{download.filename}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Created {new Date(download.createdAt).toLocaleString()}
          </p>
        </div>
        <Badge variant="outline" className="ml-2">
          <Icon className="h-3 w-3 mr-1" />
          {config.label}
        </Badge>
      </div>

      {download.status === 'downloading' && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {formatBytes(download.downloadedSize)} / {formatBytes(download.totalSize)}
            </span>
            <span>{Math.round(download.progress)}%</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${download.progress}%` }} />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Speed: {formatBytes(download.speed)}/s</span>
            <span>ETA: {formatEta(download.eta)}</span>
          </div>
        </div>
      )}

      {download.status === 'completed' && download.publicDownloadUrl && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{formatBytes(download.totalSize)}</p>
          <Button
            asChild
            size="sm"
            className="w-full"
          >
            <a href={download.publicDownloadUrl}>
              <Clock className="h-4 w-4 mr-2" />
              Download Now
            </a>
          </Button>
        </div>
      )}

      {download.status === 'failed' && (
        <div className="bg-destructive/10 border border-destructive/20 rounded p-2">
          <p className="text-xs text-destructive">Error: {download.error || 'Unknown error'}</p>
        </div>
      )}

      {['queued', 'paused'].includes(download.status) && (
        <p className="text-xs text-muted-foreground">{formatBytes(download.totalSize)}</p>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function formatEta(seconds: number): string {
  if (seconds === 0) return 'calculating...';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}
