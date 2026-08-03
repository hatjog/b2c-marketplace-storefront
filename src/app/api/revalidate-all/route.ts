import { revalidatePath } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';

import { getClientIp, isRateLimited, validateRevalidateSecret } from '@/lib/rate-limiter';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = request.headers.get('x-revalidate-secret');
  if (!validateRevalidateSecret(secret, process.env.REVALIDATE_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip = getClientIp(request.headers);
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  revalidatePath('/', 'layout');
  return NextResponse.json({ revalidated: true }, { status: 200 });
}