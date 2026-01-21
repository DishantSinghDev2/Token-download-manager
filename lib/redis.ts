import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
  if (redisClient) {
    return redisClient;
  }

  const url = process.env.REDIS_URL ?? 'redis://redis:6379';
  if (!url) {
    throw new Error('REDIS_URL is not defined');
  }

  const client = createClient({ url }) as RedisClientType;
  await client.connect();

  redisClient = client;
  return redisClient;
}

// Alias for compatibility
export const getRedis = getRedisClient;

// Helper functions for cache operations
export async function getCache<T>(key: string): Promise<T | null> {
  const client = await getRedisClient();
  const value = await client.get(key);
  return value ? JSON.parse(value) : null;
}

export async function setCache<T>(key: string, value: T, ttl?: number): Promise<void> {
  const client = await getRedisClient();
  const expiration = ttl || 3600;
  await client.setEx(key, expiration, JSON.stringify(value));
}

export async function deleteCache(key: string): Promise<void> {
  const client = await getRedisClient();
  await client.del(key);
}

export async function getCacheOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 300
): Promise<T> {
  const cached = await getCache<T>(key);
  if (cached) return cached;

  const data = await fetcher();
  await setCache(key, data, ttl);
  return data;
}

// Download progress tracking
export interface DownloadProgress {
  status: 'queued' | 'downloading' | 'paused' | 'completed' | 'failed';
  downloadedBytes: number;
  totalBytes: number;
  speed: number; // bytes per second
  eta: number; // seconds remaining
  connections: number;
  lastUpdate: number;
  error?: string;
}

export async function getDownloadProgress(jobId: string): Promise<DownloadProgress | null> {
  return getCache<DownloadProgress>(`download:${jobId}:progress`);
}

export async function setDownloadProgress(jobId: string, progress: DownloadProgress): Promise<void> {
  await setCache(`download:${jobId}:progress`, progress, 3600); // 1 hour TTL
}

// Rate limiting
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const client = await getRedisClient();
  const current = await client.incr(key);
  
  if (current === 1) {
    await client.expire(key, windowSeconds);
  }

  return current <= limit;
}

// Blocked IPs
export async function isIpBlocked(ip: string): Promise<boolean> {
  const blocked = await getCache<boolean>(`blocked_ip:${ip}`);
  return blocked || false;
}

export async function blockIp(ip: string, ttl: number = 86400): Promise<void> {
  await setCache(`blocked_ip:${ip}`, true, ttl);
}

export async function unblockIp(ip: string): Promise<void> {
  await deleteCache(`blocked_ip:${ip}`);
}
