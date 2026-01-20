import { Worker } from 'bullmq';
import { DownloadJobData } from './queue';
import { DownloadExecutor } from './download-executor';
import { getDb } from './db';
import { ObjectId } from 'mongodb';
import { setDownloadProgress } from './redis';

export async function startDownloadWorker() {
  const worker = new Worker('downloads', handler, {
    connection: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    },
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '3'),
  });

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[Worker] Error:', err);
  });

  console.log('[Worker] Download worker started');

  return worker;
}

async function handler(job: any) {
  const data: DownloadJobData = job.data;

  console.log(`[Worker] Processing download job ${job.id}:`, {
    downloadId: data.downloadId,
    url: data.inputUrl,
    filename: data.originalFilename,
  });

  try {
    const db = await getDb();

    // Update status to downloading
    await db.collection('downloads').updateOne(
      { _id: new ObjectId(data.downloadId) },
      {
        $set: {
          status: 'downloading',
          updatedAt: new Date(),
          jobId: job.id,
        },
      }
    );

    const executor = new DownloadExecutor({
      downloadId: data.downloadId,
      tokenId: data.tokenId,
      inputUrl: data.inputUrl,
      originalFilename: data.originalFilename,
      outputPath: data.outputPath,
      maxFileSize: data.maxFileSize,
      maxConnections: 16,
    });

    // Validate URL
    const isValid = await executor.validateUrl();
    if (!isValid) {
      await db.collection('downloads').updateOne(
        { _id: new ObjectId(data.downloadId) },
        {
          $set: {
            status: 'failed',
            error: 'URL validation failed or file not accessible',
            updatedAt: new Date(),
          },
        }
      );

      throw new Error('URL validation failed');
    }

    // Check remote file size
    const remoteSize = await executor.getRemoteFileSize();
    if (remoteSize && remoteSize > data.maxFileSize) {
      await db.collection('downloads').updateOne(
        { _id: new ObjectId(data.downloadId) },
        {
          $set: {
            status: 'failed',
            error: `File size (${remoteSize} bytes) exceeds maximum allowed (${data.maxFileSize} bytes)`,
            updatedAt: new Date(),
          },
        }
      );

      throw new Error(`File size exceeds limit: ${remoteSize} > ${data.maxFileSize}`);
    }

    // Start download and wait for completion
    try {
      await executor.startDownload();
    } catch (downloadError) {
      throw new Error(`Download execution failed: ${downloadError instanceof Error ? downloadError.message : 'Unknown error'}`);
    }

    return {
      success: true,
      downloadId: data.downloadId,
      message: 'Download completed successfully',
    };
  } catch (error: any) {
    console.error(`[Worker] Error processing download ${data.downloadId}:`, error);

    try {
      const db = await getDb();
      await db.collection('downloads').updateOne(
        { _id: new ObjectId(data.downloadId) },
        {
          $set: {
            status: 'failed',
            error: error.message || 'Unknown error',
            updatedAt: new Date(),
            $inc: { retryCount: 1 },
          },
        }
      );

      await setDownloadProgress(data.downloadId, {
        status: 'failed',
        downloadedBytes: 0,
        totalBytes: 0,
        speed: 0,
        eta: 0,
        connections: 0,
        lastUpdate: Date.now(),
        error: error.message,
      });
    } catch (updateError) {
      console.error('[Worker] Error updating download status:', updateError);
    }

    throw error;
  }
}
