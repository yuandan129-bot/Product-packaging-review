'use client'

import { useState, useRef } from 'react'
import type { ComplianceReport } from '../types/compliance'
import styles from './ReceiptReport.module.css'

// 法律条款结构化数据
let _clausesCache: Record<string, Record<string, string>> | null = null
async function loadClauses(): Promise<Record<string, Record<string, string>>> {
  if (_clausesCache) return _clausesCache
  try {
    const resp = await fetch('/knowledge_base/clauses.json')
    _clausesCache = await resp.json()
    return _clausesCache!
  } catch {
    return {}
  }
}

function parseRegulation(regText: string): { doc: string; clause: string } | null {
  if (!regText) return null
  // 匹配不同格式：GB 7718-2025 第4.1.2条 / GB 28050 4.2 / 广告法 第9条 / 食品标识监督管理办法 第15条
  const patterns = [
    /(GB\s*\d+)\S*\s*第?\s*(\d+(?:\.\d+)*)\s*[条节]/,
    /(GB\s*\d+)\S*\s*(\d+(?:\.\d+)*)/,
    /(广告法)\s*第?\s*(\d+)\s*条/,
    /(食品标识监督管理办法)\s*第?\s*(\d+)\s*条/,
  ]
  for (const p of patterns) {
    const m = regText.match(p)
    if (m) return { doc: m[1].replace(/\s/g, ' '), clause: m[2] }
  }
  return null
}

// 从 regulation 字段提取内嵌原文（格式：条款编号：原文内容）
function extractInlineClause(regText: string): string | null {
  const idx = regText.indexOf('：')
  if (idx === -1) { const colon = regText.indexOf(':'); if (colon === -1) return null; const after = regText.slice(colon + 1).trim(); return after.length > 15 ? after : null }
  const after = regText.slice(idx + 1).trim()
  return after.length > 10 ? after : null
}

// 从 regulation 字段提取条款编号（去掉内嵌原文后的编号部分）
function extractRefNumber(regText: string): string {
  const idx = regText.indexOf('：')
  if (idx === -1) return regText
  return regText.slice(0, idx).trim()
}

