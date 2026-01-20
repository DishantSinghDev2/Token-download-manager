import { Queue, Worker } from 'bullmq';
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
  if (downloadQueue) return downloadQueue;

  await getRedisClient(); // keeps your connection warm (not really needed but ok)

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
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: false,
    ...opts,
  });
}

// Removed QueueScheduler because bullmq version doesn't export it
export async function initializeQueueScheduler() {
  return null;
}

export function getWorkerInstance(): Worker | null {
  return downloadWorker;
}
