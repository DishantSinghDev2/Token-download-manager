import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import { Token } from '@/lib/models'
import { generateSecureToken } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      password,
      maxFileSizeBytes,
      totalQuotaBytes,
      expiryDays,
      maxConcurrentDownloads,
    } = body

    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    const token = generateSecureToken()
    const passwordHash = await bcrypt.hash(password, 10)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expiryDays)

    const tokenDoc: Token = {
      token,
      passwordHash,
      maxFileSizeBytes,
      totalQuotaBytes,
      usedBytes: 0,
      expiresAt,
      status: 'active',
      maxConcurrentDownloads,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const db = await getDb()
    const result = await db.collection<Token>('tokens').insertOne(tokenDoc)

    return NextResponse.json({
      success: true,
      tokenId: result.insertedId.toString(),
    })
  } catch (error: any) {
    console.error('Error creating token:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
