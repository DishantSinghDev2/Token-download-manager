import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getDownloadProgress } from '@/lib/redis';

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const db = await getDb();

    // Get token document
    const tokenDoc = await db.collection('tokens').findOne({ token });
    if (!tokenDoc) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get downloads for this token
    const downloads = await db
      .collection('downloads')
      .find({ tokenId: tokenDoc._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    // Enrich downloads with real-time progress from Redis
    const enrichedDownloads = await Promise.all(
      downloads.map(async (download) => {
        const progress = await getDownloadProgress(download._id.toString());

        return {
          _id: download._id.toString(),
          filename: download.originalFilename,
          status: progress?.status || download.status,
          progress:
            download.fileSize > 0
              ? Math.min(100, Math.round((download.downloadedBytes / download.fileSize) * 100))
              : 0,
          speed: progress?.speed || 0,
          eta: progress?.eta || 0,
          downloadedSize: download.downloadedBytes,
          totalSize: download.fileSize,
          createdAt: download.createdAt,
          error: download.error,
          publicDownloadUrl: download.publicDownloadUrl,
        };
      })
    );

    return NextResponse.json({
      downloads: enrichedDownloads,
    });
  } catch (error) {
    console.error('[API] Get downloads error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
