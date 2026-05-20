'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import type { ComplianceReport } from '../../types/compliance'
import { getStats, getStatsSync, incrementReview } from '../../lib/usageStats'
import ReceiptReport from '../../components/ReceiptReport'
import styles from './analyze.module.css'

type StepId = 'upload' | 'vision' | 'analyze' | 'report'
type StepStatus = 'pending' | 'active' | 'completed'
type PipelineType = 'dual' | 'kimi'
type ViewMode = 'analyze' | 'report'

interface StepDef {
  id: StepId
  label: string
  desc: string
}

interface LogEntry {
  id: number
  time: string
  text: string
  tag: string
}

const DUAL_STEPS: StepDef[] = [
  { id: 'upload', label: '图片上传', desc: '上传包装图片' },
  { id: 'vision', label: 'Qwen-VL 视觉识别', desc: 'AI 提取文字与空间信息' },
  { id: 'analyze', label: 'DeepSeek 合规分析', desc: '逐项审核合规性' },
  { id: 'report', label: '生成审核报告', desc: '输出体检报告' },
]

const KIMI_STEPS: StepDef[] = [
  { id: 'upload', label: '图片上传', desc: '上传包装图片' },
  { id: 'vision', label: 'Moonshot 视觉解析', desc: '多模态提取文字与布局' },
  { id: 'analyze', label: 'Moonshot 合规审核', desc: '逐项审核合规性' },
  { id: 'report', label: '生成审核报告', desc: '输出体检报告' },
]

/* ── 原有管道日志 ── */
const VISION_LOGS: { delay: number; text: string; tag: string }[] = [
  { delay: 0, text: 'initializing review pipeline', tag: 'system' },
  { delay: 400, text: 'connecting to Qwen-VL endpoint...', tag: 'network' },
  { delay: 800, text: 'encoding image ▸ compress to 2048px', tag: 'vision' },
  { delay: 1200, text: 'extracting text regions via vision model...', tag: 'vision' },
  { delay: 1800, text: 'processing spatial layout analysis...', tag: 'vision' },
  { delay: 2400, text: 'classifying text categories...', tag: 'vision' },
  { delay: 3000, text: '✓ vision extraction complete · 23 blocks', tag: 'success' },
]

const ANALYZE_LOGS: { delay: number; text: string; tag: string }[] = [
  { delay: 0, text: 'invoking DeepSeek compliance engine...', tag: 'system' },
  { delay: 600, text: '▸ audit — mandatory labeling items (9项)', tag: 'analyze' },
  { delay: 1200, text: '▸ scan — advertising law prohibited terms', tag: 'analyze' },
  { delay: 1800, text: '▸ detect — typographical errors & misprints', tag: 'analyze' },
  { delay: 2400, text: '▸ validate — nutrition facts table format', tag: 'analyze' },
  { delay: 3000, text: '▸ verify — ingredient list ordering', tag: 'analyze' },
  { delay: 3600, text: '▸ check — executive standard validity', tag: 'analyze' },
  { delay: 4200, text: '✓ compliance analysis complete', tag: 'success' },
]

/* ── Kimi 管道日志 ── */
const KIMI_VISION_LOGS: { delay: number; text: string; tag: string }[] = [
  { delay: 0, text: 'initializing Kimi K2.5 pipeline', tag: 'system' },
  { delay: 400, text: 'connecting to moonshot.ai endpoint...', tag: 'network' },
  { delay: 800, text: 'encoding image for MoonViT encoder', tag: 'vision' },
  { delay: 1200, text: 'MoonViT processing ▸ visual tokens', tag: 'vision' },
  { delay: 1800, text: 'extracting text & spatial layout...', tag: 'vision' },
  { delay: 2400, text: 'classifying label categories...', tag: 'vision' },
  { delay: 3000, text: '✓ multimodal extraction complete', tag: 'success' },
]

