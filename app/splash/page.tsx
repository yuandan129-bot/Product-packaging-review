"use client"

import { useRef } from "react"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import Image from "next/image"
import { ShinyText } from "../../components/ShinyText"
import HeroBackground from "../../components/HeroBackground"
import styles from "./splash.module.css"

interface FeatureCard {
  label: string
  icon: string
  disabled?: boolean
  href?: string
}

const FEATURE_CARDS: FeatureCard[] = [
  { label: "包装合规检测", icon: "/放大镜.gif", href: "/home" },
  { label: "条码生成", icon: "/打字机.gif", href: "/barcode" },
  { label: "神秘功能开发中", icon: "/云朵.gif", disabled: true },
]

export default function SplashScreen() {
  const router = useRouter()

  // 每个卡片的 ShinyText 随机延迟（仅初始化时生成，后续渲染不变）
  const shinyDelays = useRef(FEATURE_CARDS.map(() => Math.random() * 4))

  const handleCardClick = (card: FeatureCard) => {
    if (card.disabled || !card.href) return
    router.push(card.href)
  }

  return (
    <main className={styles.container}>
      {/* ── 背景层：光晕动效 ── */}
      <HeroBackground />

      {/* ── 右上角 By-January ── */}
      <span className={styles.bylineTop}>By-January</span>

      {/* ── 第一层：内容（叠加在背景之上）── */}
      <div className={styles.contentLayer}>
        {/* ── 标题：Packaging + 头像 + Testing ── */}
        <motion.div
          className={styles.titleSection}
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <motion.span
            className={styles.titleLeft}
            initial={{ opacity: 1, x: 0 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Packaging
          </motion.span>

          <motion.div
            className={styles.avatarWrapper}
            initial={{ scale: 1, opacity: 1 }}
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
            initial={{ opacity: 1, x: 0 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Testing
          </motion.span>
        </motion.div>

        {/* ── 功能卡片 ── */}
        <motion.div
          className={styles.cardsRow}
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          {FEATURE_CARDS.map((card, i) => (
            <motion.div
              key={card.label}
              className={card.disabled ? styles.cardDisabled : styles.card}
              onClick={() => handleCardClick(card)}
              whileHover={card.disabled ? undefined : { scale: 1.04 }}
              whileTap={card.disabled ? undefined : { scale: 0.97 }}
            >
              <img
                src={card.icon}
                alt=""
                width={28}
                height={28}
                className={card.disabled ? styles.cardIconDimmed : styles.cardIcon}
              />
              <ShinyText
                text={card.label}
                speed={3}
                delay={shinyDelays.current[i]}
                color="#808080"
                shineColor="#ffffff"
                spread={100}
                direction="left"
                className={styles.cardLabel}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* ── 描述文字 + 二维码 ── */}
        <div className={styles.bottomSection}>
          <motion.p
            className={styles.description}
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1.0 }}
          >
            产品包装背标审核：基于豆包+DeepSeek双模型配合专属知识库，有效降低AI幻觉，让审核更靠谱
            <br />
            条码生成：可校验条码合规性，并基于国际标准条码算法（如EAN-13/Code128等）生成可下载的矢量图形（SVG/PDF）
            <br />
            更多包装相关功能正在路上。希望您用得开心，有任何需求或建议欢迎随时反馈（见下方微信二维码）
          </motion.p>

          {/* ── 微信二维码 ── */}
          <motion.div
            className={styles.qrcodeWrapper}
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            transition={{ opacity: { duration: 0.6, delay: 1.2 }, scale: { type: "tween", ease: "easeOut", duration: 0.4 } }}
            whileHover={{ scale: 2 }}
            style={{ transformOrigin: "bottom right" }}
          >
            <Image
              src="/qrcode-wechat.jpg"
              alt="微信二维码"
              width={80}
              height={80}
              className={styles.qrcode}
              unoptimized
            />
          </motion.div>
        </div>
      </div>
    </main>
  )
}
