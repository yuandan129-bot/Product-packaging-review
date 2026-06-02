import { NextRequest, NextResponse } from "next/server"
import { getRedis } from "../../../lib/redis"

const STATS_KEY = "packaging_review_stats"

export async function GET() {
  try {
    const redis = getRedis()
    const raw = await redis.get(STATS_KEY)
    if (raw) {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw
      return NextResponse.json({
        barcodeCount: parsed.barcodeCount || 0,
        reviewCount: parsed.reviewCount || 0,
      })
    }
    return NextResponse.json({ barcodeCount: 0, reviewCount: 0 })
  } catch (e: any) {
    console.error("Stats GET error:", e.message)
    return NextResponse.json({ barcodeCount: 0, reviewCount: 0 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (body.type !== "barcode" && body.type !== "review") {
      return NextResponse.json({ error: "type 必须是 barcode 或 review" }, { status: 400 })
    }

    const redis = getRedis()
    const raw = await redis.get(STATS_KEY)
    const stats = raw
      ? (typeof raw === "string" ? JSON.parse(raw) : raw)
      : { barcodeCount: 0, reviewCount: 0 }

    if (body.type === "barcode") stats.barcodeCount = (stats.barcodeCount || 0) + 1
    if (body.type === "review") stats.reviewCount = (stats.reviewCount || 0) + 1

    await redis.set(STATS_KEY, JSON.stringify(stats))
    return NextResponse.json(stats)
  } catch (e: any) {
    console.error("Stats POST error:", e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
