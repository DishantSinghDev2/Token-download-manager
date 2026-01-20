import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getDb } from './db';
import { getRedisClient } from './redis';
import { ObjectId } from 'mongodb';

const execAsync = promisify(exec);

export interface SystemMetrics {
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

export async function getSystemMetrics(): Promise<SystemMetrics> {
  const metrics: SystemMetrics = {
    cpuUsagePercent: 0,
    ramUsagePercent: 0,
    diskUsagePercent: 0,
    networkInMbps: 0,
    networkOutMbps: 0,
    activeDownloadsCount: 0,
    redisHealthy: false,
    mongoHealthy: false,
    timestamp: new Date(),
  };

  try {
    // CPU Usage
    const cpus = os.cpus();
    const avgLoad = os.loadavg()[0];
    metrics.cpuUsagePercent = Math.min(100, (avgLoad / cpus.length) * 100);

    // RAM Usage
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    metrics.ramUsagePercent = Math.round(((totalMemory - freeMemory) / totalMemory) * 100);

    // Disk Usage (attempt to get from /var)
    try {
      const { stdout } = await execAsync("df -h / | tail -1 | awk '{print $5}' | sed 's/%//'");
      metrics.diskUsagePercent = parseInt(stdout.trim());
    } catch {
      metrics.diskUsagePercent = 0;
    }

    // Network Usage (estimate from /proc/net/dev)
    try {
      const { stdout } = await execAsync(
        "cat /proc/net/dev | grep eth0 | awk '{print $2, $10}' | awk '{printf \"%.2f %.2f\", ($1/1024/1024), ($2/1024/1024)}'"
      );
      const [inMbps, outMbps] = stdout.trim().split(' ').map(parseFloat);
      metrics.networkInMbps = isNaN(inMbps) ? 0 : inMbps;
      metrics.networkOutMbps = isNaN(outMbps) ? 0 : outMbps;
    } catch {
      metrics.networkInMbps = 0;
      metrics.networkOutMbps = 0;
    }

    // Redis Health
    try {
      const redis = await getRedisClient();
      await redis.ping();
      metrics.redisHealthy = true;
    } catch {
      metrics.redisHealthy = false;
    }

    // MongoDB Health
    try {
      const db = await getDb();
      await db.admin().ping();
      metrics.mongoHealthy = true;
    } catch {
      metrics.mongoHealthy = false;
    }

    // Active Downloads Count
    try {
      const db = await getDb();
      metrics.activeDownloadsCount = await db
        .collection('downloads')
        .countDocuments({ status: { $in: ['queued', 'downloading'] } });
    } catch {
      metrics.activeDownloadsCount = 0;
    }
  } catch (error) {
    console.error('[SystemMetrics] Error getting metrics:', error);
  }

  return metrics;
}

export async function saveMetricsSnapshot(metrics: SystemMetrics): Promise<void> {
  try {
    const db = await getDb();
    await db.collection('vm_stats').insertOne({
      ...metrics,
      _id: new ObjectId(),
    });
  } catch (error) {
    console.error('[SystemMetrics] Error saving metrics:', error);
  }
}

export async function getRecentMetrics(minutes: number = 60): Promise<SystemMetrics[]> {
  try {
    const db = await getDb();
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);

    const metrics = await db
      .collection<SystemMetrics>('vm_stats')
      .find({ timestamp: { $gte: cutoffTime } })
      .sort({ timestamp: -1 })
      .limit(1000)
      .toArray();

    return metrics;
  } catch (error) {
    console.error('[SystemMetrics] Error getting recent metrics:', error);
    return [];
  }
}
