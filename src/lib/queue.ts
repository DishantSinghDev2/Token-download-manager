import { Queue, QueueOptions } from 'bullmq'

const redisHost = process.env.REDIS_HOST || 'localhost'
const redisPort = parseInt(process.env.REDIS_PORT || '6379')
const redisPassword = process.env.REDIS_PASSWORD

const connection = {
  host: redisHost,
  port: redisPort,
  password: redisPassword || undefined,
}

export interface DownloadJobData {
  downloadId: string
  tokenId: string
  inputUrl: string
  filename: string
  downloadPath: string
}

const queueOptions: QueueOptions = {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      count: 100,
      age: 24 * 3600,
    },
    removeOnFail: {
      count: 100,
      age: 7 * 24 * 3600,
    },
  },
}

export const downloadQueue = new Queue<DownloadJobData>('downloads', queueOptions)
