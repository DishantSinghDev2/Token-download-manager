import { NextRequest, NextResponse } from 'next/server'
import { getDb, ObjectId } from '@/lib/mongodb'
import { Token, Download } from '@/lib/models'
import { validateUrl, getFilenameFromUrl } from '@/lib/utils'
import { downloadQueue } from '@/lib/queue'
import { getRedisClient } from '@/lib/redis'
import path from 'path'

const DOWNLOADS_DIR = process.env.DOWNLOADS_DIR || '/downloads'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, url } = body

    if (!token || !url) {
      return NextResponse.json(
        { error: 'Token and URL are required' },
        { status: 400 }
      )
    }

    // Validate URL
    const urlValidation = validateUrl(url)
    if (!urlValidation.valid) {
      return NextResponse.json(
        { error: urlValidation.error },
        { status: 400 }
      )
    }

    const db = await getDb()
    
    // Get token
    const tokenDoc = await db.collection<Token>('tokens').findOne({ token })
    if (!tokenDoc) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 404 }
      )
    }

    // Check token status
    if (tokenDoc.status !== 'active') {
      return NextResponse.json(
        { error: 'Token is not active' },
        { status: 403 }
      )
    }

    // Check expiry
    if (new Date() > tokenDoc.expiresAt) {
      await db.collection('tokens').updateOne(
        { _id: tokenDoc._id },
        { $set: { status: 'expired', updatedAt: new Date() } }
      )
      return NextResponse.json(
        { error: 'Token has expired' },
        { status: 403 }
      )
    }

    // Check concurrent downloads
    const activeDownloads = await db.collection<Download>('downloads').countDocuments({
      tokenId: tokenDoc._id,
      status: { $in: ['queued', 'downloading'] },
    })

    if (activeDownloads >= tokenDoc.maxConcurrentDownloads) {
      return NextResponse.json(
        { error: 'Maximum concurrent downloads reached' },
        { status: 429 }
      )
    }

    // Try to get file size via HEAD request
    let fileSize = 0
    try {
      const headResponse = await fetch(url, { method: 'HEAD' })
      const contentLength = headResponse.headers.get('content-length')
      if (contentLength) {
        fileSize = parseInt(contentLength)
      }
    } catch (error) {
      // If HEAD fails, we'll check size during download
      console.warn('HEAD request failed, will check size during download')
    }

    // Check file size limit (if we got it)
    if (fileSize > 0 && fileSize > tokenDoc.maxFileSizeBytes) {
      return NextResponse.json(
        { error: `File size exceeds limit of ${tokenDoc.maxFileSizeBytes} bytes` },
        { status: 400 }
      )
    }

    // Check quota
    if (fileSize > 0 && (tokenDoc.usedBytes + fileSize) > tokenDoc.totalQuotaBytes) {
      return NextResponse.json(
        { error: 'Insufficient quota remaining' },
        { status: 403 }
      )
    }

    // Create download record
    const filename = getFilenameFromUrl(url)
    const downloadDoc: Download = {
      tokenId: tokenDoc._id!,
      inputUrl: url,
      filename,
      status: 'queued',
      totalBytes: fileSize,
      downloadedBytes: 0,
      speed: 0,
      eta: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await db.collection<Download>('downloads').insertOne(downloadDoc)
    const downloadId = result.insertedId.toString()

    // Create download path
    const downloadPath = path.join(DOWNLOADS_DIR, token, downloadId)

    // Enqueue download job
    await downloadQueue.add('download', {
      downloadId,
      tokenId: tokenDoc._id!.toString(),
      inputUrl: url,
      filename,
      downloadPath,
    })

    return NextResponse.json({
      success: true,
      downloadId,
    })
  } catch (error: any) {
    console.error('Error creating download:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    const db = await getDb()
    const tokenDoc = await db.collection<Token>('tokens').findOne({ token })
    
    if (!tokenDoc) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 404 }
      )
    }

    // Get downloads
    const downloads = await db
      .collection<Download>('downloads')
      .find({ tokenId: tokenDoc._id })
      .sort({ createdAt: -1 })
      .toArray()

    // Get live progress from Redis for active downloads
    const redis = await getRedisClient()
    const downloadsWithProgress = await Promise.all(
      downloads.map(async (download) => {
        if (download.status === 'downloading') {
          try {
            const progressKey = `download:progress:${download._id!.toString()}`
            const progressData = await redis.get(progressKey)
            if (progressData) {
              const progress = JSON.parse(progressData)
              return {
                ...download,
                downloadedBytes: progress.downloadedBytes || download.downloadedBytes,
                speed: progress.speed || download.speed,
                eta: progress.eta || download.eta,
              }
            }
          } catch (error) {
            console.error('Error fetching progress:', error)
          }
        }
        return download
      })
    )

    return NextResponse.json({
      downloads: downloadsWithProgress.map(d => ({
        ...d,
        _id: d._id!.toString(),
        tokenId: d.tokenId.toString(),
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
        completedAt: d.completedAt?.toISOString(),
      })),
    })
  } catch (error: any) {
    console.error('Error fetching downloads:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
