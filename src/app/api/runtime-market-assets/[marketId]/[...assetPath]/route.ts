import fs from 'node:fs/promises';
import path from 'node:path';

import { NextResponse } from 'next/server';

import { resolveRuntimeAssetFilePath } from '@/lib/runtime-market-config';

const CONTENT_TYPES: Record<string, string> = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

function getContentType(filePath: string) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ marketId: string; assetPath: string[] }> }
) {
  const { marketId, assetPath } = await params;
  const filePath = await resolveRuntimeAssetFilePath(
    decodeURIComponent(marketId),
    Array.isArray(assetPath) ? assetPath.map(segment => decodeURIComponent(segment)) : []
  );

  if (!filePath) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const file = await fs.readFile(filePath);

    return new NextResponse(file, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
        'Content-Type': getContentType(filePath)
      }
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    throw error;
  }
}