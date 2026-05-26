import { NextRequest, NextResponse } from "next/server"

// 延迟初始化 Redis 客户端（仅当环境变量存在时）
let redis: any = null
function getRedis() {
  if (redis) return redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  // 使用 REST API 直接调用，不依赖 @upstash/redis SDK
  redis = { url, token }
  return redis
}

const STATS_KEY = "packaging_review_stats"

async function readFromRedis(): Promise<{ barcodeCount: number; reviewCount: number } | null> {
  const r = getRedis()
  if (!r) return null
  try {
    const resp = await fetch(`${r.url}/get/${STATS_KEY}`, {
      headers: { Authorization: `Bearer ${r.token}` },
      signal: AbortSignal.timeout(5000),
    })
    if (!resp.ok) return null
    const data = await resp.json()
    const raw = data.result
    if (!raw) return { barcodeCount: 0, reviewCount: 0 }
    const parsed = JSON.parse(raw)
    return {
      barcodeCount: typeof parsed.barcodeCount === "number" ? parsed.barcodeCount : 0,
      reviewCount: typeof parsed.reviewCount === "number" ? parsed.reviewCount : 0,
    }
  } catch {
    return null
  }
}

async function writeToRedis(stats: { barcodeCount: number; reviewCount: number }): Promise<boolean> {
  const r = getRedis()
  if (!r) return false
  try {
    const resp = await fetch(`${r.url}/set/${STATS_KEY}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${r.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(JSON.stringify(stats)),
      signal: AbortSignal.timeout(5000),
    })
    return resp.ok
  } catch {
    return false
  }
}

// 服务端内存回退（无 Redis 时使用，dev 重启会清零）
const memoryFallback = { barcodeCount: 0, reviewCount: 0 }

export async function GET() {
  const redisStats = await readFromRedis()
  if (redisStats) {
    return NextResponse.json(redisStats)
  }
  return NextResponse.json(memoryFallback)
}

export async function POST(request: NextRequest) {
  let body: { type?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 })
  }

  if (body.type !== "barcode" && body.type !== "review") {
    return NextResponse.json({ error: "type 必须是 barcode 或 review" }, { status: 400 })
  }

  // 尝试从 Redis 读取最新值
  let stats = await readFromRedis()
  if (!stats) {
    // 回退到服务端内存
    stats = memoryFallback
  }

  if (body.type === "barcode") stats.barcodeCount++
  if (body.type === "review") stats.reviewCount++

  // 尝试写回 Redis
  const written = await writeToRedis(stats)
  if (!written) {
    memoryFallback.barcodeCount = stats.barcodeCount
    memoryFallback.reviewCount = stats.reviewCount
  }

  return NextResponse.json(stats)
}
