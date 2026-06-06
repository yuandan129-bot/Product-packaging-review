"use client"

import { useState } from "react"
import styles from "./FlipAvatar.module.css"

interface Props {
  frontImage: string
  backImage: string
  onFlipChange?: (flipped: boolean) => void
}

export default function FlipAvatar({ frontImage, backImage, onFlipChange }: Props) {
  const [isFlipped, setIsFlipped] = useState(false)

  const handleEnter = () => {
    setIsFlipped(true)
    onFlipChange?.(true)
  }

  const handleLeave = () => {
    setIsFlipped(false)
    onFlipChange?.(false)
  }

  return (
    <div
      className={styles.container}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <div className={`${styles.inner} ${isFlipped ? styles.flipped : ""}`}>
        {/* 正面 — 圆形头像 */}
        <div className={styles.front}>
          <img src={frontImage} alt="Avatar" />
        </div>

        {/* 背面 — 方形二维码 */}
        <div className={styles.back}>
          <img src={backImage} alt="QR Code" />
        </div>
      </div>
    </div>
  )
}
