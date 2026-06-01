'use client'

import { useState, useEffect, useCallback } from 'react'
import ReceiptReport from '../../components/ReceiptReport'
import styles from './history.module.css'

interface HistorySummary {
  id: string
  timestamp: string
  productName: string
  category: string
  pipeline: string
  issues: { errors: number; warnings: number; typos: number }
}

export default function HistoryPage() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [records, setRecords] = useState<HistorySummary[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedReport, setSelectedReport] = useState<any>(null)
  const [error, setError] = useState('')

  const fetchList = useCallback(async (pw: string, p: number, s: string) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ pw, page: String(p) })
      if (s) params.set('search', s)
      const resp = await fetch(`/api/history?${params}`)
      if (resp.status === 401) {
        setError('密码错误')
        setLoading(false)
        return
      }
      const data = await resp.json()
      setRecords(data.records || [])
      setTotal(data.total || 0)
    } catch {
      setError('加载失败')
    }
    setLoading(false)
  }, [])

  const handleLogin = () => {
    fetchList(password, 1, search)
    setAuthed(true)
  }

  useEffect(() => {
    if (authed) fetchList(password, page, search)
  }, [page, authed, password, search, fetchList])

  const handleViewReport = async (id: string) => {
    setSelectedId(id)
    const resp = await fetch(`/api/history/${encodeURIComponent(id)}?pw=${password}`)
    const data = await resp.json()
    setSelectedReport(data.fullReport || data)
  }

  const formatTime = (ts: string) => {
    const d = new Date(ts)
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  if (!authed) {
    return (
      <main className={styles.container}>
        <div className={styles.loginBox}>
          <h2 className={styles.loginTitle}>审核记录</h2>
          <input
            type="password"
            className={styles.loginInput}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="请输入管理员密码"
          />
          <button className={styles.loginBtn} onClick={handleLogin}>进入</button>
          {error && <p className={styles.error}>{error}</p>}
        </div>
      </main>
    )
  }

  if (selectedReport) {
    return (
      <main className={styles.container}>
        <button className={styles.backBtn} onClick={() => { setSelectedId(null); setSelectedReport(null) }}>← 返回列表</button>
        <ReceiptReport report={selectedReport} modelName={selectedReport.pipeline || ''} />
      </main>
    )
  }

  return (
    <main className={styles.container}>
      <h2 className={styles.title}>审核记录 · {total} 条</h2>
      <div className={styles.searchBar}>
        <input
          className={styles.searchInput}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="搜索产品名称或分类..."
        />
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.list}>
        {records.map((r) => (
          <div key={r.id} className={styles.card} onClick={() => handleViewReport(r.id)}>
            <div className={styles.cardMeta}>
              <span className={styles.cardTime}>{formatTime(r.timestamp)}</span>
              <span className={styles.cardPipeline}>{r.pipeline}</span>
            </div>
            <div className={styles.cardTitle}>{r.productName}</div>
            <div className={styles.cardIssues}>
              {r.issues.errors > 0 && <span className={styles.tagError}>{r.issues.errors} 错误</span>}
              {r.issues.warnings > 0 && <span className={styles.tagWarn}>{r.issues.warnings} 预警</span>}
              {r.issues.typos > 0 && <span className={styles.tagTypo}>{r.issues.typos} 错别字</span>}
              {r.issues.errors === 0 && r.issues.warnings === 0 && r.issues.typos === 0 && (
                <span className={styles.tagOK}>未发现问题</span>
              )}
            </div>
          </div>
        ))}
        {records.length === 0 && !loading && <p className={styles.empty}>暂无记录</p>}
      </div>

      {total > 20 && (
        <div className={styles.pagination}>
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>← 上一页</button>
          <span>{page} / {Math.ceil(total / 20)}</span>
          <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(page + 1)}>下一页 →</button>
        </div>
      )}
    </main>
  )
}
