import { ObjectId } from 'mongodb';

// Admin User
export interface Admin {
  _id?: ObjectId;
  email: string;
  passwordHash: string;
  role: 'superadmin' | 'admin';
  lastLogin?: Date;
  createdAt: Date;
  disabled: boolean;
}

// Token
export interface Token {
  _id?: ObjectId;
  token: string; // Long random secure string
  passwordHash: string; // bcrypt hashed
  maxFileSize: number; // bytes, e.g., 10GB
  totalQuota: number; // bytes, e.g., 50GB
  expiryDate: Date;
  allowedMaxConcurrentDownloads: number;
  allowedIps?: string[]; // optional
  allowedDevices?: string[]; // optional
  status: 'active' | 'paused' | 'expired' | 'revoked';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // admin email
}

// Token Usage Stats
export interface TokenUsage {
  _id?: ObjectId;
  tokenId: ObjectId;
  totalBytesDownloaded: number;
  downloadsCount: number;
  uniqueIps: Set<string>;
  lastUsedTime?: Date;
  lastIp?: string;
  lastUserAgent?: string;
  updatedAt: Date;
}

// Download Job
export interface Download {
  _id?: ObjectId;
  tokenId: ObjectId;
  inputUrl: string;
  originalFilename: string;
  fileSize: number; // bytes
  downloadedBytes: number;
  status: 'queued' | 'downloading' | 'paused' | 'completed' | 'failed' | 'retrying';
  speed: number; // bytes/second
  eta: number; // seconds
  error?: string;
  ip: string;
  userAgent: string;
  deviceId?: string;
  publicDownloadUrl?: string;
  outputFilePath?: string; // e.g., /downloads/<tokenId>/<fileId>/filename
  jobId?: string; // BullMQ job ID
  aria2Gid?: string; // aria2c GID
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  retryCount: number;
}

// VM Stats Snapshot
export interface VmStats {
  _id?: ObjectId;
  cpuUsagePercent: number;
  ramUsagePercent: number;
  diskUsagePercent: number;
  networkInMbps: number;
  networkOutMbps: number;
  activeDownloadsCount: number;
  redisHealthy: boolean;
  mongoHealthy: boolean;
  timestamp: Date;
}

// IP Activity Log
export interface IpLog {
  _id?: ObjectId;
  tokenId: ObjectId;
  ip: string;
  userAgent: string;
  action: 'login' | 'download_start' | 'download_complete' | 'failed_attempt';
  timestamp: Date;
  success: boolean;
}

// Admin Action Log (for audit)
export interface AdminLog {
  _id?: ObjectId;
  adminEmail: string;
  action: string;
  targetId?: string; // tokenId, userId, etc.
  details: Record<string, any>;
  timestamp: Date;
  ipAddress: string;
}

// Suspicious Activity Alert
export interface SuspiciousActivity {
  _id?: ObjectId;
  tokenId: ObjectId;
  alertType: 'too_many_attempts' | 'token_sharing' | 'too_many_devices' | 'unusual_speed' | 'geo_anomaly';
  severity: 'low' | 'medium' | 'high';
  details: Record<string, any>;
  timestamp: Date;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
}
