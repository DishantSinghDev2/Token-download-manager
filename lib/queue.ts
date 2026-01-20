import { Queue, Worker, QueueScheduler } from 'bullmq';
import { getRedisClient } from './redis';

let downloadQueue: Queue | null = null;
let downloadWorker: Worker | null = null;

export interface DownloadJobData {
  downloadId: string;
  tokenId: string;
  inputUrl: string;
  originalFilename: string;
  maxFileSize: number;
  outputPath: string;
  ip: string;
}

export async function getDownloadQueue(): Promise<Queue> {
  if (downloadQueue) {
    return downloadQueue;
  }

  const redisClient = await getRedisClient();
  
  downloadQueue = new Queue('downloads', {
    connection: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    },
  });

  return downloadQueue;
}

export async function addDownloadJob(data: DownloadJobData, opts?: any) {
  const queue = await getDownloadQueue();
  return queue.add('download', data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
    },
    removeOnFail: false,
    ...opts,
  });
}

export async function initializeQueueScheduler() {
  const scheduler = new QueueScheduler('downloads', {
    connection: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    },
  });

  return scheduler;
}

// Note: Worker should be initialized in a separate process
// This is just for type definitions and queue management
export function getWorkerInstance(): Worker | null {
  return downloadWorker;
}
