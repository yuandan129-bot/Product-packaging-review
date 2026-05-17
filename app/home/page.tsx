'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { motion } from 'motion/react'
import Image from 'next/image'
import { HoverText } from '../../components/HoverText'
import { ShinyText } from '../../components/ShinyText'
import DocumentModal from '../../components/DocumentModal'
import TiltedCard from '../../components/TiltedCard'
import styles from './home.module.css'

const STANDARDS = [
  { code: 'GB28050', name: '预包装食品营养标签通则', docPath: '/knowledge_base/1_national_standards/GB28050_预包装食品营养标签通则.pdf' },
  { code: 'GB7718', name: '预包装食品标签通则', docPath: '/knowledge_base/1_national_standards/GB7718_预包装食品标签通则.pdf' },
  { code: 'GB2760', name: '食品添加剂使用标准', docPath: '/knowledge_base/1_national_standards/GB2760_食品添加剂使用标准.pdf' },
  { code: '26年新国标', name: '速览', docPath: null },
]

export default function Home() {
  const router = useRouter()
  const pathname = usePathname()
  const [reviewCount, setReviewCount] = useState(0)

  /*
   * 品牌规范文件上传状态
   * - brandFiles: 用户上传的原始 File 对象数组（支持多文件追加）
   * - brandPreviewUrls: 本地预览 URL 数组，用于卡片缩略图叠加显示
   * - 品牌规范卡片在 brandPreviewUrls 有值时显示（条件渲染）
   * - 缩略图堆叠展示，只显示一张品牌规范卡片
   */
  // 文档弹窗状态
  const [modalStandard, setModalStandard] = useState<{ code: string; name: string; docPath: string | null } | null>(null)

  const [isHoveringUpload, setIsHoveringUpload] = useState(false)

  const [brandFiles, setBrandFiles] = useState<File[]>([])
  const [brandPreviewUrls, setBrandPreviewUrls] = useState<string[]>([])
  const brandInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // 模块级变量 splashSeen 在刷新后自动重置，确保每次刷新都回到开屏页
    if (!(window as any).__splashSeen) {
      router.replace('/splash')
      return
    }
    setReviewCount(Math.floor(Math.random() * 1000))
    return () => {
      brandPreviewUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [router])

  // 包装背标图片上传 → 保存品牌文件后跳转审核页
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async () => {
      sessionStorage.setItem('uploadedImage', reader.result as string)

      // 读取品牌文件内容并存入 sessionStorage，供审核 API 使用
      if (brandFiles.length > 0) {
        const brandData: { name: string; type: string; content: string }[] = []
        for (const f of brandFiles) {
          const content = await readFileContent(f)
          brandData.push({ name: f.name, type: f.type, content })
        }
        sessionStorage.setItem('brandFiles', JSON.stringify(brandData))
      }

      router.push('/analyze')
    }
    reader.onerror = () => {
      alert('图片读取失败，请重试')
    }
    reader.readAsDataURL(file)

    e.target.value = ''
  }

  // 读取品牌文件内容：文本类读文字，图片类转 base64
  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const isText = /\.(md|markdown|json|txt)$/i.test(file.name)
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('读取失败'))
      if (isText) {
        reader.readAsText(file)
      } else {
        reader.readAsDataURL(file)
      }
    })
  }

  // 品牌规范文件上传 → 追加到数组，支持多个文件
  const handleBrandFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const newFiles: File[] = []
    const newUrls: string[] = []
    for (let i = 0; i < files.length; i++) {
      newFiles.push(files[i])
      newUrls.push(URL.createObjectURL(files[i]))
    }
    setBrandFiles((prev) => [...prev, ...newFiles])
    setBrandPreviewUrls((prev) => [...prev, ...newUrls])
  }

  // 清空所有品牌规范文件
  const handleClearBrandFiles = () => {
    brandPreviewUrls.forEach((url) => URL.revokeObjectURL(url))
    setBrandFiles([])
    setBrandPreviewUrls([])
  }

  const handleStandardClick = (standard: { code: string; name: string; docPath: string | null }) => {
    setModalStandard(standard)
  }

  return (
    <main className={styles.container}>
      {/* Navigation */}
      <nav className={styles.navbar}>
        <div className={styles.navContent}>
          <div className={styles.logo} onClick={() => router.push('/splash')}>
            <Image
              src="/avatar.png"
              alt="Logo"
              width={32}
              height={32}
              className={styles.logoImage}
            />
            <span>January</span>
          </div>
          <div className={styles.navLinks}>
            <a
              className={`${styles.navLink} ${pathname === '/home' ? styles.navLinkActive : ''}`}
              onClick={() => router.push('/home')}
            >
              包装审核
            </a>
            <a
              className={`${styles.navLink} ${pathname === '/barcode' ? styles.navLinkActive : ''}`}
              onClick={() => router.push('/barcode')}
            >
              条码生成
            </a>
          </div>
        </div>
      </nav>

      {/* Main Title */}
      <section className={styles.titleSection}>
        <h1 className={styles.mainTitle}>
          <ShinyText
            text="TESTING"
            speed={3}
            color="#000000"
            shineColor="#808080"
            spread={80}
            direction="left"
          />
        </h1>
      </section>

      {/* Tag Bar */}
      <div className={styles.tagBar}>
        <div className={styles.tagBarTrack}>
            <div className={styles.tagBarGroup}>
              <span>Packaging Testing / 产品包装信息审核 /&nbsp;</span>
              <span>Packaging Testing / 产品包装信息审核 /&nbsp;</span>
              <span>Packaging Testing / 产品包装信息审核 /&nbsp;</span>
              <span>Packaging Testing / 产品包装信息审核 /&nbsp;</span>
            </div>
            <div className={styles.tagBarGroup}>
              <span>Packaging Testing / 产品包装信息审核 /&nbsp;</span>
              <span>Packaging Testing / 产品包装信息审核 /&nbsp;</span>
              <span>Packaging Testing / 产品包装信息审核 /&nbsp;</span>
              <span>Packaging Testing / 产品包装信息审核 /&nbsp;</span>
            </div>
          </div>
      </div>

      {/* Content Grid */}
      <section className={styles.contentGrid}>
        {/* Left Column - Standards Section */}
        <div className={styles.leftColumn}>
          <div className={styles.standardsContainer}>
            {/* Group 1: National & Industry Standards */}
            <div className={styles.standardsGroup}>
              {STANDARDS.map((standard, idx) => (
                <TiltedCard
                  key={idx}
                  className={styles.standardCard}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 + idx * 0.05 }}
                  rotateAmplitude={12}
                  scaleOnHover={1.08}
                  onClick={() => handleStandardClick(standard)}
                >
                  <Image
                    src="/doc-icon.png"
                    alt="文档图标"
                    width={56}
                    height={56}
                    className={styles.cardIcon}
                  />
                  <p className={styles.cardCode}>{standard.code}</p>
                  <p className={styles.cardName}>{standard.name}</p>
                </TiltedCard>
              ))}
            </div>

            {/* Divider */}
            <div className={styles.standardsDivider} />

            {/* Group 2: Brand & Upload */}
            <div className={styles.standardsGroup}>
              {/*
                品牌规范卡片 — 上传文件后显示
                - 多文件缩略图堆叠展示（最多显示前 4 张）
                - 右上角 X 按钮一键清空所有文件
                - 仅显示一张「品牌规范（已上传）」卡片
              */}
              {brandPreviewUrls.length > 0 && (
                <TiltedCard
                  className={styles.brandCard}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 + 4 * 0.05 }}
                  rotateAmplitude={12}
                  scaleOnHover={1.05}
                >
                  {/* 堆叠缩略图 */}
                  <div className={styles.stackedThumbnails}>
                    {brandPreviewUrls.slice(0, 4).map((url, i) => (
                      <Image
                        key={url}
                        src={url}
                        alt=""
                        width={48}
                        height={48}
                        className={styles.stackedThumb}
                        style={{
                          zIndex: brandPreviewUrls.length - i,
                          transform: `translateX(${i * 12}px) translateY(${-i * 4}px)`,
                        }}
                        unoptimized
                      />
                    ))}
                    {brandPreviewUrls.length > 4 && (
                      <span className={styles.stackedMore}>
                        +{brandPreviewUrls.length - 4}
                      </span>
                    )}
                  </div>
                  {/* 删除按钮 */}
                  <button
                    className={styles.brandDeleteBtn}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleClearBrandFiles()
                    }}
                    title="清空品牌文件"
                  >
                    ×
                  </button>
                  <p className={styles.cardCode}>品牌规范</p>
                  <p className={styles.cardName}>
                    （{brandPreviewUrls.length} 个文件已上传）
                  </p>
                </TiltedCard>
              )}

              {/*
                品牌文件上传卡片 — 点击触发隐藏的 <input type="file">
                - accept 支持图片、Markdown、JSON、Office 文档(doc/xls/ppt)
                - 上传后 brandPreviewUrl 有值，上方品牌规范卡片自动出现
              */}
              <TiltedCard
                className={styles.standardCard}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 + 5 * 0.05 }}
                rotateAmplitude={12}
                scaleOnHover={1.08}
                onClick={() => brandInputRef.current?.click()}
              >
                <div className={styles.cardUploadPlaceholder}>+</div>
                <p className={styles.cardCode}>点击上传品牌规范</p>
                <p className={styles.cardUploadHint}>(支持 jpg / png / md / doc / xls / ppt)</p>
              </TiltedCard>

              {/*
                隐藏的文件输入 — 仅用于品牌规范上传
                选择文件后触发 handleBrandFileUpload 生成本地缩略图预览
              */}
              <input
                ref={brandInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.md,.markdown,.json,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                multiple
                onChange={handleBrandFileUpload}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        </div>

        {/* Right Column - Upload Section — 整块热区可点击 */}
        <motion.div
          className={styles.rightColumn}
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          onHoverStart={() => setIsHoveringUpload(true)}
          onHoverEnd={() => setIsHoveringUpload(false)}
          onClick={() => imageInputRef.current?.click()}
          style={{ cursor: "pointer" }}
        >
          {/* Upload Text Area — 逐字弹跳动效 */}
          <div className={styles.uploadTextArea}>
            <h2 className={styles.uploadTitle}>
              <HoverText text="上传图片" className={styles.uploadTitle} />
            </h2>
            <h2 className={styles.uploadTitle}>
              <HoverText text="生成审核检测" className={styles.uploadTitle} />
            </h2>
            <p className={styles.uploadSubtitle}>
              (仅支持 jpg/png 格式 大小5M以内 图片文字清晰可见)
            </p>
            <p className={styles.trustBadge}>
              <ShinyText
                text="本次审核使用模型为 DeepSeek V4 PRO"
                speed={3}
                color="rgba(0,0,0,0.3)"
                shineColor="#000000"
                spread={50}
                direction="left"
              />
            </p>
          </div>

          {/* Upload Circle */}
          <div className={styles.uploadCircleWrapper}>
            <motion.div
              className={styles.uploadCircle}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{
                opacity: 1,
                scale: 1,
                x: isHoveringUpload ? 10 : 0,
              }}
              transition={{
                opacity: { duration: 0.5, delay: 0.3 },
                scale: { duration: 0.5, delay: 0.3 },
                x: { type: "spring", stiffness: 200, damping: 18 },
              }}
            >
              <input
                ref={imageInputRef}
                id="imageUpload"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className={styles.fileInput}
              />
              <label htmlFor="imageUpload" className={styles.uploadLabel}>
                <span className={styles.plusIcon}>+</span>
              </label>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Divider */}
      <div className={styles.divider} />

      {/* 文档弹窗 */}
      {modalStandard && (
        <DocumentModal
          title={modalStandard.name}
          code={modalStandard.code}
          docPath={modalStandard.docPath}
          onClose={() => setModalStandard(null)}
        />
      )}
    </main>
  )
}
