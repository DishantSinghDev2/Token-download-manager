import { Worker, Job } from 'bullmq'
import { spawn } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import { getDb, ObjectId } from '../lib/mongodb'
import { getRedisClient } from '../lib/redis'
import { Download } from '../lib/models'
import { DownloadJobData } from '../lib/queue'

const redisHost = process.env.REDIS_HOST || 'localhost'
const redisPort = parseInt(process.env.REDIS_PORT || '6379')
const redisPassword = process.env.REDIS_PASSWORD

const connection = {
  host: redisHost,
  port: redisPort,
  password: redisPassword || undefined,
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://faster.p.dishis.tech'

async function processDownload(job: Job<DownloadJobData>) {
  const { downloadId, tokenId, inputUrl, filename, downloadPath } = job.data

  console.log(`Processing download ${downloadId}`)

  const db = await getDb()
  const redis = await getRedisClient()

  try {
    // Update status to downloading
    await db.collection<Download>('downloads').updateOne(
      { _id: new ObjectId(downloadId) },
      {
        $set: {
          status: 'downloading',
          updatedAt: new Date(),
        },
      }
    )

    // Create download directory
    await fs.mkdir(downloadPath, { recursive: true })

    const outputFile = path.join(downloadPath, filename)
    
    // Start aria2c download
    const aria2c = spawn('aria2c', [
      '--split=16',
      '--max-connection-per-server=16',
      '--min-split-size=1M',
      '--file-allocation=none',
      '--summary-interval=1',
      '--continue=true',
      '--allow-overwrite=true',
      `--dir=${downloadPath}`,
      `--out=${filename}`,
      inputUrl,
    ])

    let lastUpdate = Date.now()
    let totalBytes = 0
    let downloadedBytes = 0
    let speed = 0

    aria2c.stdout.on('data', async (data) => {
      const output = data.toString()
      console.log(`aria2c stdout: ${output}`)

      // Parse aria2c output for progress
      const downloadMatch = output.match(/\((\d+)%\)/)
      const speedMatch = output.match(/DL:([0-9.]+[KMG]?i?B)/)
      const sizeMatch = output.match(/SIZE:([0-9.]+[KMG]?i?B)/)

      if (sizeMatch) {
        totalBytes = parseSizeToBytes(sizeMatch[1])
      }

      if (downloadMatch && totalBytes > 0) {
        const percentage = parseInt(downloadMatch[1])
        downloadedBytes = Math.floor((percentage / 100) * totalBytes)
      }

      if (speedMatch) {
        speed = parseSizeToBytes(speedMatch[1])
      }

      const now = Date.now()
      
      // Update Redis every second
      if (now - lastUpdate >= 1000) {
        const eta = speed > 0 ? (totalBytes - downloadedBytes) / speed : 0
        const progress = {
          downloadId,
          status: 'downloading',
          totalBytes,
          downloadedBytes,
          speed,
          eta,
          updatedAt: now,
        }

        await redis.setEx(
          `download:progress:${downloadId}`,
          300, // 5 minutes TTL
          JSON.stringify(progress)
        )

        // Update MongoDB every 5 seconds
        if (now - lastUpdate >= 5000) {
          await db.collection<Download>('downloads').updateOne(
            { _id: new ObjectId(downloadId) },
            {
              $set: {
                totalBytes,
                downloadedBytes,
                speed,
                eta,
                updatedAt: new Date(),
              },
            }
          )
        }

        lastUpdate = now
      }
    })

    aria2c.stderr.on('data', (data) => {
      console.error(`aria2c stderr: ${data}`)
    })

    // Wait for aria2c to complete
    const exitCode = await new Promise<number>((resolve) => {
      aria2c.on('close', (code) => {
        resolve(code || 0)
      })
    })

    if (exitCode !== 0) {
      throw new Error(`aria2c exited with code ${exitCode}`)
    }

    // Verify file exists
    const stats = await fs.stat(outputFile)
    const finalSize = stats.size

    // Generate public URL
    const publicUrl = `${APP_URL}/d/${path.basename(path.dirname(downloadPath))}/${downloadId}/${filename}`

    // Update download as completed
    await db.collection<Download>('downloads').updateOne(
      { _id: new ObjectId(downloadId) },
      {
        $set: {
          status: 'completed',
          totalBytes: finalSize,
          downloadedBytes: finalSize,
          publicUrl,
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    )

    // Update token usage
    await db.collection('tokens').updateOne(
      { _id: new ObjectId(tokenId) },
      {
        $inc: { usedBytes: finalSize },
        $set: { updatedAt: new Date() },
      }
    )

    // Clean up Redis progress
    await redis.del(`download:progress:${downloadId}`)

    console.log(`Download ${downloadId} completed successfully`)
  } catch (error: any) {
    console.error(`Download ${downloadId} failed:`, error)

    await db.collection<Download>('downloads').updateOne(
      { _id: new ObjectId(downloadId) },
      {
        $set: {
          status: 'failed',
          errorMessage: error.message,
          updatedAt: new Date(),
        },
      }
    )

    await redis.del(`download:progress:${downloadId}`)

    throw error
  }
}

function parseSizeToBytes(sizeStr: string): number {
  const match = sizeStr.match(/^([0-9.]+)([KMG]?i?B)$/)
  if (!match) return 0

  const value = parseFloat(match[1])
  const unit = match[2]

  const multipliers: Record<string, number> = {
    'B': 1,
    'KB': 1000,
    'KiB': 1024,
    'MB': 1000 * 1000,
    'MiB': 1024 * 1024,
    'GB': 1000 * 1000 * 1000,
    'GiB': 1024 * 1024 * 1024,
  }

  return Math.floor(value * (multipliers[unit] || 1))
}

// Create worker
const worker = new Worker<DownloadJobData>(
  'downloads',
  processDownload,
  {
    connection,
    concurrency: 3,
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
)

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`)
})

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err)
})

console.log('Download worker started')

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing worker...')
  await worker.close()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing worker...')
  await worker.close()
  process.exit(0)
})
