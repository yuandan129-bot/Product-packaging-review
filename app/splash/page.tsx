"use client"

import { useRef, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import Image from "next/image"
import { ImageTrail } from "../../components/ImageTrail"
import styles from "./splash.module.css"

// 鼠标跟随动效的图片 —— 已压缩为 WebP，单张 ~5-28KB
const TRAIL_IMAGES = [
  { src: "/trail-images/1.webp", size: 120 },
  { src: "/trail-images/2.webp", size: 90 },
  { src: "/trail-images/3.webp", size: 110 },
  { src: "/trail-images/4.webp", size: 115 },
  { src: "/trail-images/5.webp", size: 105 },
  { src: "/trail-images/6.webp", size: 125 },
  { src: "/trail-images/8.webp", size: 85 },
  { src: "/trail-images/9.webp", size: 130 },
  { src: "/trail-images/10.webp", size: 140 },
  { src: "/trail-images/11.webp", size: 95 },
  { src: "/trail-images/12.webp", size: 100 },
  { src: "/trail-images/13.webp", size: 150 },
  { src: "/trail-images/14.webp", size: 100 },
  { src: "/trail-images/15.webp", size: 135 },
  { src: "/trail-images/16.webp", size: 110 },
  { src: "/trail-images/17.webp", size: 95 },
  { src: "/trail-images/18.webp", size: 120 },
]

export default function SplashScreen() {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const [imagesReady, setImagesReady] = useState(false)

  // 预加载所有 trail 图片，全部就绪后再显示动效
  useEffect(() => {
    let cancelled = false
    const preload = TRAIL_IMAGES.map(
      (img) =>
        new Promise<void>((resolve) => {
          const el = new window.Image()
          el.onload = () => resolve()
          el.onerror = () => resolve() // 即使失败也不阻塞
          el.src = img.src
        })
    )
    Promise.all(preload).then(() => {
      if (!cancelled) setImagesReady(true)
    })
    return () => { cancelled = true }
  }, [])

  const handleClick = () => {
    router.push("/home?from=splash")
  }

  const trailItems = TRAIL_IMAGES.map((img) => (
    <Image
      key={img.src}
      src={img.src}
      alt=""
      width={img.size}
      height={img.size}
      style={{ objectFit: "contain" }}
      unoptimized
    />
  ))

  return (
    <main ref={containerRef} className={styles.container} onClick={handleClick}>
      {/* 鼠标跟随动效 —— 图片预加载完毕后才渲染 */}
      {imagesReady && (
        <ImageTrail
          containerRef={containerRef as React.RefObject<HTMLElement>}
          random
          rotationRange={20}
          interval={60}
          animationSequence={[
            [{ scale: 1.15, opacity: 1 }, { duration: 0.25, ease: "easeOut" }],
            [{ scale: 1.2, opacity: 0.9, y: -12 }, { duration: 0.35, ease: "easeInOut" }],
            [{ scale: 0.6, opacity: 0, y: -28 }, { duration: 0.4, ease: "easeIn" }],
          ]}
        >
          {trailItems}
        </ImageTrail>
      )}

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
