"use client"

import { useRef, useCallback } from "react"
import { motion, useMotionValue, useSpring } from "motion/react"

interface TiltedCardProps {
  children: React.ReactNode
  className?: string
  rotateAmplitude?: number
  scaleOnHover?: number
  onClick?: () => void
  extraStyle?: React.CSSProperties
  initial?: any
  animate?: any
  transition?: any
}

export default function TiltedCard({
  children,
  className,
  rotateAmplitude = 12,
  scaleOnHover = 1.05,
  extraStyle,
  initial,
  animate,
  transition,
  onClick,
}: TiltedCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const rotateX = useSpring(y, { stiffness: 350, damping: 18 })
  const rotateY = useSpring(x, { stiffness: 350, damping: 18 })

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = ref.current?.getBoundingClientRect()
      if (!rect) return
      const cx = (e.clientX - rect.left) / rect.width - 0.5
      const cy = (e.clientY - rect.top) / rect.height - 0.5

      // 鼠标在哪侧，哪侧被"按下去"（更靠近背景）
      // rotateY: 鼠标左 → 左侧压低（远离视线）→ 负值
      // rotateX: 鼠标上 → 上侧压低（远离视线）→ 正值
      x.set(cx * rotateAmplitude * 2)
      y.set(cy * rotateAmplitude * 2)

      // 投影偏向被压低的一侧（即鼠标所在侧）
      const intensity = Math.sqrt(cx * cx + cy * cy)
      const ox = cx * 15                               // 鼠标左 → 投影左
      const oy = 6 + Math.abs(cy) * 12                 // 垂直投影始终向下，倾斜越大越深
      const blur = 16 + intensity * 30
      const spread = intensity * 7
      const alpha = 0.055 + intensity * 0.11

      ref.current.style.boxShadow =
        `${ox.toFixed(1)}px ${oy.toFixed(1)}px ${blur.toFixed(0)}px ${spread.toFixed(0)}px rgba(0,0,0,${alpha.toFixed(3)})`
    },
    [rotateAmplitude, x, y]
  )

  const handleMouseLeave = useCallback(() => {
    x.set(0)
    y.set(0)
    // 平滑消失
    if (ref.current) ref.current.style.boxShadow = ""
  }, [x, y])

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
        perspective: 400,
        transition: "box-shadow 0.2s ease-out",
        ...extraStyle,
      }}
      initial={initial}
      animate={animate}
      whileHover={{ scale: scaleOnHover }}
      transition={transition || { type: "spring", stiffness: 300, damping: 24 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
    >
      {children}
    </motion.div>
  )
}
