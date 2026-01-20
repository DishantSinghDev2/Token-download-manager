import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getRedis } from '@/lib/redis';
import { ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; downloadId: string }> }
) {
  try {
    const { token, downloadId } = await params;
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

    const db = await getDb();
    const redis = getRedis();

    // Validate token
    const tokenDoc = await db.collection('tokens').findOne({ token });
    if (!tokenDoc) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    // Validate token status
    if (tokenDoc.status !== 'active') {
      return NextResponse.json({ error: 'Token is not active' }, { status: 403 });
    }

    // Check expiry
    if (tokenDoc.expiresAt && new Date(tokenDoc.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Token has expired' }, { status: 403 });
    }

    // Validate download
    const download = await db.collection('downloads').findOne({
      _id: new ObjectId(downloadId),
      tokenId: tokenDoc._id.toString(),
      status: 'completed',
    });

    if (!download) {
      return NextResponse.json({ error: 'Download not found or not completed' }, { status: 404 });
    }

    // Check IP whitelist if set
    if (tokenDoc.allowedIps && tokenDoc.allowedIps.length > 0) {
      if (!tokenDoc.allowedIps.includes(ip)) {
        return NextResponse.json({ error: 'IP not whitelisted for this token' }, { status: 403 });
      }
    }

    // Build file path
    const downloadDir = process.env.DOWNLOADS_DIR || '/downloads';
    const filePath = path.join(downloadDir, tokenDoc._id.toString(), downloadId, download.originalFilename);

    // Verify file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found on server' }, { status: 404 });
    }

    // Get file stats
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;

    // Handle range requests for multi-connection downloads
    const rangeHeader = request.headers.get('range');
    let start = 0;
    let end = fileSize - 1;
    let statusCode = 200;
    const headers: Record<string, string> = {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${download.originalFilename}"`,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    };

    if (rangeHeader) {
      const ranges = rangeHeader.replace(/bytes=/, '').split('-');
      start = parseInt(ranges[0], 10);
      end = ranges[1] ? parseInt(ranges[1], 10) : end;

      if (isNaN(start) || isNaN(end) || start > end) {
        return new NextResponse(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${fileSize}` },
        });
      }

      statusCode = 206;
      headers['Content-Range'] = `bytes ${start}-${end}/${fileSize}`;
      headers['Content-Length'] = String(end - start + 1);
    } else {
      headers['Content-Length'] = String(fileSize);
    }

    // Update download access log
    await db.collection('downloads').updateOne(
      { _id: download._id },
      {
        $set: {
          lastAccessedAt: new Date(),
          lastAccessedIp: ip,
        },
        $inc: {
          accessCount: 1,
        },
      }
    );

    // Update token usage
    await db.collection('token_usage').updateOne(
      { tokenId: tokenDoc._id },
      {
        $set: {
          lastUsedAt: new Date(),
          lastUsedIp: ip,
        },
        $inc: {
          accessCount: 1,
        },
      },
      { upsert: true }
    );

    // Stream file
    const fileStream = fs.createReadStream(filePath, { start, end });

    return new NextResponse(fileStream as any, {
      status: statusCode,
      headers,
    });
  } catch (error: any) {
    console.error('[Download API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to serve file' },
      { status: 500 }
    );
  }
}
