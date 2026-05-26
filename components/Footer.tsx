"use client"

import { useRef, useState } from "react"
import { motion, useInView } from "motion/react"
import { useRouter, usePathname } from "next/navigation"
import styles from "./Footer.module.css"

interface FooterColumn {
  title: string
  links: { label: string; href?: string; onClick?: () => void }[]
}

const FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: "审核工具",
    links: [
      { label: "包装审核", href: "/home" },
      { label: "条码生成", href: "/home" },
      { label: "品牌规范", href: "/home" },
      { label: "知识库查询", href: "/home" },
    ],
  },
  {
    title: "国家标准",
    links: [
      { label: "GB 7718 预包装标签", href: "/home" },
      { label: "GB 28050 营养标签", href: "/home" },
      { label: "GB 2760 食品添加剂", href: "/home" },
      { label: "广告法合规", href: "/home" },
    ],
  },
  {
    title: "资源",
    links: [
      { label: "知识库", href: "/home" },
      { label: "文档中心", href: "/home" },
      { label: "API 参考", href: "/home" },
      { label: "更新日志", href: "/home" },
    ],
  },
  {
    title: "关于",
    links: [
      { label: "关于我们", href: "/home" },
      { label: "联系方式", href: "/home" },
      { label: "帮助中心", href: "/home" },
    ],
  },
  {
    title: "法律",
    links: [
      { label: "隐私政策", href: "/home" },
      { label: "服务条款", href: "/home" },
      { label: "Cookie 政策", href: "/home" },
    ],
  },
]

function FooterColumnItem({
  column,
  index,
}: {
  column: FooterColumn
  index: number
}) {
  const router = useRouter()

  return (
    <motion.div
      className={styles.column}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 * index, ease: [0.4, 0, 0.2, 1] }}
    >
      <h4 className={styles.columnTitle}>{column.title}</h4>
      <ul className={styles.columnList}>
        {column.links.map((link) => (
          <motion.li
            key={link.label}
            className={styles.columnItem}
            whileHover={{ x: 6 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <a
              className={styles.columnLink}
              onClick={(e) => {
                e.preventDefault()
                if (link.href) router.push(link.href)
              }}
            >
              <span className={styles.linkLabel}>{link.label}</span>
              <motion.span
                className={styles.linkArrow}
                initial={{ opacity: 0, x: -4 }}
                whileHover={{ opacity: 1, x: 0 }}
              >
                →
              </motion.span>
            </a>
          </motion.li>
        ))}
      </ul>
    </motion.div>
  )
}

export default function Footer() {
  const pathname = usePathname()
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })
  const [hoveredColumn, setHoveredColumn] = useState<number | null>(null)

  if (pathname === "/splash") return null

  return (
    <footer ref={ref} className={styles.footer}>
      {/* Top accent line */}
      <div className={styles.accentLine} />

      <div className={styles.footerInner}>
        {/* Brand row */}
        <motion.div
          className={styles.brandRow}
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.05, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className={styles.brandLeft}>
            <span className={styles.brandName}>Packaging Testing</span>
            <span className={styles.brandByline}>产品包装信息审核系统</span>
          </div>
          <motion.div
            className={styles.brandAccent}
            style={{
              backgroundColor:
                hoveredColumn !== null
                  ? ["#dceeb1", "#c5b0f4", "#f4ecd6", "#c8e6cd", "#efd4d4"][hoveredColumn]
                  : "#dceeb1",
            }}
          />
        </motion.div>

        {/* Columns */}
        <div className={styles.columnsGrid}>
          {FOOTER_COLUMNS.map((column, i) => (
            <div
              key={column.title}
              onMouseEnter={() => setHoveredColumn(i)}
              onMouseLeave={() => setHoveredColumn(null)}
            >
              <FooterColumnItem column={column} index={i} />
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <motion.div
          className={styles.bottomBar}
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <span className={styles.copyright}>
            &copy; {new Date().getFullYear()} Packaging Testing. All rights reserved.
          </span>
          <span className={styles.credit}>By January</span>
        </motion.div>
      </div>
    </footer>
  )
}
