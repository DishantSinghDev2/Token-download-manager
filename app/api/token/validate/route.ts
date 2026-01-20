import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { validateToken } from '@/lib/auth';
import { checkRateLimit, isIpBlocked } from '@/lib/redis';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

    // Check if IP is blocked
    const blocked = await isIpBlocked(ip);
    if (blocked) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Rate limit: 5 attempts per minute
    const rateLimited = !(await checkRateLimit(`token_login:${ip}`, 5, 60));
    if (rateLimited) {
      return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
    }

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required' }, { status: 400 });
    }

    // Validate token
    const validatedToken = await validateToken(token, password);
    if (!validatedToken) {
      return NextResponse.json({ error: 'Invalid token or password' }, { status: 401 });
    }

    const db = await getDb();

    // Get token usage
    const tokenUsage = await db
      .collection('token_usage')
      .findOne({ tokenId: new ObjectId(validatedToken._id) });

    return NextResponse.json({
      token: validatedToken.token.substring(0, 8) + '...', // Don't expose full token
      maxFileSize: validatedToken.maxFileSize,
      totalQuota: validatedToken.totalQuota,
      quotaUsed: tokenUsage?.totalBytesDownloaded || 0,
      expiryDate: validatedToken.expiryDate,
      maxConcurrentDownloads: validatedToken.allowedMaxConcurrentDownloads,
    });
  } catch (error) {
    console.error('[API] Token validation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
