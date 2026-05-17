'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import styles from './analyze.module.css'

type StepId = 'upload' | 'vision' | 'analyze' | 'report'
type StepStatus = 'pending' | 'active' | 'completed'

interface StepDef {
  id: StepId
  label: string
  desc: string
}

const STEPS: StepDef[] = [
  { id: 'upload', label: '图片上传', desc: '上传包装图片' },
  { id: 'vision', label: 'Qwen-VL 视觉识别', desc: 'AI 提取文字与空间信息' },
  { id: 'analyze', label: 'DeepSeek 合规分析', desc: '逐项审核合规性' },
  { id: 'report', label: '生成审核报告', desc: '输出体检报告' },
]

export default function AnalyzePage() {
  const router = useRouter()
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [activeStep, setActiveStep] = useState<StepId>('upload')

  // 物理尺寸（mm），可选
  const [physicalWidth, setPhysicalWidth] = useState("")
  const [physicalHeight, setPhysicalHeight] = useState("")
  const [showDims, setShowDims] = useState(false)

  const visionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const imageData = sessionStorage.getItem('uploadedImage')
    if (imageData) {
      setUploadedImage(imageData)
    } else {
      router.push('/home')
    }

    // 恢复之前输入的物理尺寸
    const savedWidth = sessionStorage.getItem('physicalWidth')
    const savedHeight = sessionStorage.getItem('physicalHeight')
    if (savedWidth) setPhysicalWidth(savedWidth)
    if (savedHeight) setPhysicalHeight(savedHeight)
    if (savedWidth || savedHeight) setShowDims(true)

    return () => {
      if (visionTimerRef.current) clearTimeout(visionTimerRef.current)
    }
  }, [router])

  const getStepStatus = (stepId: StepId): StepStatus => {
    const idx = STEPS.findIndex((s) => s.id === stepId)
    const activeIdx = STEPS.findIndex((s) => s.id === activeStep)
    if (idx < activeIdx) return 'completed'
    if (idx === activeIdx) return 'active'
    return 'pending'
  }

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    setActiveStep('vision')

    // 保存物理尺寸到 sessionStorage
    sessionStorage.setItem('physicalWidth', physicalWidth)
    sessionStorage.setItem('physicalHeight', physicalHeight)

    // Qwen-VL 视觉提取阶段约 2-3 秒
    visionTimerRef.current = setTimeout(() => {
      setActiveStep('analyze')
    }, 3000)

    try {
      const compressImage = (dataUrl: string): Promise<Blob> => {
        return new Promise((resolve, reject) => {
          const img = new Image()
          img.onload = () => {
            let { width, height } = img
            const max = 2048
            if (width > max || height > max) {
              const ratio = Math.min(max / width, max / height)
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
              0.7
            )
          }
          img.onerror = () => reject(new Error('图片加载失败'))
          img.src = dataUrl
        })
      }

      const blob = await compressImage(uploadedImage!)
      const formData = new FormData()
      formData.append('file', blob, 'upload.jpg')

      // 附加物理尺寸
      if (physicalWidth && physicalHeight) {
        formData.append('physicalWidth', physicalWidth)
        formData.append('physicalHeight', physicalHeight)
      }

      const brandFilesJson = sessionStorage.getItem('brandFiles')
      if (brandFilesJson) {
        formData.append('brandFiles', brandFilesJson)
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      })
      const result = await response.json()

      if (result.error) {
        alert(result.error)
        setIsAnalyzing(false)
        setActiveStep('upload')
        return
      }

      setActiveStep('report')

      setTimeout(() => {
        sessionStorage.setItem('complianceReport', JSON.stringify(result))
        router.push('/report')
      }, 600)
    } catch (error) {
      console.error('分析错误:', error)
      alert('分析失败，请检查网络后重试')
      setIsAnalyzing(false)
      setActiveStep('upload')
    }
  }

  const handleBack = () => {
    sessionStorage.removeItem('uploadedImage')
    sessionStorage.removeItem('physicalWidth')
    sessionStorage.removeItem('physicalHeight')
    router.push('/home')
  }

  if (!uploadedImage) {
    return null
  }

  return (
    <main className={styles.container}>
      <motion.div
        className={styles.content}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        {/* ---- 流程步骤指示器 ---- */}
        <div className={styles.stepper}>
          {STEPS.map((step, i) => {
            const status = getStepStatus(step.id)
            return (
              <div key={step.id} className={styles.stepWrapper}>
                {i > 0 && (
                  <div
                    className={`${styles.stepLine} ${
                      status !== 'pending' || getStepStatus(STEPS[i - 1].id) === 'completed'
                        ? styles.stepLineDone
                        : ''
                    }`}
                  />
                )}
                <div
                  className={`${styles.stepNode} ${styles[`stepNode_${status}`]} ${
                    isAnalyzing && status === 'active' ? styles.stepNodePulse : ''
                  }`}
                >
                  {status === 'completed' ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      className={styles.stepCheck}
                    >
                      <path
                        d="M3 8l3.5 3.5L13 5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : status === 'active' ? (
                    <span className={styles.stepDot} />
                  ) : (
                    <span className={styles.stepNum}>{i + 1}</span>
                  )}
                </div>
                <div className={styles.stepText}>
                  <span
                    className={`${styles.stepLabel} ${
                      status === 'pending' ? styles.stepLabelPending : ''
                    } ${status === 'active' ? styles.stepLabelActive : ''}`}
                  >
                    {step.label}
                  </span>
                  <span className={styles.stepDesc}>{step.desc}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* ---- 图片预览 ---- */}
        <div className={styles.imagePreview}>
          <img src={uploadedImage} alt="上传的图片" />
        </div>

        {/* ---- 物理尺寸（可选，用于文字高度合规检查） ---- */}
        <div className={styles.dimensionsSection}>
          <button
            className={styles.dimToggle}
            onClick={() => setShowDims(!showDims)}
          >
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
                <input
                  type="number"
                  className={styles.input}
                  value={physicalWidth}
                  onChange={(e) => setPhysicalWidth(e.target.value)}
                  placeholder="如 200"
                  min={1}
                  max={2000}
                  disabled={isAnalyzing}
                />
              </div>
              <span className={styles.dimSep}>×</span>
              <div className={styles.dimInput}>
                <label className={styles.dimLabel}>高度 (mm)</label>
                <input
                  type="number"
                  className={styles.input}
                  value={physicalHeight}
                  onChange={(e) => setPhysicalHeight(e.target.value)}
                  placeholder="如 150"
                  min={1}
                  max={2000}
                  disabled={isAnalyzing}
                />
              </div>
            </motion.div>
          )}
          {showDims && physicalWidth && physicalHeight && (
            <p className={styles.dimHint}>
              将根据图片分辨率 {physicalWidth}×{physicalHeight}mm 计算各文字块的实际物理高度，检查是否满足 GB 7718 最小字高 1.8mm 要求
            </p>
          )}
        </div>

        {/* ---- 操作按钮 ---- */}
        <div className={styles.actions}>
          <motion.button
            className={styles.analyzeButton}
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            whileHover={isAnalyzing ? {} : { scale: 1.05 }}
            whileTap={isAnalyzing ? {} : { scale: 0.95 }}
          >
            <AnimatePresence mode="wait">
              {isAnalyzing ? (
                <motion.span
                  key="loading"
                  className={styles.btnLoading}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <span className={styles.spinner} />
                  审核中...
                </motion.span>
              ) : (
                <motion.span
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  开始审核
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          <motion.button
            className={styles.backButton}
            onClick={handleBack}
            disabled={isAnalyzing}
            whileHover={isAnalyzing ? {} : { scale: 1.05 }}
            whileTap={isAnalyzing ? {} : { scale: 0.95 }}
          >
            返回
          </motion.button>
        </div>
      </motion.div>
    </main>
  )
}
