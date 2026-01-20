import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDb();

    // Get recent IP logs (activity)
    const activities = await db
      .collection('ip_logs')
      .find()
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json({
      activities: activities.map((activity: any) => ({
        _id: activity._id.toString(),
        tokenId: activity.tokenId.toString(),
        action: activity.action,
        timestamp: activity.timestamp,
        ip: activity.ip,
        success: activity.success,
      })),
    });
  } catch (error) {
    console.error('[API] Activities error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
