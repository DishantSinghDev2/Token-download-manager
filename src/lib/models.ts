import { ObjectId } from 'mongodb'

export interface Admin {
  _id?: ObjectId
  email: string
  passwordHash: string
  role: 'admin'
  createdAt: Date
}

export interface Token {
  _id?: ObjectId
  token: string
  passwordHash: string
  maxFileSizeBytes: number
  totalQuotaBytes: number
  usedBytes: number
  expiresAt: Date
  status: 'active' | 'revoked' | 'expired'
  maxConcurrentDownloads: number
  createdAt: Date
  updatedAt: Date
}

export interface Download {
  _id?: ObjectId
  tokenId: ObjectId
  inputUrl: string
  filename: string
  status: 'queued' | 'downloading' | 'completed' | 'failed'
  totalBytes: number
  downloadedBytes: number
  speed: number
  eta: number
  errorMessage?: string
  publicUrl?: string
  redirectedUrl?: string
  torrentInfo?: {
    seeders: number
    peers: number
    uploadSpeed: number
  }
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
}

export interface DownloadProgress {
  downloadId: string
  status: string
  totalBytes: number
  downloadedBytes: number
  speed: number
  eta: number
  updatedAt: number
}