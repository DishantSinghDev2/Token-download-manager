import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';
import { getDb } from './db';
import { setDownloadProgress, DownloadProgress } from './redis';
import { ObjectId } from 'mongodb';

const execAsync = promisify(exec);

export interface DownloadExecutorConfig {
  downloadId: string;
  tokenId: string;
  inputUrl: string;
  originalFilename: string;
  outputPath: string;
  maxFileSize: number;
  maxConnections?: number;
}

export class DownloadExecutor {
  private config: DownloadExecutorConfig;
  private aria2Process: any = null;
  private aria2Gid: string | null = null;

  constructor(config: DownloadExecutorConfig) {
    this.config = config;
  }

  async validateUrl(): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`curl -sI "${this.config.inputUrl}" | head -20`, {
        timeout: 10000,
      });

      // Check for 4xx/5xx status codes
      if (stdout.includes('400') || stdout.includes('403') || stdout.includes('404') || stdout.includes('500')) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('[DownloadExecutor] URL validation error:', error);
      return false;
    }
  }

  async getRemoteFileSize(): Promise<number | null> {
    try {
      const { stdout } = await execAsync(`curl -sI "${this.config.inputUrl}" | grep -i content-length | awk '{print $2}'`, {
        timeout: 10000,
      });

      const size = parseInt(stdout.trim());
      return isNaN(size) ? null : size;
    } catch (error) {
      console.error('[DownloadExecutor] File size check error:', error);
      return null;
    }
  }

  async startDownload(): Promise<void> {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          // Create output directory
          await fs.mkdir(this.config.outputPath, { recursive: true });

          const outputFile = path.join(this.config.outputPath, this.config.originalFilename);
          const maxConnections = this.config.maxConnections || 16;

          console.log(
            `[DownloadExecutor] Starting download: ${this.config.inputUrl} -> ${outputFile} (${maxConnections} connections)`
          );

          // aria2c command with multi-connection support
          const aria2Command = `aria2c \
            --max-connection-per-server=${maxConnections} \
            --min-split-size=1M \
            --max-tries=5 \
            --retry-wait=10 \
            --timeout=60 \
            --connect-timeout=30 \
            --allow-overwrite=true \
            --auto-file-renaming=false \
            --out="${this.config.originalFilename}" \
            --dir="${this.config.outputPath}" \
            "${this.config.inputUrl}"`;

          // Execute aria2c
          const childProcess = exec(aria2Command, (error, stdout, stderr) => {
            if (error) {
              console.error('[DownloadExecutor] aria2c error:', error);
              reject(error);
            } else {
              console.log('[DownloadExecutor] Download completed via aria2c');
              this.onComplete().then(() => resolve()).catch(reject);
            }
          });

          this.aria2Process = childProcess;

          // Monitor progress in parallel
          this.monitorProgress();
        } catch (error) {
          console.error('[DownloadExecutor] Download start error:', error);
          reject(error);
        }
      })();
    });
  }

  private async monitorProgress() {
    const db = await getDb();
    const outputFile = path.join(this.config.outputPath, this.config.originalFilename);

    const progressInterval = setInterval(async () => {
      try {
        const stats = await fs.stat(outputFile).catch(() => null);
        const downloadedBytes = stats?.size || 0;

        // Get file size from remote if not already known
        const totalBytes = this.config.maxFileSize || (await this.getRemoteFileSize()) || 0;

        if (totalBytes === 0 && downloadedBytes > 0) {
          // Can't determine total, just track downloaded
          const progress: DownloadProgress = {
            status: 'downloading',
            downloadedBytes,
            totalBytes: downloadedBytes,
            speed: 0,
            eta: 0,
            connections: this.config.maxConnections || 16,
            lastUpdate: Date.now(),
          };

          await setDownloadProgress(this.config.downloadId, progress);

          // Update MongoDB
          await db.collection('downloads').updateOne(
            { _id: new ObjectId(this.config.downloadId) },
            {
              $set: {
                downloadedBytes,
                status: 'downloading',
                updatedAt: new Date(),
              },
            }
          );
        } else if (totalBytes > 0) {
          const progress: DownloadProgress = {
            status: 'downloading',
            downloadedBytes,
            totalBytes,
            speed: 0,
            eta: 0,
            connections: this.config.maxConnections || 16,
            lastUpdate: Date.now(),
          };

          await setDownloadProgress(this.config.downloadId, progress);

          // Update MongoDB
          await db.collection('downloads').updateOne(
            { _id: new ObjectId(this.config.downloadId) },
            {
              $set: {
                downloadedBytes,
                totalBytes,
                status: 'downloading',
                updatedAt: new Date(),
              },
            }
          );

          // Check if complete
          if (downloadedBytes >= totalBytes) {
            clearInterval(progressInterval);
            await this.onComplete();
          }
        }
      } catch (error) {
        console.error('[DownloadExecutor] Progress monitoring error:', error);
      }
    }, 1000); // Update every second
  }

  private async onComplete() {
    try {
      const db = await getDb();
      const outputFile = path.join(this.config.outputPath, this.config.originalFilename);
      const stats = await fs.stat(outputFile);

      const publicUrl = `/d/${this.config.tokenId}/${this.config.downloadId}/${this.config.originalFilename}`;

      await db.collection('downloads').updateOne(
        { _id: new ObjectId(this.config.downloadId) },
        {
          $set: {
            status: 'completed',
            downloadedBytes: stats.size,
            totalBytes: stats.size,
            publicDownloadUrl: publicUrl,
            completedAt: new Date(),
            updatedAt: new Date(),
          },
        }
      );

      const progress: DownloadProgress = {
        status: 'completed',
        downloadedBytes: stats.size,
        totalBytes: stats.size,
        speed: 0,
        eta: 0,
        connections: 0,
        lastUpdate: Date.now(),
      };

      await setDownloadProgress(this.config.downloadId, progress);
    } catch (error) {
      console.error('[DownloadExecutor] Completion error:', error);
    }
  }

  async stop() {
    if (this.aria2Process) {
      this.aria2Process.kill();
    }
  }
}
