import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSystemMetrics } from '@/lib/system-metrics';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const metrics = await getSystemMetrics();

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('[API] Metrics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
