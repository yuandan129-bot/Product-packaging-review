"use client"

import { useRef } from "react"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import Image from "next/image"
import { ImageTrail } from "../../components/ImageTrail"
import styles from "./splash.module.css"

// 鼠标跟随动效的图片 —— 从 public/trail-images/ 读取全部 PNG，随机出现
const TRAIL_IMAGES = [
  { src: "/trail-images/1.png", size: 120 },
  { src: "/trail-images/2.png", size: 90 },
  { src: "/trail-images/3.png", size: 110 },
  { src: "/trail-images/4.png", size: 115 },
  { src: "/trail-images/5.png", size: 105 },
  { src: "/trail-images/6.png", size: 125 },
  { src: "/trail-images/8.png", size: 85 },
  { src: "/trail-images/9.png", size: 130 },
  { src: "/trail-images/10.png", size: 140 },
  { src: "/trail-images/11.png", size: 95 },
  { src: "/trail-images/12.png", size: 100 },
  { src: "/trail-images/13.png", size: 150 },
  { src: "/trail-images/14.png", size: 100 },
]

const TRAIL_ITEMS = TRAIL_IMAGES.map((img) => (
  <Image
    key={img.src}
    src={img.src}
    alt=""
    width={img.size}
    height={img.size}
    style={{
      objectFit: "contain",
    }}
    unoptimized
  />
))

export default function SplashScreen() {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)

  const handleClick = () => {
    ;(window as any).__splashSeen = true
    router.push("/home")
  }

  return (
    <main ref={containerRef} className={styles.container} onClick={handleClick}>
      {/* 鼠标跟随动效 —— 图片随鼠标移动出现并消失 */}
      <ImageTrail
        containerRef={containerRef as React.RefObject<HTMLElement>}
        random
        rotationRange={20}
        interval={45}
        animationSequence={[
          // 阶段1: 淡入 + 放大 — 图片从半透明轻盈出现
          [{ scale: 1.15, opacity: 1 }, { duration: 0.25, ease: "easeOut" }],
          // 阶段2: 微浮 + 停留 — 图片向上飘移，模拟悬浮感
          [{ scale: 1.2, opacity: 0.9, y: -12 }, { duration: 0.35, ease: "easeInOut" }],
          // 阶段3: 淡出 + 缩小 + 继续上浮 — 自然消散
          [{ scale: 0.6, opacity: 0, y: -28 }, { duration: 0.4, ease: "easeIn" }],
        ]}
      >
        {TRAIL_ITEMS}
      </ImageTrail>

      <motion.div
        className={styles.content}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <div className={styles.titleContainer}>
          <motion.span
            className={styles.titleLeft}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Packaging
          </motion.span>

          <motion.div
            className={styles.avatarWrapper}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Image
              src="/avatar.png"
              alt="Avatar"
              width={68}
              height={68}
              priority
            />
          </motion.div>

          <motion.span
            className={styles.titleRight}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Testing
          </motion.span>
        </div>

        <motion.p
          className={styles.byline}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          By-January
        </motion.p>
      </motion.div>
    </main>
  )
}
