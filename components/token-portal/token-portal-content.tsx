'use client';

import React from "react"

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Download, Loader2, AlertTriangle } from 'lucide-react';
import DownloadsList from './downloads-list';

interface TokenPortalContentProps {
  token: string;
  tokenData: any;
}

interface FormData {
  downloadUrl: string;
  error?: string;
}

export default function TokenPortalContent({ token, tokenData }: TokenPortalContentProps) {
  const [formData, setFormData] = useState<FormData>({ downloadUrl: '' });
  const [loading, setLoading] = useState(false);
  const [downloads, setDownloads] = useState([]);

  // Fetch downloads list
  useEffect(() => {
    const fetchDownloads = async () => {
      try {
        const response = await fetch(`/api/token/downloads?token=${token}`);
        if (response.ok) {
          const data = await response.json();
          setDownloads(data.downloads || []);
        }
      } catch (error) {
        console.error('Error fetching downloads:', error);
      }
    };

    fetchDownloads();
    const interval = setInterval(fetchDownloads, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [token]);

  const handleSubmitDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormData((prev) => ({ ...prev, error: undefined }));
    setLoading(true);

    try {
      const response = await fetch('/api/token/submit-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          downloadUrl: formData.downloadUrl,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setFormData((prev) => ({ ...prev, error: data.error || 'Failed to submit download' }));
        return;
      }

      setFormData({ downloadUrl: '' });

      // Refresh downloads
      const downloadsResponse = await fetch(`/api/token/downloads?token=${token}`);
      if (downloadsResponse.ok) {
        const data = await downloadsResponse.json();
        setDownloads(data.downloads || []);
      }
    } catch (error) {
      setFormData((prev) => ({ ...prev, error: 'An error occurred. Please try again.' }));
    } finally {
      setLoading(false);
    }
  };

  const quotaUsed = tokenData.quotaUsed || 0;
  const totalQuota = tokenData.totalQuota || 0;
  const quotaPercent = totalQuota > 0 ? (quotaUsed / totalQuota) * 100 : 0;
  const remainingQuota = Math.max(0, totalQuota - quotaUsed);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Download Manager</h1>
          <p className="text-muted-foreground mt-2">Upload and manage your downloads</p>
        </div>

        {/* Token Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Portal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Max File Size</p>
              <p className="text-lg font-semibold">{formatBytes(tokenData.maxFileSize || 0)}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">Download Quota</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>
                    {formatBytes(quotaUsed)} / {formatBytes(totalQuota)}
                  </span>
                  <span>{Math.round(quotaPercent)}%</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, quotaPercent)}%` }}
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Expiry Date</p>
              <p className="text-lg font-semibold">{new Date(tokenData.expiryDate).toLocaleDateString()}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Active Downloads</p>
              <p className="text-lg font-semibold">{downloads.filter((d: any) => d.status === 'downloading').length}</p>
            </div>
          </CardContent>
        </Card>

        {/* Submit Download */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Submit Download URL</CardTitle>
            <CardDescription>Paste a direct download URL to begin</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitDownload} className="space-y-4">
              <div>
                <label htmlFor="downloadUrl" className="block text-sm font-medium mb-2">
                  Download URL
                </label>
                <Input
                  id="downloadUrl"
                  type="url"
                  value={formData.downloadUrl}
                  onChange={(e) => setFormData((prev) => ({ ...prev, downloadUrl: e.target.value }))}
                  placeholder="https://example.com/file.zip"
                  disabled={loading}
                  required
                />
              </div>

              {formData.error && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <p className="text-sm text-destructive">{formData.error}</p>
                </div>
              )}

              {remainingQuota <= 0 && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <p className="text-sm text-destructive">You have reached your download quota limit</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={loading || remainingQuota <= 0}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Start Download
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Downloads List */}
        <DownloadsList downloads={downloads} token={token} />
      </div>
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
