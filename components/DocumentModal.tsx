"use client"

import { useEffect } from "react"
import { motion } from "motion/react"

interface DocumentModalProps {
  title: string
  code: string
  docPath: string | null
  onClose: () => void
}

// 26年新国标速览内容
const NEW_STANDARDS_SUMMARY = `## 2026 年食品标签新国标速览

### 主要变化

**1. 致敏原标注升级为强制**
- 原 GB 7718 中致敏原为推荐标注，新版改为强制
- 8 大类致敏原必须醒目标注：大豆、坚果、乳制品、鸡蛋、花生、芝麻、贝类、鱼类

**2. 营养成分表格式调整**
- 新增"糖"的强制标注（原为可选）
- 能量单位统一为 kJ，不允许使用 kcal
- 修约间隔更严格

**3. 生产日期格式规范**
- 统一为 YYYY.MM.DD 格式
- 禁止使用"见包装"等模糊引导语
- 日期字符高度 ≥ 3mm

**4. SC 证号新规**
- SC + 14 位数字格式不变
- 新增二维码关联要求（2027 年过渡）
- 委托加工需同时标注委托方和被委托方证号

**5. 净含量规格**
- 字体高度要求不变（≥4mm）
- 新增电子标签净含量标注规范

> 建议及时关注国家标准化管理委员会官网获取完整文件。`

export default function DocumentModal({ title, code, docPath, onClose }: DocumentModalProps) {
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  const isSummary = !docPath

  return (
    <motion.div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.5)",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
    >
      <motion.div
        style={{
          background: "#fff",
          borderRadius: 16,
          border: "7px solid #fff",
          width: 680,
          maxWidth: "94vw",
          height: "84vh",
          maxHeight: 940,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        }}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 28px",
            borderBottom: "1px solid #e6e6e6",
            flexShrink: 0,
          }}
        >
          <div>
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "#666",
                letterSpacing: "0.5px",
                textTransform: "uppercase",
                fontFamily: "'SF Mono', 'JetBrains Mono', 'Menlo', monospace",
              }}
            >
              {code}
            </span>
            <h2
              style={{
                fontSize: 22,
                fontWeight: 540,
                margin: "4px 0 0",
                letterSpacing: "-0.26px",
              }}
            >
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "none",
              background: "#f5f5f5",
              fontSize: 18,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#e5e5e5")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#f5f5f5")}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          {isSummary ? (
            <div
              style={{
                flex: 1,
                overflow: "auto",
                padding: "28px 32px",
                fontSize: 16,
                lineHeight: 1.7,
                fontWeight: 350,
                letterSpacing: "-0.14px",
                color: "#000",
              }}
            >
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  fontFamily: "inherit",
                  fontSize: "inherit",
                  lineHeight: "inherit",
                  margin: 0,
                }}
              >
                {NEW_STANDARDS_SUMMARY}
              </pre>
            </div>
          ) : (
            <iframe
              src={docPath!}
              style={{
                width: "100%",
                flex: 1,
                border: "none",
                minHeight: 0,
              }}
              title={title}
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
