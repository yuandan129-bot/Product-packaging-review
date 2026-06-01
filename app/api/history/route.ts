import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '../../../lib/redis'

// 存审核记录
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const id = `review:${Date.now()}`

    const record = {
      id,
      timestamp: new Date().toISOString(),
      productName: body.productName || '未知产品',
      category: body.category || '未分类',
      pipeline: body.pipeline || 'unknown',
      issues: {
        errors: body.criticalErrors?.length || 0,
        warnings: body.warnings?.length || 0,
        typos: body.typoIssues?.length || 0,
      },
      fullReport: body,
    }

    const redis = getRedis()
    await redis.set(id, JSON.stringify(record))
    // 把 id 加到索引列表，按时间排序
    await redis.zadd('review:index', { score: Date.now(), member: id })

    return NextResponse.json({ ok: true, id })
  } catch (e: any) {
    console.error('History POST error:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// 取审核历史列表
export async function GET(req: NextRequest) {
  try {
    const pw = req.nextUrl.searchParams.get('pw')
    if (pw !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: '密码错误' }, { status: 401 })
    }

    const search = req.nextUrl.searchParams.get('search') || ''
    const page = parseInt(req.nextUrl.searchParams.get('page') || '1')
    const pageSize = 20

    const redis = getRedis()
    // 按时间倒序取 id
    const allIds = await redis.zrange('review:index', 0, -1, { rev: true })

    // 取出每条记录
    const records: any[] = []
    for (const id of allIds) {
      const raw = await redis.get(id as string)
      if (raw) {
        const r = typeof raw === 'string' ? JSON.parse(raw) : raw
        // 搜索过滤
        if (search && !r.productName?.includes(search) && !r.category?.includes(search)) continue
        // 列表不返回完整报告，只返摘要
        records.push({
          id: r.id,
          timestamp: r.timestamp,
          productName: r.productName,
          category: r.category,
          pipeline: r.pipeline,
          issues: r.issues,
        })
      }
    }

    const total = records.length
    const start = (page - 1) * pageSize
    const paged = records.slice(start, start + pageSize)

    return NextResponse.json({ records: paged, total, page, pageSize })
  } catch (e: any) {
    console.error('History GET error:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
