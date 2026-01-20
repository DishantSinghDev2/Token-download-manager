import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { checkRateLimit, isIpBlocked } from '@/lib/redis';
import { validateDownloadUrl } from '@/lib/auth';
import { addDownloadJob } from '@/lib/queue';
import { ObjectId } from 'mongodb';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { token: tokenString, downloadUrl } = await request.json();
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Check if IP is blocked
    const blocked = await isIpBlocked(ip);
    if (blocked) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Rate limit: 10 download submissions per minute
    const rateLimited = !(await checkRateLimit(`download_submit:${ip}`, 10, 60));
    if (rateLimited) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    if (!tokenString || !downloadUrl) {
      return NextResponse.json({ error: 'Token and URL are required' }, { status: 400 });
    }

    // Validate URL format and prevent SSRF
    const urlValidation = await validateDownloadUrl(downloadUrl);
    if (!urlValidation.valid) {
      return NextResponse.json({ error: urlValidation.error }, { status: 400 });
    }

    // Get token from database
    const db = await getDb();
    const tokenDoc = await db.collection('tokens').findOne({ token: tokenString });

    if (!tokenDoc) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check token status
    if (tokenDoc.status !== 'active') {
      return NextResponse.json({ error: 'Token is not active' }, { status: 403 });
    }

    // Check token expiry
    if (new Date() > tokenDoc.expiryDate) {
      return NextResponse.json({ error: 'Token has expired' }, { status: 403 });
    }

    // Check quota
    let tokenUsage = await db.collection('token_usage').findOne({ tokenId: tokenDoc._id });

if (!tokenUsage) {
  const tokenUsageDoc = {
    tokenId: tokenDoc._id,
    totalBytesDownloaded: 0,
    downloadsCount: 0,
    uniqueIps: [ip], // store as array (NOT Set)
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const insertRes = await db.collection('token_usage').insertOne(tokenUsageDoc);

  tokenUsage = {
    _id: insertRes.insertedId,
    ...tokenUsageDoc,
  } as any;
}


    const remainingQuota = tokenDoc.totalQuota - (tokenUsage!.totalBytesDownloaded || 0);
    if (remainingQuota <= 0) {
      return NextResponse.json({ error: 'Download quota exceeded' }, { status: 403 });
    }

    // Check active downloads count
    const activeDownloads = await db
      .collection('downloads')
      .countDocuments({ tokenId: tokenDoc._id, status: 'downloading' });

    if (activeDownloads >= tokenDoc.allowedMaxConcurrentDownloads) {
      return NextResponse.json({ error: 'Maximum concurrent downloads reached' }, { status: 429 });
    }

    // Extract filename from URL
    const urlPath = new URL(downloadUrl).pathname;
    const filename = path.basename(urlPath) || 'download';

    // Create download record
    const downloadId = new ObjectId();
    const outputPath = `/downloads/${tokenDoc._id}/${downloadId}`;

    const downloadDoc = {
      _id: downloadId,
      tokenId: tokenDoc._id,
      inputUrl: downloadUrl,
      originalFilename: filename,
      fileSize: 0,
      downloadedBytes: 0,
      status: 'queued',
      speed: 0,
      eta: 0,
      ip,
      userAgent,
      outputFilePath: outputPath,
      createdAt: new Date(),
      updatedAt: new Date(),
      retryCount: 0,
    };

    await db.collection('downloads').insertOne(downloadDoc);

    // Add job to queue
    const job = await addDownloadJob({
      downloadId: downloadId.toString(),
      tokenId: tokenDoc._id.toString(),
      inputUrl: downloadUrl,
      originalFilename: filename,
      maxFileSize: tokenDoc.maxFileSize,
      outputPath,
      ip,
    });

    // Log IP activity
    await db.collection('ip_logs').insertOne({
      tokenId: tokenDoc._id,
      ip,
      userAgent,
      action: 'download_start',
      timestamp: new Date(),
      success: true,
    });

    return NextResponse.json({
      success: true,
      downloadId: downloadId.toString(),
      message: 'Download started',
    });
  } catch (error: any) {
    console.error('[API] Submit download error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
