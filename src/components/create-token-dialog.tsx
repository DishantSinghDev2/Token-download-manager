"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'

export default function CreateTokenDialog() {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    password: '',
    maxFileSizeGB: '10',
    totalQuotaGB: '100',
    expiryDays: '30',
    maxConcurrentDownloads: '5',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch('/api/admin/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: formData.password,
          maxFileSizeBytes: parseFloat(formData.maxFileSizeGB) * 1024 * 1024 * 1024,
          totalQuotaBytes: parseFloat(formData.totalQuotaGB) * 1024 * 1024 * 1024,
          expiryDays: parseInt(formData.expiryDays),
          maxConcurrentDownloads: parseInt(formData.maxConcurrentDownloads),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create token')
      }

      toast({
        title: 'Success',
        description: 'Token created successfully',
      })
      
      setOpen(false)
      setFormData({
        password: '',
        maxFileSizeGB: '10',
        totalQuotaGB: '100',
        expiryDays: '30',
        maxConcurrentDownloads: '5',
      })
      router.refresh()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create Token</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Token</DialogTitle>
          <DialogDescription>
            Create a new download token with custom limits
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Token Password</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              minLength={8}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Minimum 8 characters
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="maxFileSizeGB">Max File Size (GB)</Label>
            <Input
              id="maxFileSizeGB"
              type="number"
              step="0.1"
              min="0.1"
              value={formData.maxFileSizeGB}
              onChange={(e) => setFormData({ ...formData, maxFileSizeGB: e.target.value })}
              required
              disabled={isLoading}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="totalQuotaGB">Total Quota (GB)</Label>
            <Input
              id="totalQuotaGB"
              type="number"
              step="1"
              min="1"
              value={formData.totalQuotaGB}
              onChange={(e) => setFormData({ ...formData, totalQuotaGB: e.target.value })}
              required
              disabled={isLoading}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="expiryDays">Expiry (Days)</Label>
            <Input
              id="expiryDays"
              type="number"
              step="1"
              min="1"
              value={formData.expiryDays}
              onChange={(e) => setFormData({ ...formData, expiryDays: e.target.value })}
              required
              disabled={isLoading}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="maxConcurrentDownloads">Max Concurrent Downloads</Label>
            <Input
              id="maxConcurrentDownloads"
              type="number"
              step="1"
              min="1"
              max="20"
              value={formData.maxConcurrentDownloads}
              onChange={(e) => setFormData({ ...formData, maxConcurrentDownloads: e.target.value })}
              required
              disabled={isLoading}
            />
          </div>
          
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Token'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
