import { revalidateTag } from "next/cache"
import { type NextRequest, NextResponse } from "next/server"

// In-memory sliding window rate limiter: 10 requests per 60 seconds per IP.
// Note: in serverless/edge environments this is best-effort (per-instance state).
const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT = 10
const WINDOW_MS = 60_000
const CLEANUP_INTERVAL = 100 // purge stale entries every N calls
let callsSinceCleanup = 0

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }
  return request.headers.get("x-real-ip") ?? "unknown"
}

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const timestamps = rateLimitMap.get(ip) ?? []
  const recent = timestamps.filter((t) => now - t < WINDOW_MS)
  if (recent.length >= RATE_LIMIT) {
    return true
  }
  recent.push(now)
  rateLimitMap.set(ip, recent)

  // Periodic cleanup: remove IPs with no recent activity
  callsSinceCleanup++
  if (callsSinceCleanup >= CLEANUP_INTERVAL) {
    callsSinceCleanup = 0
    for (const [key, vals] of rateLimitMap) {
      if (vals.every((t) => now - t >= WINDOW_MS)) {
        rateLimitMap.delete(key)
      }
    }
  }

  return false
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = request.headers.get("x-revalidate-secret")
  if (!secret || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const ip = getClientIp(request)
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too Many Requests" }, { status: 429 })
  }

  let tags: unknown
  try {
    const body = await request.json()
    tags = body?.tags
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!Array.isArray(tags) || tags.length === 0) {
    return NextResponse.json({ error: "tags must be a non-empty array" }, { status: 400 })
  }

  for (const tag of tags) {
    if (typeof tag === "string" && tag.length > 0) {
      revalidateTag(tag)
    }
  }

  return NextResponse.json({ revalidated: true }, { status: 200 })
}
