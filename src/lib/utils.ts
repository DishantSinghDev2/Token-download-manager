import crypto from 'crypto'
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex')
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`
}

export function formatETA(seconds: number): string {
  if (seconds === 0 || !isFinite(seconds)) return 'calculating...'
  
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`
  } else {
    return `${secs}s`
  }
}

export function isPrivateIP(ip: string): boolean {
  // Check for localhost
  if (ip === 'localhost' || ip === '127.0.0.1' || ip === '::1') {
    return true
  }
  
  // Check for private IPv4 ranges
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2\d|3[0-1])\./,
    /^192\.168\./,
    /^169\.254\./,
  ]
  
  return privateRanges.some(range => range.test(ip))
}

export function validateUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url)
    
    // Only allow http and https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'Only HTTP and HTTPS protocols are allowed' }
    }
    
    // Check for private IPs
    if (isPrivateIP(parsed.hostname)) {
      return { valid: false, error: 'Private IP addresses are not allowed' }
    }
    
    return { valid: true }
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' }
  }
}

export function getFilenameFromUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const pathname = parsed.pathname
    const filename = pathname.substring(pathname.lastIndexOf('/') + 1)
    return filename || 'download'
  } catch (error) {
    return 'download'
  }
}
