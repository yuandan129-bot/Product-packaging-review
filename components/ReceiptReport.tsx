'use client'

import { useState, useRef } from 'react'
import type { ComplianceReport } from '../types/compliance'
import styles from './ReceiptReport.module.css'

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

export default function ReceiptReport({ report, modelName, onDownloadJSON }: Props) {
  const reportRef = useRef<HTMLDivElement>(null)
  const totalIssues = (report.criticalErrors?.length || 0) + (report.warnings?.length || 0) + (report.typoIssues?.length || 0)
  const checklistItems = Object.entries(report.checklist || {})
  const failedItems = checklistItems.filter(([, v]) => !v).map(([k]) => k)

  // 构建检测项 → 建议映射，用于总览表直接显示修改建议
  const suggestionMap: Record<string, string> = {}
  for (const e of [...(report.criticalErrors || []), ...(report.warnings || [])]) {
    if (e.suggestion && e.category) {
      if (!suggestionMap[e.category]) suggestionMap[e.category] = e.suggestion
    }
  }

  const handleSaveImage = async () => {
    if (!reportRef.current) return
    try {
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(reportRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `compliance-report-${Date.now()}.png`
      a.click()
    } catch {
      alert('图片导出失败，请尝试打印为 PDF')
    }
  }

  const handlePrint = () => window.print()

  return (
    <div className={styles.reportWrapper} ref={reportRef}>
      {/* ── 报告头部 ── */}
      <header className={styles.header}>
        <h2 className={styles.title}>包装合规检测报告</h2>
        <div className={styles.metaRow}>
          <span>NO. {Date.now().toString(36).slice(-6).toUpperCase()}</span>
          <span>{new Date().toLocaleString('zh-CN')}</span>
        </div>
      </header>

      {/* ── 产品摘要 ── */}
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

      <div className={styles.divider} />

      {/* ── 检测结果总览表 ── */}
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
                  <td className={passed ? styles.cellOK : styles.cellFail}>
                    {passed ? '✓' : '✗'}
                  </td>
                  <td className={styles.cellSug}>
                    {!passed && sug ? sug : passed ? '—' : '待补充'}
                  </td>
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

      {/* ── 问题详述 ── */}
      {totalIssues > 0 && (
        <>
          <div className={styles.divider} />
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>问题详述</h3>

            {report.criticalErrors.map((e, i) => (
              <div key={`err-${i}`} className={styles.issueCard}>
                <div className={styles.issueHeader}>
                  <span className={styles.issueBadgeError}>错误</span>
                  <span className={styles.issueNum}>{i + 1}/{totalIssues}</span>
                  <span className={styles.issueCat}>{e.category}</span>
                </div>
                <p className={styles.issueMsg}>{e.message}</p>
                {e.position && <p className={styles.issueMeta}>📍 位置：{e.position}</p>}
                {e.regulation && <p className={styles.issueMeta}>📋 依据：{e.regulation}</p>}
                {e.suggestion && <p className={styles.issueSuggestion}>💡 建议：{e.suggestion}</p>}
                {e.referenceDoc && (
                  <p className={styles.issueMeta}>📄 参考文档：<RefLink docName={e.referenceDoc} /></p>
                )}
              </div>
            ))}

            {report.warnings.map((w, i) => (
              <div key={`warn-${i}`} className={styles.issueCard}>
                <div className={styles.issueHeader}>
                  <span className={styles.issueBadgeWarn}>预警</span>
                  <span className={styles.issueNum}>{report.criticalErrors.length + i + 1}/{totalIssues}</span>
                  <span className={styles.issueCat}>{w.category}</span>
                </div>
                <p className={styles.issueMsg}>{w.message}</p>
                {w.position && <p className={styles.issueMeta}>📍 位置：{w.position}</p>}
                {w.regulation && <p className={styles.issueMeta}>📋 依据：{w.regulation}</p>}
                {w.suggestion && <p className={styles.issueSuggestion}>💡 建议：{w.suggestion}</p>}
                {w.referenceDoc && (
                  <p className={styles.issueMeta}>📄 参考文档：<RefLink docName={w.referenceDoc} /></p>
                )}
              </div>
            ))}

            {report.typoIssues.map((t, i) => (
              <div key={`typo-${i}`} className={styles.issueCard}>
                <div className={styles.issueHeader}>
                  <span className={t.severity === 'error' ? styles.issueBadgeError : styles.issueBadgeWarn}>
                    错别字
                  </span>
                  <span className={styles.issueNum}>{report.criticalErrors.length + report.warnings.length + i + 1}/{totalIssues}</span>
                  <span className={styles.issueCat}>{t.category}</span>
                </div>
                <p className={styles.issueMsg}>
                  <span className={styles.typoWrong}>{t.wrong}</span>
                  {' → '}
                  <span className={styles.typoCorrect}>{t.correct}</span>
                </p>
                {t.message && <p className={styles.issueMsg}>{t.message}</p>}
                {t.position && <p className={styles.issueMeta}>📍 位置：{t.position}</p>}
              </div>
            ))}
          </section>
        </>
      )}

      <div className={styles.divider} />

      {/* ── 操作按钮 ── */}
      <section className={styles.actions}>
        <button className={styles.btnPrimary} onClick={handlePrint}>保存为 PDF</button>
        <button className={styles.btn} onClick={handleSaveImage}>保存为图片</button>
        {onDownloadJSON && (
          <button className={styles.btn} onClick={onDownloadJSON}>保存 JSON</button>
        )}
      </section>

      {/* ── 底部 ── */}
      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          <img src="/avatar.png" alt="" className={styles.footerAvatar} />
          <span className={styles.footerName}>元旦为你检测</span>
        </div>
        <p className={styles.footerMeta}>
          此检测基于 {modelName || 'Moonshot Vision'} 模型
        </p>
        <p className={styles.footerDisclaimer}>内容由 AI 生成，仅供参考</p>
      </footer>
    </div>
  )
}