const KIMI_ANALYZE_LOGS: { delay: number; text: string; tag: string }[] = [
  { delay: 0, text: 'Kimi K2.5 compliance reasoning...', tag: 'system' },
  { delay: 600, text: '▸ audit — mandatory labeling items (9项)', tag: 'analyze' },
  { delay: 1200, text: '▸ scan — advertising law prohibited terms', tag: 'analyze' },
  { delay: 1800, text: '▸ detect — typographical errors & misprints', tag: 'analyze' },
  { delay: 2400, text: '▸ validate — nutrition facts table format', tag: 'analyze' },
  { delay: 3000, text: '▸ verify — ingredient list ordering', tag: 'analyze' },
  { delay: 3600, text: '▸ check — executive standard validity', tag: 'analyze' },
  { delay: 4200, text: '✓ compliance analysis complete', tag: 'success' },
]

let _logId = 0
function now(): string {
  const d = new Date()
  return d.toLocaleTimeString('zh-CN', { hour12: false })
}

export default function AnalyzePage() {
  const router = useRouter()
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [activeStep, setActiveStep] = useState<StepId>('upload')
  const [pipeline, setPipeline] = useState<PipelineType>('kimi')
  const [viewMode, setViewMode] = useState<ViewMode>('analyze')
  const [report, setReport] = useState<ComplianceReport | null>(null)
  const [reviewCount, setReviewCount] = useState(0)

  const currentSteps = pipeline === 'kimi' ? KIMI_STEPS : DUAL_STEPS
  const isReportReady = viewMode === 'report' && report

  // 物理尺寸
  const [physicalWidth, setPhysicalWidth] = useState("")
  const [physicalHeight, setPhysicalHeight] = useState("")
  const [showDims, setShowDims] = useState(false)

  // 后台日志
  const [logs, setLogs] = useState<LogEntry[]>([])
  const logEndRef = useRef<HTMLDivElement>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const addLog = useCallback((tag: string, text: string) => {
    setLogs((prev) => {
      const next = [...prev, { id: ++_logId, time: now(), text, tag }]
      return next.length > 80 ? next.slice(-60) : next
    })
  }, [])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  useEffect(() => {
    const imageData = sessionStorage.getItem('uploadedImage')
    if (imageData) {
      setUploadedImage(imageData)
    } else {
      router.push('/home')
    }

    const savedWidth = sessionStorage.getItem('physicalWidth')
    const savedHeight = sessionStorage.getItem('physicalHeight')
    if (savedWidth) setPhysicalWidth(savedWidth)
    if (savedHeight) setPhysicalHeight(savedHeight)
    if (savedWidth || savedHeight) setShowDims(true)

    addLog('system', 'pipeline ready · waiting for input')
    setReviewCount(getStatsSync().reviewCount)
    getStats().then((s) => setReviewCount(s.reviewCount))

    return () => {
      timersRef.current.forEach(clearTimeout)
    }
  }, [router])

  const getStepStatus = (stepId: StepId): StepStatus => {
    const idx = currentSteps.findIndex((s) => s.id === stepId)
    const activeIdx = currentSteps.findIndex((s) => s.id === activeStep)
    if (idx < activeIdx) return 'completed'
    if (idx === activeIdx) return 'active'
    return 'pending'
  }

  /* ── 原有双模型管道 ── */
  const runDualPipeline = async () => {
    setActiveStep('vision')
    addLog('system', '── dual-model pipeline started ──')

    sessionStorage.setItem('physicalWidth', physicalWidth)
    sessionStorage.setItem('physicalHeight', physicalHeight)

    const t1: ReturnType<typeof setTimeout>[] = []
    for (const l of VISION_LOGS) {
      t1.push(setTimeout(() => addLog(l.tag, l.text), l.delay))
    }
    const t1Done = setTimeout(() => setActiveStep('analyze'), 3500)
    timersRef.current = [...t1, t1Done]

    try {
      const blob = await compressImage(uploadedImage!, 2048, 0.7)
      addLog('system', `image compressed ▸ ${(blob.size / 1024).toFixed(1)}KB`)

      const formData = buildFormData(blob)
      addLog('network', 'POST /api/analyze → sending request...')

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      t1.forEach(clearTimeout)
      clearTimeout(t1Done)
      setActiveStep('analyze')

      const t2: ReturnType<typeof setTimeout>[] = []
      for (const l of ANALYZE_LOGS) {
        t2.push(setTimeout(() => addLog(l.tag, l.text), l.delay))
      }

      if (result.error) {
        addLog('error', `✗ ${result.error}`)
        alert(result.error)
        setIsAnalyzing(false)
        setActiveStep('upload')
        return
      }

      finishAndShowReport(result)
    } catch (error: any) {
      addLog('error', `✗ connection error: ${error.message}`)
      console.error('分析错误:', error)
      alert('分析失败，请检查网络后重试')
      setIsAnalyzing(false)
      setActiveStep('upload')
    }
  }

  /* ── Moonshot Vision管道 ── */
  const runKimiPipeline = async () => {
    setActiveStep('vision')
    addLog('system', '── Kimi K2.5 multimodal pipeline started ──')

    sessionStorage.setItem('physicalWidth', physicalWidth)
    sessionStorage.setItem('physicalHeight', physicalHeight)

    const t1: ReturnType<typeof setTimeout>[] = []
    for (const l of KIMI_VISION_LOGS) {
      t1.push(setTimeout(() => addLog(l.tag, l.text), l.delay))
    }
    const t1Done = setTimeout(() => setActiveStep('analyze'), 3500)
    timersRef.current = [...t1, t1Done]

    try {
      const blob = await compressImage(uploadedImage!, 2048, 0.6)
      addLog('system', `image compressed ▸ ${(blob.size / 1024).toFixed(1)}KB`)

      const formData = buildFormData(blob)
      addLog('network', 'POST /api/analyze-kimi → sending request...')

      const response = await fetch('/api/analyze-kimi', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      t1.forEach(clearTimeout)
      clearTimeout(t1Done)
      setActiveStep('analyze')

      const t2: ReturnType<typeof setTimeout>[] = []
      for (const l of KIMI_ANALYZE_LOGS) {
        t2.push(setTimeout(() => addLog(l.tag, l.text), l.delay))
      }

      if (result.error) {
        addLog('error', `✗ ${result.error}`)
        alert(result.error)
        setIsAnalyzing(false)
        setActiveStep('upload')
        return
      }

      finishAndShowReport(result)
    } catch (error: any) {
      addLog('error', `✗ connection error: ${error.message}`)
      console.error('Kimi 分析错误:', error)
      alert('Kimi 分析失败，请检查网络或切换到双模型管道重试')
      setIsAnalyzing(false)
      setActiveStep('upload')
    }
  }

  /* ── 图片压缩工具 ── */
  const compressImage = (dataUrl: string, maxPx: number, quality: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxPx || height > maxPx) {
          const ratio = Math.min(maxPx / width, maxPx / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('压缩失败'))),
          'image/jpeg',
          quality
        )
      }
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = dataUrl
    })
  }

  /* ── 构建 FormData ── */
  const buildFormData = (blob: Blob): FormData => {
    const fd = new FormData()
    fd.append('file', blob, 'upload.jpg')

    if (physicalWidth && physicalHeight) {
      fd.append('physicalWidth', physicalWidth)
      fd.append('physicalHeight', physicalHeight)
      addLog('system', `physical dimensions: ${physicalWidth}×${physicalHeight}mm`)
    }

    const brandFilesJson = sessionStorage.getItem('brandFiles')
    if (brandFilesJson) {
      fd.append('brandFiles', brandFilesJson)
      addLog('system', 'brand reference files attached')
    }

    return fd
  }

  /* ── 完成并内联显示报告 ── */
  const finishAndShowReport = (result: ComplianceReport) => {
    addLog('success', '✓ review pipeline finished')
    setActiveStep('report')

    const totalIssues =
      (result.criticalErrors?.length || 0) + (result.warnings?.length || 0) + (result.typoIssues?.length || 0)
    addLog('system', `report: ${totalIssues} issues found · ${Object.values(result.checklist || {}).filter(Boolean).length}/${Object.keys(result.checklist || {}).length} checklist passed`)

    // 保存到 sessionStorage（兼容独立 report 页面）
    sessionStorage.setItem('complianceReport', JSON.stringify(result))

    // 更新使用统计
    incrementReview().then((newCount) => setReviewCount(newCount))

    // 切换到报告视图
    setTimeout(() => {
      setReport(result)
      setViewMode('report')
      setIsAnalyzing(false)
    }, 600)
  }

  /* ── 总入口 ── */
  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    setReport(null)
    if (pipeline === 'kimi') {
      await runKimiPipeline()
    } else {
      await runDualPipeline()
    }
  }

  /* ── 重新审核 ── */
  const handleReAnalyze = () => {
    setViewMode('analyze')
    setReport(null)
    setActiveStep('upload')
    setLogs([])
  }

  const handleBack = () => {
    sessionStorage.removeItem('uploadedImage')
    sessionStorage.removeItem('physicalWidth')
    sessionStorage.removeItem('physicalHeight')
    router.push('/home')
  }

  /* ── 报告操作 ── */
  const handleDownloadJSON = () => {
    if (!report) return
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `compliance-report-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlePrint = () => {
    window.print()
  }

  if (!uploadedImage) return null

  /* ── 报告就绪：双栏布局 ── */
  if (isReportReady) {
    return (
      <main className={styles.shell}>
        <div className={styles.splitLayout}>
          {/* 左侧面板 */}
          <aside className={styles.splitLeft}>
            <div className={styles.splitSticky}>
              {/* 管道选择器（只读） */}
              <div className={styles.pipelineSelector}>
                <button className={`${styles.pipelineTab} ${pipeline === 'kimi' ? styles.pipelineTabActive : ''}`} disabled>
                  Moonshot Vision
                </button>
                <button className={`${styles.pipelineTab} ${pipeline === 'dual' ? styles.pipelineTabActive : ''}`} disabled>
                  Qwen + DeepSeek
                </button>
              </div>

              {/* 图片预览 */}
              <div className={styles.splitImagePreview}>
                <img src={uploadedImage} alt="上传的图片" />
              </div>

              {/* 操作按钮 */}
              <div className={styles.splitActions}>
                <button className={styles.splitBtn} onClick={handleReAnalyze}>重新审核</button>
                <button className={styles.splitBtnOutline} onClick={handleBack}>返回首页</button>
              </div>

              {/* 使用统计 */}
              <p className={styles.splitCounter}>已累计审核 {reviewCount} 次</p>
            </div>
          </aside>

          {/* 右侧报告面板 */}
          <section className={styles.splitRight}>
            <ReceiptReport
              report={report}
              onDownloadJSON={handleDownloadJSON}
              onPrint={handlePrint}
            />
          </section>
        </div>
      </main>
    )
  }

  /* ── 分析前的单栏布局 ── */
  return (
    <main className={styles.shell}>
      <motion.div
        className={styles.main}
        animate={{ x: isAnalyzing ? -120 : 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className={styles.content}>
          {/* 管道选择器 */}
          <div className={styles.pipelineSelector}>
            <button
              className={`${styles.pipelineTab} ${pipeline === 'kimi' ? styles.pipelineTabActive : ''}`}
              onClick={() => !isAnalyzing && setPipeline('kimi')}
              disabled={isAnalyzing}
            >
              Moonshot Vision
            </button>
            <button
              className={`${styles.pipelineTab} ${pipeline === 'dual' ? styles.pipelineTabActive : ''}`}
              onClick={() => !isAnalyzing && setPipeline('dual')}
              disabled={isAnalyzing}
            >
              Qwen + DeepSeek
            </button>
          </div>

          {/* 步骤条 */}
          <div className={styles.stepper}>
            {currentSteps.map((step, i) => {
              const status = getStepStatus(step.id)
              return (
                <div key={step.id} className={styles.stepWrapper}>
                  {i > 0 && (
                    <div
                      className={`${styles.stepLine} ${
                        status !== 'pending' || getStepStatus(currentSteps[i - 1].id) === 'completed'
                          ? styles.stepLineDone : ''
                      }`}
                    />
                  )}
                  <div
                    className={`${styles.stepNode} ${styles[`stepNode_${status}`]} ${
                      isAnalyzing && status === 'active' ? styles.stepNodePulse : ''
                    }`}
                  >
                    {status === 'completed' ? (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={styles.stepCheck}>
                        <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : status === 'active' ? (
                      <span className={styles.stepDot} />
                    ) : (
                      <span className={styles.stepNum}>{i + 1}</span>
                    )}
                  </div>
                  <div className={styles.stepText}>
                    <span className={`${styles.stepLabel} ${status === 'pending' ? styles.stepLabelPending : ''} ${status === 'active' ? styles.stepLabelActive : ''}`}>
                      {step.label}
                    </span>
                    <span className={styles.stepDesc}>{step.desc}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* 图片预览 */}
          <div className={styles.imagePreview}>
            <img src={uploadedImage} alt="上传的图片" />
          </div>

          {/* 物理尺寸 */}
          <div className={styles.dimensionsSection}>
            <button className={styles.dimToggle} onClick={() => setShowDims(!showDims)}>
              {showDims ? '−' : '+'} 包装物理尺寸
              <span className={styles.dimToggleHint}>
                {showDims ? '(可选，收起)' : '(可选，用于检查文字高度 ≥ 1.8mm)'}
              </span>
            </button>
            {showDims && (
              <motion.div
                className={styles.dimRow}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.3 }}
              >
                <div className={styles.dimInput}>
                  <label className={styles.dimLabel}>宽度 (mm)</label>
                  <input type="number" className={styles.input} value={physicalWidth}
                    onChange={(e) => setPhysicalWidth(e.target.value)}
                    placeholder="如 200" min={1} max={2000} disabled={isAnalyzing} />
                </div>
                <span className={styles.dimSep}>×</span>
                <div className={styles.dimInput}>
                  <label className={styles.dimLabel}>高度 (mm)</label>
                  <input type="number" className={styles.input} value={physicalHeight}
                    onChange={(e) => setPhysicalHeight(e.target.value)}
                    placeholder="如 150" min={1} max={2000} disabled={isAnalyzing} />
                </div>
              </motion.div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className={styles.actions}>
            <motion.button className={styles.analyzeButton} onClick={handleAnalyze}
              disabled={isAnalyzing}
              whileHover={isAnalyzing ? {} : { scale: 1.05 }}
              whileTap={isAnalyzing ? {} : { scale: 0.95 }}>
              <AnimatePresence mode="wait">
                {isAnalyzing ? (
                  <motion.span key="loading" className={styles.btnLoading}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <span className={styles.spinner} />审核中...
                  </motion.span>
                ) : (
                  <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    开始审核
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
            <motion.button className={styles.backButton} onClick={handleBack}
              disabled={isAnalyzing}
              whileHover={isAnalyzing ? {} : { scale: 1.05 }}
              whileTap={isAnalyzing ? {} : { scale: 0.95 }}>
              返回
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* 右侧实时控制台 */}
      <div className={`${styles.console} ${isAnalyzing ? styles.consoleLive : ''}`} aria-hidden={!isAnalyzing}>
        <div className={styles.consoleFadeTop} />
        <div className={styles.consoleBody}>
          {logs.length === 0 && (
            <div className={styles.consoleIdle}>
              <span className={styles.consoleCursor}>▍</span>
              <span>awaiting pipeline...</span>
            </div>
          )}
          {logs.map((l) => (
            <div key={l.id} className={`${styles.consoleLine} ${styles[`consoleTag_${l.tag}`] || ''}`}>
              <span className={styles.consoleTime}>{l.time}</span>
              <span className={styles.consoleTag}>{l.tag}</span>
              <span className={styles.consoleText}>{l.text}</span>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
        <div className={styles.consoleFadeBottom} />
      </div>
    </main>
  )
}
