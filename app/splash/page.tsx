"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import { ShinyText } from "../../components/ShinyText"
import HeroBackground from "../../components/HeroBackground"
import FlipAvatar from "../../components/FlipAvatar"
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
  const [isAvatarFlipped, setIsAvatarFlipped] = useState(false)

  // 卡片交错动画延迟：hover 时 条码(1)→包装(0)→神秘(2)，离开时 左→右
  const cardDelayOn = [0.1, 0, 0.2]
  const cardDelayOff = [0, 0.1, 0.2]

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
            animate={{ x: isAvatarFlipped ? -46 : 0 }}
            transition={{ type: "spring", stiffness: 150, damping: 18 }}
          >
            Packaging
          </motion.span>

          <motion.div
            className={styles.avatarWrapper}
          >
            <FlipAvatar
              frontImage="/头像.png"
              backImage="/二维码2.png"
              onFlipChange={setIsAvatarFlipped}
            />
          </motion.div>

          <motion.span
            className={styles.titleRight}
            animate={{ x: isAvatarFlipped ? 46 : 0 }}
            transition={{ type: "spring", stiffness: 150, damping: 18 }}
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
              animate={{ y: isAvatarFlipped ? 10 : 0 }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 20,
                delay: isAvatarFlipped ? cardDelayOn[i] : cardDelayOff[i],
              }}
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

        {/* ── 描述文字 ── */}
        <div className={styles.bottomSection}>
          <motion.p
            className={styles.description}
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1.0 }}
          >
            帮你搞定产品包装的内容规范性审核和条码生成，给你的项目进度提提速
            <br />
            审核依靠DOUBAO-Vision-PRO+DeepSeek 双模型；条码基于国标算法（EAN-13/Code128）；
            <ShinyText
              text="有任何问题请点击头像向我反馈"
              speed={2}
              delay={0}
              color="rgba(255,255,255,0.5)"
              shineColor="#ffffff"
              spread={60}
              direction="left"
              className={styles.descriptionHighlight}
            />
            <br />
            <span className={styles.descriptionDim}>
              更多神秘功能开发中…（也可以向我提提你的痛点）
            </span>
          </motion.p>
        </div>
      </div>
    </main>
  )
}
