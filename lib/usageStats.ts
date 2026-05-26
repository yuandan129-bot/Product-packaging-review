const STORAGE_KEY = 'packaging_review_stats'

interface UsageStats {
  barcodeCount: number
  reviewCount: number
}

/* ── localstorage 回退（API 不可用时使用）── */
function readLocal(): UsageStats {
  if (typeof window === 'undefined') return { barcodeCount: 0, reviewCount: 0 }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { barcodeCount: 0, reviewCount: 0 }
    const parsed = JSON.parse(raw)
    return {
      barcodeCount: typeof parsed.barcodeCount === 'number' ? parsed.barcodeCount : 0,
      reviewCount: typeof parsed.reviewCount === 'number' ? parsed.reviewCount : 0,
    }
  } catch {
    return { barcodeCount: 0, reviewCount: 0 }
  }
}

function writeLocal(stats: UsageStats): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats))
}

/* ── API 调用 ── */
async function fetchStats(): Promise<UsageStats | null> {
  try {
    const resp = await fetch('/api/stats', { signal: AbortSignal.timeout(3000) })
    if (!resp.ok) return null
    return await resp.json()
  } catch {
    return null
  }
}

async function postIncrement(type: 'barcode' | 'review'): Promise<number | null> {
  try {
    const resp = await fetch('/api/stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
      signal: AbortSignal.timeout(3000),
    })
    if (!resp.ok) return null
    const data = await resp.json()
    return type === 'barcode' ? data.barcodeCount : data.reviewCount
  } catch {
    return null
  }
}

/* ── 公开接口 ── */

/** 获取当前统计数。优先 API → 回退 localStorage */
export async function getStats(): Promise<UsageStats> {
  const apiStats = await fetchStats()
  if (apiStats) return apiStats
  return readLocal()
}

/** 获取统计数（同步版本，仅 localStorage，用于 SSR / 首屏渲染） */
export function getStatsSync(): UsageStats {
  return readLocal()
}

/** 增加条码生成计数，返回新值 */
export async function incrementBarcode(): Promise<number> {
  const apiResult = await postIncrement('barcode')
  if (apiResult !== null) return apiResult
  const s = readLocal()
  s.barcodeCount++
  writeLocal(s)
  return s.barcodeCount
}

/** 增加审核计数，返回新值 */
export async function incrementReview(): Promise<number> {
  const apiResult = await postIncrement('review')
  if (apiResult !== null) return apiResult
  const s = readLocal()
  s.reviewCount++
  writeLocal(s)
  return s.reviewCount
}
