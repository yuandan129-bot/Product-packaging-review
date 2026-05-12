'use client'

import { useEffect } from 'react'
import styles from './ReportModal.module.css'

export default function ReportModal({ report, onClose }) {
  useEffect(() => {
    if (report) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [report])

  if (!report) return null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.close} onClick={onClose}>×</button>

        <h2 style={{ color: 'var(--text-primary)', fontSize: '24px', marginBottom: '30px', fontWeight: 700 }}>
          📋 审核报告
        </h2>

        {report.error ? (
          <p className={styles.error}>{report.error}</p>
        ) : (
          <div>
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>产品识别</h3>
              <p className={styles.sectionPara}>📌 产品名称: <strong>{report.productName || '未识别'}</strong></p>
              <p className={styles.sectionPara}>📋 执行标准: <strong>{report.standard || '未识别'}</strong></p>
            </section>

            {report.criticalErrors && report.criticalErrors.length > 0 && (
              <section className={`${styles.section} ${styles.critical}`}>
                <h3 className={`${styles.sectionTitle} ${styles.criticalTitle}`}>❌ 严重错误（必须修改）</h3>
                <ul className={styles.sectionList}>
                  {report.criticalErrors.map((err, i) => (
                    <li key={i} className={styles.sectionItem}>{err}</li>
                  ))}
                </ul>
              </section>
            )}

            {report.warnings && report.warnings.length > 0 && (
              <section className={`${styles.section} ${styles.warning}`}>
                <h3 className={`${styles.sectionTitle} ${styles.warningTitle}`}>⚠️ 风险预警（建议优化）</h3>
                <ul className={styles.sectionList}>
                  {report.warnings.map((warn, i) => (
                    <li key={i} className={styles.sectionItem}>{warn}</li>
                  ))}
                </ul>
              </section>
            )}

            {report.checklist && (
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>✅ 完整性清单</h3>
                <div className={styles.checklist}>
                  {Object.entries(report.checklist).map(([item, checked]) => (
                    <div key={item} className={styles.checkItem}>
                      <input type="checkbox" checked={checked} readOnly className={styles.checkInput} />
                      <label className={styles.checkLabel}>{item}</label>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {report.summary && (
              <div className={styles.summary}>
                <div className={styles.summaryItem}>
                  <div className={styles.summaryLabel}>总项数</div>
                  <div className={styles.summaryValue}>{report.summary.total}</div>
                </div>
                <div className={styles.summaryItem}>
                  <div className={styles.summaryLabel}>通过</div>
                  <div className={styles.summaryValue} style={{ color: 'var(--success)' }}>
                    {report.summary.passed}
                  </div>
                </div>
                <div className={styles.summaryItem}>
                  <div className={styles.summaryLabel}>未通过</div>
                  <div className={styles.summaryValue} style={{ color: 'var(--error)' }}>
                    {report.summary.failed}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
