'use client'

import { useState } from 'react'
import type { ComplianceReport } from '../types/compliance'
import styles from './ReceiptReport.module.css'

interface BrandFile {
  name: string
  type: string
  content: string
}

interface Props {
  report: ComplianceReport
  onDownloadJSON?: () => void
  onPrint?: () => void
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

  if (!match) {
    return <span className={styles.refPlain}>{docName}</span>
  }

  if (!isText) {
    return <span className={styles.refPlain}>{docName} (图片)</span>
  }

  return (
    <span>
      <span className={styles.refLink} onClick={() => setExpanded(!expanded)}>
        {expanded ? '▾' : '▸'} {docName}
      </span>
      {expanded && (
        <pre className={styles.refPreview}>
          {match.content.slice(0, 500)}
          {match.content.length > 500 && '\n...'}
        </pre>
      )}
    </span>
  )
}

export default function ReceiptReport({ report, onDownloadJSON, onPrint }: Props) {
  const hasBrandFiles = getBrandFiles().length > 0
  const totalIssues =
    (report.criticalErrors?.length || 0) +
    (report.warnings?.length || 0) +
    (report.typoIssues?.length || 0)

  return (
    <div className={styles.receipt}>
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.title}>包装背标合规体检报告</h2>
        <div className={styles.meta}>
          {new Date().toLocaleString('zh-CN')}
          {' · '}
          NO. {Date.now().toString(36).slice(-6).toUpperCase()}
        </div>
      </div>

      {/* Product Summary */}
      <div className={styles.divider} />
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>产品识别摘要</h3>
        <table className={styles.table}>
          <tbody>
            <tr><td className={styles.label}>产品名称</td><td>{report.productName}</td></tr>
            <tr><td className={styles.label}>分类属性</td><td>{report.category}</td></tr>
            <tr>
              <td className={styles.label}>执行标准</td>
              <td>
                {report.standard}
                <span className={report.standardStatus === 'current' ? styles.badgeOK : styles.badgeNG}>
                  {report.standardStatus === 'current' ? '现行' : report.standardStatus === 'expired' ? '过期' : '错误'}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Critical Errors */}
      {report.criticalErrors.length > 0 && (
        <>
          <div className={styles.divider} />
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>严重错误 · 必须修改</h3>
            {report.criticalErrors.map((e, i) => (
              <div key={i} className={`${styles.item} ${styles.itemError}`}>
                <div className={styles.itemHead}>
                  <span className={`${styles.badge} ${styles.badgeError}`}>ERR</span>
                  <span className={styles.itemCat}>{e.category}</span>
                </div>
                <p className={styles.itemMsg}>{e.message}</p>
                {e.position && <p className={styles.itemPos}>📍 {e.position}</p>}
                {e.referenceDoc && hasBrandFiles && (
                  <p className={styles.itemRef}><RefLink docName={e.referenceDoc} /></p>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Warnings */}
      {report.warnings.length > 0 && (
        <>
          <div className={styles.divider} />
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>风险预警 · 建议优化</h3>
            {report.warnings.map((w, i) => (
              <div key={i} className={`${styles.item} ${styles.itemWarn}`}>
                <div className={styles.itemHead}>
                  <span className={`${styles.badge} ${styles.badgeWarn}`}>WARN</span>
                  <span className={styles.itemCat}>{w.category}</span>
                </div>
                <p className={styles.itemMsg}>{w.message}</p>
                {w.position && <p className={styles.itemPos}>📍 {w.position}</p>}
                {w.referenceDoc && hasBrandFiles && (
                  <p className={styles.itemRef}><RefLink docName={w.referenceDoc} /></p>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Typo Issues */}
      {report.typoIssues.length > 0 && (
        <>
          <div className={styles.divider} />
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>错别字纠正</h3>
            {report.typoIssues.map((t, i) => (
              <div key={i} className={`${styles.item} ${t.severity === 'error' ? styles.itemError : styles.itemWarn}`}>
                <div className={styles.itemHead}>
                  <span className={`${styles.badge} ${t.severity === 'error' ? styles.badgeError : styles.badgeWarn}`}>
                    {t.severity === 'error' ? 'ERR' : 'WARN'}
                  </span>
                  <span className={styles.itemCat}>{t.category}</span>
                </div>
                <p className={styles.itemMsg}>
                  <span className={styles.typoWrong}>{t.wrong}</span>
                  {' → '}
                  <span className={styles.typoCorrect}>{t.correct}</span>
                </p>
                {t.message && <p className={styles.itemMsg}>{t.message}</p>}
                {t.position && <p className={styles.itemPos}>📍 {t.position}</p>}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Checklist */}
      <div className={styles.divider} />
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>完整性清单</h3>
        <div className={styles.checklist}>
          {Object.entries(report.checklist).map(([item, checked]) => (
            <span key={item} className={styles.checkItem}>
              <span className={checked ? styles.checkOK : styles.checkFail}>
                {checked ? '✓' : '✗'}
              </span>
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className={styles.divider} />
      <div className={styles.footer}>
        {totalIssues > 0 ? (
          <p className={styles.footerSummary}>
            共发现 {report.criticalErrors.length} 项严重错误、{report.warnings.length} 项风险预警、{report.typoIssues.length} 项错别字
          </p>
        ) : (
          <p className={styles.footerSummary}>未发现合规问题 ✓</p>
        )}

        <div className={styles.footerActions}>
          {onDownloadJSON && (
            <button className={styles.btn} onClick={onDownloadJSON}>保存 JSON</button>
          )}
          {onPrint && (
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onPrint}>打印报告</button>
          )}
        </div>
        <p className={styles.footerThanks}>谢谢使用 · THANK YOU</p>
      </div>
    </div>
  )
}
