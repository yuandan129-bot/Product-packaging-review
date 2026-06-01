import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '../../../../lib/redis'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const pw = req.nextUrl.searchParams.get('pw')
    if (pw !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: '密码错误' }, { status: 401 })
    }

    const { id } = await params
    const redis = getRedis()
    const raw = await redis.get(id)
    if (!raw) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404 })
    }

    const record = typeof raw === 'string' ? JSON.parse(raw) : raw
    return NextResponse.json(record)
  } catch (e: any) {
    console.error('History detail error:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
