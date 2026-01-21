"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Ban, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { formatBytes } from '@/lib/utils'

interface TokenData {
  _id: string
  token: string
  maxFileSizeBytes: number
  totalQuotaBytes: number
  usedBytes: number
  expiresAt: string
  status: 'active' | 'revoked' | 'expired'
  maxConcurrentDownloads: number
  createdAt: string
}

export default function TokensList({ tokens }: { tokens: TokenData[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({})

  const copyTokenLink = (token: string) => {
    const url = `${process.env.NEXT_PUBLIC_APP_URL}/t/${token}`
    navigator.clipboard.writeText(url)
    toast({
      title: 'Copied',
      description: 'Token link copied to clipboard',
    })
  }

  const revokeToken = async (tokenId: string) => {
    setLoadingStates({ ...loadingStates, [tokenId]: true })
    
    try {
      const response = await fetch(`/api/admin/tokens/${tokenId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'revoked' }),
      })

      if (!response.ok) {
        throw new Error('Failed to revoke token')
      }

      toast({
        title: 'Success',
        description: 'Token revoked successfully',
      })
      
      router.refresh()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to revoke token',
        variant: 'destructive',
      })
    } finally {
      setLoadingStates({ ...loadingStates, [tokenId]: false })
    }
  }

  if (tokens.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            No tokens created yet. Click "Create Token" to get started.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {tokens.map((token) => (
        <Card key={token._id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                Token: {token.token.substring(0, 16)}...
              </CardTitle>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    token.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : token.status === 'revoked'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {token.status.toUpperCase()}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Max File Size</p>
                <p className="text-lg font-semibold">
                  {formatBytes(token.maxFileSizeBytes)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Quota Usage</p>
                <p className="text-lg font-semibold">
                  {formatBytes(token.usedBytes)} / {formatBytes(token.totalQuotaBytes)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Max Concurrent</p>
                <p className="text-lg font-semibold">
                  {token.maxConcurrentDownloads}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Expires At</p>
                <p className="text-lg font-semibold">
                  {new Date(token.expiresAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyTokenLink(token.token)}
                className="flex items-center gap-2"
              >
                <Copy className="h-4 w-4" />
                Copy Link
              </Button>
              {token.status === 'active' && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => revokeToken(token._id)}
                  disabled={loadingStates[token._id]}
                  className="flex items-center gap-2"
                >
                  <Ban className="h-4 w-4" />
                  Revoke
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
