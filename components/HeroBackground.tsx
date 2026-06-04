"use client"

import { motion } from "motion/react"
import styles from "./HeroBackground.module.css"

interface ShapeDef {
  delay: number
  width: number
  height: number
  rotate: number
  colorClass: string
  className: string
}

const SHAPES: ShapeDef[] = [
  {
    // 大 — Indigo，放大 + 更显眼
    delay: 0.3,
    width: 800,
    height: 180,
    rotate: 12,
    colorClass: styles.shapeIndigo,
    className: "left-[-15%] top-[18%]",
  },
  {
    // 大 — Rose，放大 + 更显眼
    delay: 0.5,
    width: 650,
    height: 160,
    rotate: -15,
    colorClass: styles.shapeRose,
    className: "right-[-10%] top-[72%]",
  },
  {
    // 中 — Violet
    delay: 0.4,
    width: 320,
    height: 85,
    rotate: -8,
    colorClass: styles.shapeViolet,
    className: "left-[8%] bottom-[10%]",
  },
  {
    // 小 — Amber，缩小 + 更透明
    delay: 0.6,
    width: 150,
    height: 45,
    rotate: 20,
    colorClass: styles.shapeAmber,
    className: "right-[22%] top-[12%]",
  },
  {
    // 小 — Cyan，缩小 + 更透明
    delay: 0.7,
    width: 110,
    height: 30,
    rotate: -25,
    colorClass: styles.shapeCyan,
    className: "left-[28%] top-[8%]",
  },
]

function parsePosition(className: string) {
  const pos: Record<string, string> = {}
  const parts = className.split(" ")
  for (const p of parts) {
    if (p.startsWith("left-")) pos.left = p.replace("left-[", "").replace("]", "")
    if (p.startsWith("right-")) pos.right = p.replace("right-[", "").replace("]", "")
    if (p.startsWith("top-")) pos.top = p.replace("top-[", "").replace("]", "")
    if (p.startsWith("bottom-")) pos.bottom = p.replace("bottom-[", "").replace("]", "")
  }
  return pos
}

function ElegantShape({ shape, index }: { shape: ShapeDef; index: number }) {
  const pos = parsePosition(shape.className)

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: -150,
        rotate: shape.rotate - 15,
      }}
      animate={{
        opacity: 1,
        y: 0,
        rotate: shape.rotate,
      }}
      transition={{
        duration: 2.4,
        delay: shape.delay,
        ease: [0.23, 0.86, 0.39, 0.96],
        opacity: { duration: 1.2 },
      }}
      style={{
        position: "absolute",
        left: pos.left,
        right: pos.right,
        top: pos.top,
        bottom: pos.bottom,
      }}
    >
      <motion.div
        animate={{ y: [0, 20, 0] }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut",
          delay: shape.delay + index * 0.1,
        }}
        style={{ width: shape.width, height: shape.height }}
      >
        <div
          className={`${styles.shapeBase} ${shape.colorClass}`}
          style={{
            position: "absolute",
            inset: 0,
          }}
        />
      </motion.div>
    </motion.div>
  )
}

export default function HeroBackground() {
  return (
    <div className={styles.container}>
      {/* 斜角渐变 */}
      <div className={styles.gradientOverlay} />

      {/* 光晕形状 */}
      {SHAPES.map((shape, i) => (
        <ElegantShape key={i} shape={shape} index={i} />
      ))}

      {/* 上下边缘渐变遮罩 */}
      <div className={styles.edgeFade} />
    </div>
  )
}
