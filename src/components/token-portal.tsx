"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { formatBytes, formatSpeed, formatETA } from '@/lib/utils'
import { Download as DownloadIcon } from 'lucide-react'

interface TokenData {
  _id: string
  token: string
  maxFileSizeBytes: number
  totalQuotaBytes: number
  usedBytes: number
  expiresAt: string
  maxConcurrentDownloads: number
}

interface DownloadData {
  _id: string
  inputUrl: string
  filename: string
  status: string
  totalBytes: number
  downloadedBytes: number
  speed: number
  eta: number
  publicUrl?: string
  createdAt: string
}

export default function TokenPortal({
  token,
  downloads: initialDownloads,
}: {
  token: TokenData
  downloads: DownloadData[]
}) {
  const { toast } = useToast()
  const [url, setUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [downloads, setDownloads] = useState(initialDownloads)

  useEffect(() => {
    // Poll for download updates every 2 seconds
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/downloads?token=${token.token}`)
        if (response.ok) {
          const data = await response.json()
          setDownloads(data.downloads)
        }
      } catch (error) {
        console.error('Failed to fetch downloads:', error)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [token.token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/downloads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token.token,
          url,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start download')
      }

      toast({
        title: 'Success',
        description: 'Download started successfully',
      })

      setUrl('')
      
      // Refresh downloads immediately
      const refreshResponse = await fetch(`/api/downloads?token=${token.token}`)
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json()
        setDownloads(refreshData.downloads)
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const remainingQuota = token.totalQuotaBytes - token.usedBytes
  const activeDownloads = downloads.filter(d => 
    d.status === 'queued' || d.status === 'downloading'
  ).length

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto p-6 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">Download Portal</h1>

        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Remaining Quota
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatBytes(remainingQuota)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Max File Size
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatBytes(token.maxFileSizeBytes)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Expires At
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Date(token.expiresAt).toLocaleDateString()}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Start New Download</CardTitle>
            <CardDescription>
              Active Downloads: {activeDownloads} / {token.maxConcurrentDownloads}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="url">Download URL</Label>
                <Input
                  id="url"
                  type="url"
                  placeholder="https://example.com/file.zip"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                  disabled={isSubmitting || activeDownloads >= token.maxConcurrentDownloads}
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isSubmitting || activeDownloads >= token.maxConcurrentDownloads}
              >
                {isSubmitting ? 'Starting...' : 'Start Download'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Downloads</CardTitle>
          </CardHeader>
          <CardContent>
            {downloads.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No downloads yet
              </p>
            ) : (
              <div className="space-y-4">
                {downloads.map((download) => (
                  <div
                    key={download._id}
                    className="border rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold truncate flex-1">
                        {download.filename}
                      </h3>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ml-2 ${
                          download.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : download.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : download.status === 'downloading'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {download.status.toUpperCase()}
                      </span>
                    </div>

                    {download.status === 'downloading' && (
                      <>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{
                              width: `${download.totalBytes > 0 
                                ? (download.downloadedBytes / download.totalBytes) * 100 
                                : 0}%`,
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>
                            {formatBytes(download.downloadedBytes)} / {formatBytes(download.totalBytes)}
                          </span>
                          <span>{formatSpeed(download.speed)}</span>
                          <span>ETA: {formatETA(download.eta)}</span>
                        </div>
                      </>
                    )}

                    {download.status === 'completed' && download.publicUrl && (
                      <a
                        href={download.publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block"
                      >
                        <Button variant="outline" size="sm" className="mt-2">
                          <DownloadIcon className="h-4 w-4 mr-2" />
                          Download File
                        </Button>
                      </a>
                    )}

                    <p className="text-xs text-muted-foreground">
                      Started: {new Date(download.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
