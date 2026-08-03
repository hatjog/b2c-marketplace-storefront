import { revalidateTag } from 'next/cache';
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

  let tags: unknown;
  try {
    const body = await request.json();
    tags = body?.tags;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(tags) || tags.length === 0) {
    return NextResponse.json({ error: 'tags must be a non-empty array' }, { status: 400 });
  }

  for (const tag of tags) {
    if (typeof tag === 'string' && tag.length > 0) {
      revalidateTag(tag);
    }
  }

  return NextResponse.json({ revalidated: true }, { status: 200 });
}
