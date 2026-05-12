'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import styles from './analyze.module.css'

export default function AnalyzePage() {
  const router = useRouter()
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  useEffect(() => {
    const imageData = sessionStorage.getItem('uploadedImage')
    if (imageData) {
      setUploadedImage(imageData)
    } else {
      router.push('/home')
    }
  }, [router])

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    try {
      // 压缩图片：缩至 2048px + JPEG 0.7 质量，避免 base64 过大导致 API 413 错误
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

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      })
      const result = await response.json()

      if (result.error) {
        alert(result.error)
        return
      }

      sessionStorage.setItem('complianceReport', JSON.stringify(result))
      router.push('/report')
    } catch (error) {
      console.error('分析错误:', error)
      alert('分析失败，请检查网络后重试')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleBack = () => {
    sessionStorage.removeItem('uploadedImage')
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
        <div className={styles.imagePreview}>
          <img src={uploadedImage} alt="上传的图片" />
        </div>

        <div className={styles.actions}>
          <motion.button
            className={styles.analyzeButton}
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {isAnalyzing ? '审核中...' : '开始审核'}
          </motion.button>

          <motion.button
            className={styles.backButton}
            onClick={handleBack}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            返回
          </motion.button>
        </div>
      </motion.div>
    </main>
  )
}
