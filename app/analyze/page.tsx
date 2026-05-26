'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import type { ComplianceReport } from '../../types/compliance'
import { getStats, getStatsSync, incrementReview } from '../../lib/usageStats'
import ReceiptReport from '../../components/ReceiptReport'
import styles from './analyze.module.css'

type PipelineType = 'deepseek' | 'kimi'
type StepId = 'extract' | 'classify' | 'analyze' | 'report'

interface StepDef {
  id: StepId
  label: string
  desc: string
}

interface ClassifiedBlock {
  content: string
  category: string
}

const STEPS: StepDef[] = [
  { id: 'extract', label: '视觉识别提取', desc: 'Doubao-Vision-Pro-32K 提取文字' },
  { id: 'classify', label: '智能分类整理', desc: 'AI 归类文字内容' },
  { id: 'analyze', label: '合规审核', desc: '逐项审核合规性' },
  { id: 'report', label: '生成审核报告', desc: '输出体检报告' },
]

let _logId = 0
function now(): string {
  const d = new Date()
  return d.toLocaleTimeString('zh-CN', { hour12: false })
}

interface LogEntry {
  id: number
  time: string
  text: string
  tag: string
}

export default function AnalyzePage() {
  const router = useRouter()
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [uploadedText, setUploadedText] = useState<string | null>(null)
  const [ocrText, setOcrText] = useState("")
  const [classifiedBlocks, setClassifiedBlocks] = useState<ClassifiedBlock[]>([])
  const [editableText, setEditableText] = useState("")
  const [isOcrRunning, setIsOcrRunning] = useState(false)
  const [isClassifying, setIsClassifying] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [activeStep, setActiveStep] = useState<StepId>('extract')
  const [pipeline, setPipeline] = useState<PipelineType>('deepseek')
  const [report, setReport] = useState<ComplianceReport | null>(null)
  const [reviewCount, setReviewCount] = useState(0)

  // 物理尺寸
  const [physicalWidth, setPhysicalWidth] = useState("")
  const [physicalHeight, setPhysicalHeight] = useState("")
  const [showDims, setShowDims] = useState(false)

  // 后台日志
  const [logs, setLogs] = useState<LogEntry[]>([])
  const logEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const isImageMode = !!uploadedImage
  const stepIdx = STEPS.findIndex((s) => s.id === activeStep)
  const initRef = useRef(false)
  const classifyAbortRef = useRef<AbortController | null>(null)


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
    if (initRef.current) return
    initRef.current = true

    const imageData = sessionStorage.getItem('uploadedImage')
    const textData = sessionStorage.getItem('uploadedText')

    if (imageData) {
      setUploadedImage(imageData)
      addLog('system', 'pipeline ready · image mode')
    } else if (textData) {
      setUploadedText(textData)
      setOcrText(textData)
      setEditableText(textData)
      addLog('system', 'pipeline ready · text mode')
      setActiveStep('classify')
      setIsClassifying(true)
      runClassify(textData)
    } else {
      router.push('/home')
      return
    }

    const savedWidth = sessionStorage.getItem('physicalWidth')
    const savedHeight = sessionStorage.getItem('physicalHeight')
    if (savedWidth) setPhysicalWidth(savedWidth)
    if (savedHeight) setPhysicalHeight(savedHeight)
    if (savedWidth || savedHeight) setShowDims(true)

    setReviewCount(getStatsSync().reviewCount)
    getStats().then((s) => setReviewCount(s.reviewCount))

    return () => {
      classifyAbortRef.current?.abort()
    }
  }, [])

  /* ── 视觉识别提取（Doubao-Vision-Pro-32K）── */
  const runOCR = async () => {
    if (!uploadedImage) return
    setIsOcrRunning(true)
    setActiveStep('extract')
    addLog('system', '── vision extraction started ──')
    addLog('vision', 'sending image to Doubao-Vision-Pro-32K...')

    try {
      const resp = await fetch('/api/ocr-doubao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: uploadedImage }),
      })

      const result = await resp.json()

      if (!resp.ok || result.error) {
        const errMsg = result.error || resp.statusText
        addLog('error', `✗ vision extraction failed: ${errMsg}`)
        alert(`视觉识别失败：${errMsg}`)
        setIsOcrRunning(false)
        setActiveStep('extract')
        return
      }

      const text = result.text || ''

      if (!text.trim()) {
        addLog('error', '✗ 视觉识别未提取到文字，请确认图片清晰度')
        alert('视觉识别未提取到文字，请确认图片清晰度')
        setIsOcrRunning(false)
        setActiveStep('extract')
        return
      }

      addLog('success', `✓ vision extraction complete · ${text.length} chars extracted`)
      setOcrText(text)
      setEditableText(text)
      setIsOcrRunning(false)

      // 识别完成 → 自动分类
      setActiveStep('classify')
      setIsClassifying(true)
      await runClassify(text)
    } catch (err: any) {
      addLog('error', `✗ vision extraction failed: ${err.message}`)
      setIsOcrRunning(false)
      setActiveStep('extract')
    }
  }

  /* ── 智能分类 ── */
  const runClassify = async (text: string) => {
    addLog('system', '── text classification started ──')
    addLog('analyze', 'sending text to DeepSeek classifier...')

    classifyAbortRef.current = new AbortController()
    const timeoutId = setTimeout(() => classifyAbortRef.current?.abort(), 30000)

    try {
      const resp = await fetch('/api/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 8000) }),
        signal: classifyAbortRef.current.signal,
      })
      clearTimeout(timeoutId)

      const result = await resp.json()

      if (result.error) {
        addLog('error', `✗ classify failed: ${result.error}`)
        setIsClassifying(false)
        setActiveStep(isImageMode ? 'extract' : 'classify')
        return
      }

      const blocks: ClassifiedBlock[] = result.blocks || []
      setClassifiedBlocks(blocks)
      addLog('success', `✓ classified · ${blocks.length} blocks`)

      // 在可编辑区按分类展示
      const formatted = blocks
        .map((b) => `【${b.category}】\n${b.content}`)
        .join("\n\n")
      setEditableText(formatted)
      setIsClassifying(false)
      setActiveStep('analyze')
    } catch (err: any) {
      clearTimeout(timeoutId)
      if (err.name === 'AbortError') return
      addLog('error', `✗ classify error: ${err.message}`)
      setIsClassifying(false)
      setActiveStep(isImageMode ? 'extract' : 'classify')
    }
  }

  /* ── 取消审核 ── */
  const handleCancel = () => {
    abortRef.current?.abort()
    setIsAnalyzing(false)
    setActiveStep('analyze')
    addLog('system', '── pipeline cancelled by user ──')
  }

  /* ── 合规审核 ── */
  const handleAnalyze = async () => {
    abortRef.current = new AbortController()
    setIsAnalyzing(true)
    setActiveStep('analyze')
    addLog('system', `── ${pipeline === 'kimi' ? 'Kimi' : 'DeepSeek'} compliance pipeline started ──`)

    sessionStorage.setItem('physicalWidth', physicalWidth)
    sessionStorage.setItem('physicalHeight', physicalHeight)

    const apiPath = pipeline === 'kimi' ? '/api/analyze-kimi' : '/api/analyze'
    addLog('network', `POST ${apiPath} → sending request...`)

    try {
      const body: any = {
        textBlocks: classifiedBlocks.length > 0 ? classifiedBlocks : parseEditableText(editableText),
        physicalWidth: physicalWidth || null,
        physicalHeight: physicalHeight || null,
      }

      // 品牌文件
      const brandFilesJson = sessionStorage.getItem('brandFiles')
      if (brandFilesJson) {
        body.brandFiles = JSON.parse(brandFilesJson)
        addLog('system', 'brand reference files attached')
      }

      const response = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: abortRef.current?.signal,
      })

      const result = await response.json()

      if (result.error) {
        addLog('error', `✗ ${result.error}`)
        alert(result.error)
        setIsAnalyzing(false)
        setActiveStep('analyze')
        return
      }

      addLog('success', '✓ review pipeline finished')
      setActiveStep('report')

      const totalIssues =
        (result.criticalErrors?.length || 0) + (result.warnings?.length || 0) + (result.typoIssues?.length || 0)
      addLog('system', `report: ${totalIssues} issues found · ${Object.values(result.checklist || {}).filter(Boolean).length}/${Object.keys(result.checklist || {}).length} checklist passed`)

      sessionStorage.setItem('complianceReport', JSON.stringify(result))
      incrementReview().then((newCount) => setReviewCount(newCount))

      setTimeout(() => {
        setReport(result)
        setIsAnalyzing(false)
      }, 600)
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        addLog('error', `✗ connection error: ${error.message}`)
        alert('分析失败，请检查网络后重试')
      }
      setIsAnalyzing(false)
      setActiveStep('analyze')
    }
  }

  /* ── 解析用户编辑后的文字为 blocks ── */
  const parseEditableText = (text: string): ClassifiedBlock[] => {
    const blocks: ClassifiedBlock[] = []
    const sections = text.split(/\n(?=【)/)
    for (const section of sections) {
      const match = section.match(/^【(.+?)】\n([\s\S]*)/)
      if (match) {
        blocks.push({ category: match[1], content: match[2].trim() })
      } else if (section.trim()) {
        blocks.push({ category: "其他", content: section.trim() })
      }
    }
    return blocks
  }

  /* ── 重新审核 ── */
  const handleReAnalyze = () => {
    setReport(null)
    setActiveStep('analyze')
  }

  const handleBack = () => {
    sessionStorage.removeItem('uploadedImage')
    sessionStorage.removeItem('uploadedText')
    sessionStorage.removeItem('physicalWidth')
    sessionStorage.removeItem('physicalHeight')
    router.push('/home')
  }

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

  /* ── 常量项渲染 ── */
  const renderStepNode = (_stepId: StepId, index: number) => {
    const currentIdx = STEPS.findIndex((s) => s.id === activeStep)
    const isDone = index < currentIdx
    const isActive = index === currentIdx

    if (isDone) {
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={styles.stepCheck}>
          <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    }
    if (isActive) {
      return <span className={`${styles.stepDot} ${isAnalyzing || isOcrRunning || isClassifying ? styles.stepNodePulse : ''}`} />
    }
    return <span className={styles.stepNum}>{index + 1}</span>
  }

  if (!uploadedImage && !uploadedText) return null

  /* ── 获取步骤状态 class ── */
  const getStepClass = (stepId: StepId, index: number) => {
    const currentIdx = STEPS.findIndex((s) => s.id === activeStep)
    if (index < currentIdx) return styles.stepNode_completed
    if (index === currentIdx) return styles.stepNode_active
    return styles.stepNode_pending
  }

  return (
    <main className={styles.shell}>
      <div className={styles.splitLayout}>
        {/* 左侧面板 */}
        <aside className={styles.splitLeft}>
          <div className={styles.splitSticky}>
            {/* 管道选择器 */}
            <div className={styles.pipelineSelector}>
              <button
                className={`${styles.pipelineTab} ${pipeline === 'deepseek' ? styles.pipelineTabActive : ''}`}
                onClick={() => !isAnalyzing && setPipeline('deepseek')}
                disabled={isAnalyzing}
              >
                Doubao-Vision-Pro-32K + DeepSeek
              </button>
              <button
                className={`${styles.pipelineTab} ${pipeline === 'kimi' ? styles.pipelineTabActive : ''}`}
                onClick={() => !isAnalyzing && setPipeline('kimi')}
                disabled={isAnalyzing}
              >
                Doubao-Vision-Pro-32K + Kimi
              </button>
            </div>

            {/* 步骤条 */}
            <div className={styles.stepper}>
              {STEPS.map((step, i) => (
                <div key={step.id} className={styles.stepWrapper}>
                  {i > 0 && (
                    <div
                      className={`${styles.stepLine} ${
                        i <= stepIdx ? styles.stepLineDone : ''
                      }`}
                    />
                  )}
                  <div className={`${styles.stepNode} ${getStepClass(step.id, i)}`}>
                    {renderStepNode(step.id, i)}
                  </div>
                  <div className={styles.stepText}>
                    <span className={`${styles.stepLabel} ${i > stepIdx ? styles.stepLabelPending : ''} ${i === stepIdx ? styles.stepLabelActive : ''}`}>
                      {step.label}
                    </span>
                    <span className={styles.stepDesc}>{step.desc}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* 图片预览（仅图片模式） */}
            {isImageMode && (
              <div className={styles.splitImagePreview}>
                <img src={uploadedImage!} alt="上传的图片" />
              </div>
            )}

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

            {/* 文字编辑区 */}
            <div className={styles.ocrSection}>
              <label className={styles.ocrLabel}>
                提取文字内容
                <span className={styles.ocrHint}>（可编辑修改，按分类格式： 【类别名】+ 内容）</span>
              </label>
              <textarea
                className={styles.ocrTextarea}
                value={editableText}
                onChange={(e) => setEditableText(e.target.value)}
                placeholder={isImageMode ? '点击下方"视觉识别提取文字"开始识别...' : '已粘贴的文字内容...'}
                rows={7}
                disabled={isOcrRunning || isAnalyzing}
              />
            </div>

            {/* 操作按钮 */}
            <div className={styles.actions}>
              {isAnalyzing ? (
                <>
                  <button className={styles.cancelButton} onClick={handleCancel}>
                    终止审核
                  </button>
                  <button className={styles.backButton} onClick={handleBack}>
                    返回首页
                  </button>
                </>
              ) : (
                <>
                  {isImageMode && !ocrText && (
                    <motion.button
                      className={styles.ocrButton}
                      onClick={runOCR}
                      disabled={isOcrRunning}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      {isOcrRunning ? (
                        <span className={styles.btnLoading}>
                          <span className={styles.spinner} />
                          文字提取中...
                        </span>
                      ) : (
                        '视觉识别提取文字'
                      )}
                    </motion.button>
                  )}
                  {(ocrText || uploadedText) && (
                    <motion.button
                      className={styles.analyzeButton}
                      onClick={handleAnalyze}
                      disabled={isClassifying || !editableText.trim()}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      {isClassifying ? (
                        <span className={styles.btnLoading}>
                          <span className={styles.spinner} />
                          分类整理中...
                        </span>
                      ) : (
                        `开始合规审核 (${pipeline === 'kimi' ? 'Kimi' : 'DeepSeek'})`
                      )}
                    </motion.button>
                  )}
                  <motion.button
                    className={styles.backButton}
                    onClick={handleBack}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    返回
                  </motion.button>
                </>
              )}
            </div>

            {/* 使用统计 */}
            <p className={styles.splitCounter}>已累计审核 {reviewCount} 次</p>
          </div>
        </aside>

        {/* 右侧面板 */}
        <section className={styles.splitRight}>
          {report ? (
            <ReceiptReport
              report={report}
              modelName={pipeline === 'kimi' ? 'Kimi' : 'DeepSeek'}
              onDownloadJSON={handleDownloadJSON}
            />
          ) : (
            <div className={styles.reportPlaceholder}>
              <div className={styles.reportPlaceholderIcon}>∥∥∥∥∥∥∥∥∥</div>
              <p className={styles.reportPlaceholderText}>
                {isImageMode && !ocrText
                  ? '点击左侧"视觉识别提取文字"开始识别'
                  : '点击"开始合规审核"生成体检报告'}
              </p>
              <p className={styles.reportPlaceholderHint}>
                {pipeline === 'kimi' ? '审核引擎：Kimi K2.5' : '审核引擎：DeepSeek'}
              </p>
            </div>
          )}
        </section>
      </div>

      {/* 右侧实时控制台 */}
      <div className={`${styles.console} ${(isOcrRunning || isClassifying || isAnalyzing) ? styles.consoleLive : ''}`} aria-hidden={!(isOcrRunning || isClassifying || isAnalyzing)}>
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
