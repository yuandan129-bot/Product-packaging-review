'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import styles from './report.module.css'

interface ComplianceIssue {
  severity: 'error' | 'warning'
  category: string
  message: string
}

interface TypoIssue {
  severity: 'error' | 'warning'
  category: string
  wrong: string
  correct: string
  message: string
}

interface ComplianceReport {
  productName: string
  category: string
  standard: string
  standardStatus: 'current' | 'expired' | 'error'
  criticalErrors: ComplianceIssue[]
  warnings: ComplianceIssue[]
  typoIssues: TypoIssue[]
  checklist: { [key: string]: boolean }
}

export default function ReportPage() {
  const router = useRouter()
  const [report, setReport] = useState<ComplianceReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedReport = sessionStorage.getItem('complianceReport')
    if (savedReport) {
      try {
        setReport(JSON.parse(savedReport))
      } catch (error) {
        console.error('报告解析失败:', error)
      }
    }
    setLoading(false)
  }, [])

  if (loading) {
    return (
      <main className={styles.container}>
        <div className={styles.loading}>加载中...</div>
      </main>
    )
  }

  if (!report) {
    return (
      <main className={styles.container}>
        <div className={styles.error}>
          <p>未找到报告数据</p>
          <button onClick={() => router.push('/home')}>返回上传</button>
        </div>
      </main>
    )
  }

  if ('error' in report && typeof report.error === 'string') {
    return (
      <main className={styles.container}>
        <div className={styles.error}>
          <p>审核失败</p>
          <p style={{ marginTop: 8, fontSize: 14 }}>{report.error}</p>
          <button onClick={() => router.push('/home')}>返回上传</button>
        </div>
      </main>
    )
  }

  const handleDownload = () => {
    const element = document.createElement('a')
    const file = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    })
    element.href = URL.createObjectURL(file)
    element.download = `compliance-report-${Date.now()}.json`
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  const handleNewReview = () => {
    sessionStorage.removeItem('complianceReport')
    router.push('/home')
  }

  return (
    <main className={styles.container}>
      {/* Desktop Background */}
      <div className={styles.desktopBackground}>
        <div className={styles.desktopGrid} />
      </div>

      {/* Main Content */}
      <div className={styles.content}>
        {/* Header */}
        <motion.header
          className={styles.header}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1>📋 包装背标合规体检报告</h1>
          <p className={styles.timestamp}>
            生成时间：{new Date().toLocaleString('zh-CN')}
          </p>
        </motion.header>

        {/* Sticky Notes Grid */}
        <div className={styles.stickyGrid}>
          {/* Product Summary Note */}
          <motion.div
            className={`${styles.stickyNote} ${styles.summaryNote}`}
            initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
            animate={{ opacity: 1, scale: 1, rotate: -2 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            whileHover={{ scale: 1.05, rotate: 0 }}
          >
            <div className={styles.noteHeader}>产品识别摘要</div>
            <div className={styles.noteContent}>
              <p>
                <strong>产品名称：</strong> {report.productName}
              </p>
              <p>
                <strong>分类属性：</strong> {report.category}
              </p>
              <p>
                <strong>执行标准：</strong> {report.standard}
                <span className={styles.statusBadge}>
                  {report.standardStatus === 'current' ? '现行' : '过期'}
                </span>
              </p>
            </div>
          </motion.div>

          {/* Critical Errors Notes */}
          {report.criticalErrors.length > 0 && (
            <>
              {report.criticalErrors.map((error, idx) => (
                <motion.div
                  key={`error-${idx}`}
                  className={`${styles.stickyNote} ${styles.errorNote}`}
                  initial={{ opacity: 0, scale: 0.8, rotate: 3 }}
                  animate={{ opacity: 1, scale: 1, rotate: idx % 2 === 0 ? -1 : 1 }}
                  transition={{ delay: 0.2 + idx * 0.1, duration: 0.5 }}
                  whileHover={{ scale: 1.05, rotate: 0 }}
                >
                  <div className={styles.noteHeader}>❌ {error.category}</div>
                  <div className={styles.noteContent}>
                    <p>{error.message}</p>
                  </div>
                </motion.div>
              ))}
            </>
          )}

          {/* Warnings Notes */}
          {report.warnings.length > 0 && (
            <>
              {report.warnings.map((warning, idx) => (
                <motion.div
                  key={`warning-${idx}`}
                  className={`${styles.stickyNote} ${styles.warningNote}`}
                  initial={{ opacity: 0, scale: 0.8, rotate: -3 }}
                  animate={{ opacity: 1, scale: 1, rotate: idx % 2 === 0 ? 1 : -1 }}
                  transition={{ delay: 0.4 + idx * 0.1, duration: 0.5 }}
                  whileHover={{ scale: 1.05, rotate: 0 }}
                >
                  <div className={styles.noteHeader}>⚠️ {warning.category}</div>
                  <div className={styles.noteContent}>
                    <p>{warning.message}</p>
                  </div>
                </motion.div>
              ))}
            </>
          )}

          {/* Typo Issues Notes */}
          {report.typoIssues && report.typoIssues.length > 0 && (
            <>
              {report.typoIssues.map((typo, idx) => (
                <motion.div
                  key={`typo-${idx}`}
                  className={`${styles.stickyNote} ${typo.severity === 'error' ? styles.errorNote : styles.warningNote}`}
                  initial={{ opacity: 0, scale: 0.8, rotate: -2 }}
                  animate={{ opacity: 1, scale: 1, rotate: idx % 2 === 0 ? -1 : 1 }}
                  transition={{ delay: 0.45 + idx * 0.1, duration: 0.5 }}
                  whileHover={{ scale: 1.05, rotate: 0 }}
                >
                  <div className={styles.noteHeader}>
                    {typo.severity === 'error' ? '❌' : '⚠️'} 错别字 — {typo.category}
                  </div>
                  <div className={styles.noteContent}>
                    <p>
                      <span style={{ textDecoration: 'line-through', color: 'var(--error)' }}>
                        {typo.wrong}
                      </span>
                      {' → '}
                      <span style={{ color: 'var(--success)', fontWeight: 540 }}>
                        {typo.correct}
                      </span>
                    </p>
                    <p style={{ fontSize: '14px', marginTop: '8px' }}>{typo.message}</p>
                  </div>
                </motion.div>
              ))}
            </>
          )}

          {/* Checklist Note */}
          <motion.div
            className={`${styles.stickyNote} ${styles.checklistNote}`}
            initial={{ opacity: 0, scale: 0.8, rotate: 2 }}
            animate={{ opacity: 1, scale: 1, rotate: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            whileHover={{ scale: 1.05, rotate: 0 }}
          >
            <div className={styles.noteHeader}>✓ 完整性清单</div>
            <div className={styles.noteContent}>
              <div className={styles.checklist}>
                {Object.entries(report.checklist).map(([item, checked]) => (
                  <label key={item} className={styles.checklistItem}>
                    <input type="checkbox" checked={checked} readOnly />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Action Buttons */}
        <motion.div
          className={styles.actions}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          <button className={`${styles.downloadBtn} ${styles.interactive}`} onClick={handleDownload}>
            📥 下载报告
          </button>
          <button className={`${styles.shareBtn} ${styles.interactive}`}>
            🔗 分享报告
          </button>
          <button className={`${styles.newBtn} ${styles.interactive}`} onClick={handleNewReview}>
            ➕ 新建审核
          </button>
        </motion.div>
      </div>
    </main>
  )
}