function ClausePopover({ regulation }: { regulation: string }) {
  const [clauseText, setClauseText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleHover = async () => {
    if (clauseText || loading) return

    // 优先：从 regulation 字段直接提取内嵌原文
    const inlineText = extractInlineClause(regulation)
    if (inlineText) {
      setClauseText(inlineText)
      return
    }

    // Fallback：从 clauses.json 查找
    setLoading(true)
    const refNum = extractRefNumber(regulation)
    const parsed = parseRegulation(refNum)
    if (!parsed) { setClauseText(''); setLoading(false); return }
    const clauses = await loadClauses()
    const text = clauses[parsed.doc]?.[parsed.clause]
    setClauseText(text || `条款原文暂未收录，欢迎反馈补充。\n\n依据：${refNum}`)
    setLoading(false)
  }

  return (
    <span
      className={styles.regulationRef}
      onMouseEnter={handleHover}
      onMouseLeave={() => setClauseText(null)}
    >
      {extractRefNumber(regulation)}
      {(clauseText || loading) && (
        <span className={styles.clausePopover}>
          {loading ? '加载中...' : clauseText}
        </span>
      )}
    </span>
  )
}

interface BrandFile {
  name: string
  type: string
  content: string
}

interface Props {
  report: ComplianceReport
  modelName?: string
  onDownloadJSON?: () => void
}

const ITEMS_PER_PAGE = 4

function getBrandFiles(): BrandFile[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = sessionStorage.getItem('brandFiles')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function RefLink({ docName }: { docName: string }) {
  const [expanded, setExpanded] = useState(false)
  const brandFiles = getBrandFiles()
  const match = brandFiles.find((f) => f.name.includes(docName))
  const isText = match && !match.type.startsWith('image/') && !match.content.startsWith('data:image')

  if (!match) return <span className={styles.refText}>{docName}</span>
  if (!isText) return <span className={styles.refText}>{docName}（图片文件）</span>

  return (
    <span>
      <span className={styles.refLink} onClick={() => setExpanded(!expanded)}>
        {expanded ? '▾' : '▸'} {docName}
      </span>
      {expanded && (
        <pre className={styles.refPreview}>{match.content.slice(0, 500)}{match.content.length > 500 && '\n...'}</pre>
      )}
    </span>
  )
}

type IssueItem = { kind: 'error'; data: typeof _dummyError } | { kind: 'warn'; data: typeof _dummyError } | { kind: 'typo'; data: { severity: string; wrong: string; correct: string; message?: string; position?: string; category: string } }

const _dummyError = null as any

export default function ReceiptReport({ report, modelName, onDownloadJSON }: Props) {
  const reportRef = useRef<HTMLDivElement>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [exporting, setExporting] = useState(false)

  const totalIssues = (report.criticalErrors?.length || 0) + (report.warnings?.length || 0) + (report.typoIssues?.length || 0)
  const checklistItems = Object.entries(report.checklist || {})

  // 构建检测项 → 建议映射
  const suggestionMap: Record<string, string> = {}
  for (const e of [...(report.criticalErrors || []), ...(report.warnings || [])]) {
    if (e.suggestion && e.category && !suggestionMap[e.category]) {
      suggestionMap[e.category] = e.suggestion
    }
  }

  // 把所有问题归并为一个数组
  const allIssues: { kind: 'error' | 'warn' | 'typo'; idx: number; item: any }[] = []
  ;(report.criticalErrors || []).forEach((e, i) => allIssues.push({ kind: 'error', idx: i, item: e }))
  ;(report.warnings || []).forEach((w, i) => allIssues.push({ kind: 'warn', idx: i, item: w }))
  ;(report.typoIssues || []).forEach((t, i) => allIssues.push({ kind: 'typo', idx: i, item: t }))

  const effectivePerPage = exporting ? 999 : ITEMS_PER_PAGE
  const totalPages = totalIssues > 0 ? Math.ceil(totalIssues / effectivePerPage) : 1
  const startIdx = exporting ? 0 : currentPage * ITEMS_PER_PAGE
  const pageIssues = exporting ? allIssues : allIssues.slice(startIdx, startIdx + ITEMS_PER_PAGE)
  const isLastPage = exporting || currentPage >= totalPages - 1

  // ── 渲染单个问题卡片 ──
  const renderIssue = (issue: typeof allIssues[0], globalIdx: number) => {
    const { kind, item } = issue
    if (kind === 'typo') {
      return (
        <div key={`typo-${issue.idx}`} className={styles.issueCard}>
          <div className={styles.issueHeader}>
            <span className={item.severity === 'error' ? styles.issueBadgeError : styles.issueBadgeWarn}>错别字</span>
            <span className={styles.issueNum}>{globalIdx + 1}/{totalIssues}</span>
            <span className={styles.issueCat}>{item.category}</span>
          </div>
          <p className={styles.issueMsg}>
            <span className={styles.typoWrong}>{item.wrong}</span>{' → '}<span className={styles.typoCorrect}>{item.correct}</span>
          </p>
          {item.message && <p className={styles.issueMsg}>{item.message}</p>}
          {item.position && <p className={styles.issueMeta}>📍 位置：{item.position}</p>}
        </div>
      )
    }

    return (
      <div key={`${kind}-${issue.idx}`} className={styles.issueCard}>
        <div className={styles.issueHeader}>
          <span className={kind === 'error' ? styles.issueBadgeError : styles.issueBadgeWarn}>
            {kind === 'error' ? '错误' : '预警'}
          </span>
          <span className={styles.issueNum}>{globalIdx + 1}/{totalIssues}</span>
          <span className={styles.issueCat}>{item.category}</span>
        </div>
        <p className={styles.issueMsg}>{item.message}</p>
        {item.position && <p className={styles.issueMeta}>📍 位置：{item.position}</p>}
        {item.regulation && <p className={styles.issueMeta}>📋 依据：<ClausePopover regulation={item.regulation} /></p>}
        {item.suggestion && <p className={styles.issueSuggestion}>💡 建议：{item.suggestion}</p>}
        {item.referenceDoc && (
          <p className={styles.issueMeta}>📄 参考文档：<RefLink docName={item.referenceDoc} /></p>
        )}
      </div>
    )
  }

  // ── 保存按钮 ──
  const handleSaveImage = async () => {
    if (!reportRef.current) return
    setExporting(true)
    // 等 React 渲染完所有问题后再截图
    await new Promise((r) => setTimeout(r, 300))
    try {
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(reportRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `compliance-report-${Date.now()}.png`
      a.click()
    } catch {
      alert('图片导出失败，请尝试打印为 PDF')
    } finally {
      setExporting(false)
    }
  }

  const handlePrint = () => {
    setExporting(true)
    setTimeout(() => {
      window.print()
      setExporting(false)
    }, 300)
  }

  // ── Page 1: 头部 + 摘要 + 总览 + 问题详述（含第一页问题）──
  const renderPageOne = () => (
    <>
      {/* 报告头部 */}
      <header className={styles.header}>
        <h2 className={styles.title}>包装合规检测报告</h2>
        <div className={styles.metaRow}>
          <span>NO. {Date.now().toString(36).slice(-6).toUpperCase()}</span>
          <span>{new Date().toLocaleString('zh-CN')}</span>
        </div>
      </header>

      {/* 产品摘要 */}
      <section className={styles.summary}>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>产品名称</span>
            <span className={styles.summaryValue}>{report.productName || '—'}</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>食品分类</span>
            <span className={styles.summaryValue}>{report.category || '—'}</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>执行标准</span>
            <span className={styles.summaryValue}>
              {report.standard || '—'}
              {report.standardStatus && (
                <span className={report.standardStatus === 'current' ? styles.badgeOK : styles.badgeNG}>
                  {report.standardStatus === 'current' ? '现行' : report.standardStatus === 'expired' ? '过期' : '错误'}
                </span>
              )}
            </span>
          </div>
        </div>
      </section>

      {/* 字体版权风险提醒 */}
      <div className={styles.fontWarningBox}>
        <span className={styles.fontWarningIcon}>⚠️</span>
        <div>
          <p className={styles.fontWarningTitle}>字体版权风险提示</p>
          <p className={styles.fontWarningText}>
            包装印刷所使用的字体需确认拥有商用授权，请注意字体版权风险。
            建议优先使用免费商用字体（如思源黑体、MiSans、阿里巴巴普惠体等）。
          </p>
        </div>
      </div>

      <div className={styles.divider} />

      {/* 检测结果总览表 */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>检测结果总览</h3>
        <table className={styles.checkTable}>
          <thead>
            <tr>
              <th>检测项</th>
              <th className={styles.thResult}>结果</th>
              <th>修改建议</th>
            </tr>
          </thead>
          <tbody>
            {checklistItems.map(([item, passed]) => {
              const sug = suggestionMap[item]
              return (
                <tr key={item} className={passed ? styles.rowOK : styles.rowFail}>
                  <td>{item}</td>
                  <td className={passed ? styles.cellOK : styles.cellFail}>{passed ? '✓' : '✗'}</td>
                  <td className={styles.cellSug}>{!passed && sug ? sug : passed ? '—' : '待补充'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {totalIssues > 0 && (
          <p className={styles.resultSummary}>共发现 {report.criticalErrors.length} 项错误、{report.warnings.length} 项预警、{report.typoIssues.length} 项错别字</p>
        )}
        {totalIssues === 0 && (
          <p className={styles.resultSummaryOK}>未发现合规问题 ✓</p>
        )}
      </section>

      {/* 第一页问题 */}
      {pageIssues.length > 0 && (
        <>
          <div className={styles.divider} />
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>问题详述</h3>
            {pageIssues.map((issue, i) => renderIssue(issue, startIdx + i))}
          </section>
        </>
      )}
    </>
  )

  // ── 后续页：仅问题详述 ──
  const renderContinuationPage = () => (
    <>
      <header className={styles.header}>
        <h2 className={styles.title}>包装合规检测报告（续）</h2>
        <div className={styles.metaRow}>
          <span>第 {currentPage + 1} 页</span>
        </div>
      </header>
      <div className={styles.divider} />
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>问题详述（续）</h3>
        {pageIssues.map((issue, i) => renderIssue(issue, startIdx + i))}
      </section>
    </>
  )

  // ── 最后一页底部：操作 + footer ──
  const renderFooter = () => (
    <>
      {totalIssues > 0 && <div className={styles.divider} />}
      <section className={styles.actions}>
        <button className={styles.btnPrimary} onClick={handlePrint}>保存为 PDF</button>
        <button className={styles.btn} onClick={handleSaveImage}>保存为图片</button>
        {onDownloadJSON && <button className={styles.btn} onClick={onDownloadJSON}>保存 JSON</button>}
      </section>
      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          <img src="/avatar.png" alt="" className={styles.footerAvatar} />
          <span className={styles.footerName}>元旦为你检测</span>
        </div>
        <p className={styles.footerMeta}>此检测基于 {modelName || 'Moonshot Vision'} 模型</p>
        <p className={styles.footerDisclaimer}>内容由 AI 生成，仅供参考</p>
      </footer>
    </>
  )

  return (
    <div className={styles.reportWrapper} ref={reportRef}>
      {currentPage === 0 ? renderPageOne() : renderContinuationPage()}

      {/* 分页控件 */}
      {!exporting && totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.pageBtn}
            disabled={currentPage === 0}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            ← 上一页
          </button>
          <span className={styles.pageInfo}>{currentPage + 1} / {totalPages}</span>
          <button
            className={styles.pageBtn}
            disabled={currentPage >= totalPages - 1}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            下一页 →
          </button>
        </div>
      )}

      {/* 最后一页显示 footer */}
      {isLastPage && renderFooter()}
    </div>
  )
}
