"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { motion } from "motion/react"
import Image from "next/image"
import styles from "./barcode.module.css"

// EAN-13 校验码计算 (ISO/IEC 7064)
function calcEAN13CheckDigit(digits: string): number {
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i]) * (i % 2 === 0 ? 1 : 3)
  }
  const check = (10 - (sum % 10)) % 10
  return check
}

// 根据条码尺寸智能建议字号
function suggestFontSize(width: number, showText: boolean): number {
  if (!showText) return 0
  if (width <= 100) return 12
  if (width <= 200) return 16
  if (width <= 400) return 22
  return 28
}

// 根据条码尺寸智能建议高度
function suggestHeight(width: number): number {
  if (width <= 100) return 40
  if (width <= 200) return 60
  if (width <= 300) return 80
  return 100
}

const BARCODE_FORMATS = [
  { value: "ean13", label: "EAN-13（13位商品条码）" },
  { value: "ean8", label: "EAN-8（8位短码）" },
  { value: "upc", label: "UPC-A（12位北美条码）" },
  { value: "code128", label: "CODE128（通用物流码）" },
  { value: "itf14", label: "ITF-14（14位箱码）" },
]

const FONT_FAMILIES = [
  { value: "monospace", label: "等宽字体" },
  { value: "arial", label: "Arial" },
  { value: "helvetica", label: "Helvetica" },
  { value: "ocr-b", label: "OCR-B（条码标准字体）" },
]

const UNITS = ["mm", "px"]

export default function BarcodePage() {
  const router = useRouter()
  const pathname = usePathname()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // 条码值
  const [codeValue, setCodeValue] = useState("")
  const [checkDigit, setCheckDigit] = useState<number | null>(null)

  // 格式
  const [format, setFormat] = useState("ean13")

  // 尺寸
  const [width, setWidth] = useState(400)
  const [height, setHeight] = useState(120)
  const [unit, setUnit] = useState("px")

  // 文字
  const [showText, setShowText] = useState(true)
  const [fontSize, setFontSize] = useState(22)
  const [fontFamily, setFontFamily] = useState("monospace")

  // 生成状态
  const [generated, setGenerated] = useState(false)
  const [autoSuggest, setAutoSuggest] = useState(false)

  // 输入条码值时自动计算校验码
  // EAN-13：输入 12 位 → 自动计算第 13 位校验码；输入 13 位 → 验证校验码
  const fullEAN13 = (() => {
    if (format === "ean13") {
      // 13 位：自动纠正校验码（第 13 位），避免用户手输错误导致 JsBarcode 报错
      if (codeValue.length === 13 && /^\d{13}$/.test(codeValue)) {
        const correct = codeValue.slice(0, 12) + calcEAN13CheckDigit(codeValue.slice(0, 12))
        return correct
      }
      // 12 位：自动补全校验码
      if (codeValue.length === 12 && /^\d{12}$/.test(codeValue))
        return codeValue + calcEAN13CheckDigit(codeValue)
    }
    return null
  })()

  useEffect(() => {
    if (format === "ean13") {
      if (codeValue.length === 12 && /^\d{12}$/.test(codeValue)) {
        setCheckDigit(calcEAN13CheckDigit(codeValue))
      } else if (codeValue.length === 13 && /^\d{13}$/.test(codeValue)) {
        const expected = calcEAN13CheckDigit(codeValue.slice(0, 12))
        setCheckDigit(expected)
      } else {
        setCheckDigit(null)
      }
    } else {
      setCheckDigit(null)
    }
    setGenerated(false)
  }, [codeValue, format])

  // 尺寸变化时自动刷新建议
  useEffect(() => {
    if (autoSuggest && showText) {
      setFontSize(suggestFontSize(width, showText))
      setHeight(suggestHeight(width))
    }
  }, [width, autoSuggest, showText])

  const handleGenerate = async () => {
    if (!codeValue) {
      alert("请输入条码数值")
      return
    }
    if (!canvasRef.current) return

    // 构建完整条码值（EAN-13 自动补全校验码，非 EAN-13 直接使用输入值）
    let fullCode = fullEAN13 || codeValue

    // 根据格式校验长度
    const lengthMap: Record<string, number> = {
      ean13: 13, ean8: 8, upc: 12, itf14: 14,
    }
    const expectedLen = lengthMap[format]
    if (expectedLen && fullCode.length !== expectedLen) {
      alert(`当前格式 ${format.toUpperCase()} 需要 ${expectedLen} 位数字，当前输入 ${fullCode.length} 位`)
      return
    }

    try {
      const JsBarcode = (await import("jsbarcode")).default
      const canvas = canvasRef.current

      // 先设尺寸（会重置 canvas），再渲染
      canvas.width = width
      canvas.height = height

      const barWidth = Math.max(1, Math.round(width / (fullCode.length * 11 + 20)))
      const barHeight = showText ? Math.max(20, height - fontSize - 12) : height

      JsBarcode(canvas, fullCode, {
        format: format as any,
        width: barWidth,
        height: barHeight,
        displayValue: showText,
        fontSize: fontSize,
        font: fontFamily,
        textMargin: 2,
        margin: 10,
        background: "#ffffff",
        lineColor: "#000000",
      })
      setGenerated(true)
    } catch (err) {
      console.error("条码生成失败:", err)
      alert(`条码生成失败：${err instanceof Error ? err.message : "请检查输入值是否符合格式要求"}`)
    }
  }

  const handleDownload = async (type: "png" | "svg") => {
    if (type === "png") {
      // 高分辨率导出：用离屏 canvas 以 3 倍分辨率渲染，保证下载图片清晰可用
      const fullCode = fullEAN13 || codeValue
      if (!fullCode) return
      const JsBarcode = (await import("jsbarcode")).default
      const scale = 3
      const exportCanvas = document.createElement("canvas")
      exportCanvas.width = width * scale
      exportCanvas.height = height * scale
      const barWidth = Math.max(1, Math.round((width * scale) / (fullCode.length * 11 + 20)))
      const barHeight = showText
        ? Math.max(20, height * scale - fontSize * scale - 12)
        : height * scale
      JsBarcode(exportCanvas, fullCode, {
        format: format as any,
        width: barWidth,
        height: barHeight,
        displayValue: showText,
        fontSize: fontSize * scale,
        font: fontFamily,
        textMargin: 2,
        margin: 10 * scale,
        background: "#ffffff",
        lineColor: "#000000",
      })
      const link = document.createElement("a")
      link.download = `barcode-${fullCode}.png`
      link.href = exportCanvas.toDataURL("image/png")
      link.click()
    } else {
      // SVG 导出
      const fullCode = fullEAN13 || codeValue
      if (!fullCode) return
      const JsBarcode = import("jsbarcode")
      JsBarcode.then((mod) => {
        const svg = document.createElement("svg")
        document.body.appendChild(svg)
        ;(mod.default as any)(svg, fullCode, {
          format: format,
          width: 2,
          height: height,
          displayValue: showText,
          fontSize: fontSize,
          font: fontFamily,
          margin: 10,
        })
        const data = new XMLSerializer().serializeToString(svg)
        const blob = new Blob([data], { type: "image/svg+xml" })
        const link = document.createElement("a")
        link.download = `barcode-${codeValue}.svg`
        link.href = URL.createObjectURL(blob)
        link.click()
        document.body.removeChild(svg)
      })
    }
  }

  const handleCopyValue = () => {
    const full = checkDigit !== null ? codeValue + checkDigit : codeValue
    navigator.clipboard.writeText(full)
  }

  return (
    <main className={styles.container}>
      {/* 顶部导航 */}
      <nav className={styles.navbar}>
        <div className={styles.navContent}>
          <span className={styles.navLogo} onClick={() => router.push("/splash")}>
            <Image
              src="/avatar.png"
              alt="Logo"
              width={32}
              height={32}
              className={styles.logoImage}
            />
            January
          </span>
          <div className={styles.navLinks}>
            <a
              className={`${styles.navLink} ${pathname === "/home" ? styles.navLinkActive : ""}`}
              onClick={() => router.push("/home")}
            >
              包装审核
            </a>
            <a
              className={`${styles.navLink} ${pathname === "/barcode" ? styles.navLinkActive : ""}`}
              onClick={() => router.push("/barcode")}
            >
              条码生成
            </a>
          </div>
        </div>
      </nav>

      <div className={styles.content}>
        {/* 左侧控制面板 */}
        <div className={styles.panel}>
          <motion.h1
            className={styles.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            条码生成器
          </motion.h1>
          <p className={styles.subtitle}>
            支持 EAN-13 / EAN-8 / UPC / CODE128 等标准格式
          </p>

          {/* 1. 条码数值输入 */}
          <div className={styles.field}>
            <label className={styles.label}>条码数值</label>
            <div className={styles.inputRow}>
              <input
                type="text"
                className={styles.input}
                value={codeValue}
                onChange={(e) => setCodeValue(e.target.value.replace(/\D/g, "").slice(0, 13))}
                placeholder={format === "ean13" ? "输入 12-13 位条码数字" : "输入条码数字"}
                maxLength={13}
              />
              {checkDigit !== null && (
                <span className={styles.checkDigitBadge}>
                  校验码：<strong>{checkDigit}</strong>
                </span>
              )}
            </div>
            {checkDigit !== null && (
              <p className={styles.hint}>
                完整条码：{codeValue}
                <strong>{checkDigit}</strong>
                <button className={styles.copyBtn} onClick={handleCopyValue}>
                  复制
                </button>
              </p>
            )}
          </div>

          {/* 2. 条码格式 */}
          <div className={styles.field}>
            <label className={styles.label}>条码格式</label>
            <select
              className={styles.select}
              value={format}
              onChange={(e) => setFormat(e.target.value)}
            >
              {BARCODE_FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* 3. 尺寸设置 */}
          <div className={styles.field}>
            <label className={styles.label}>
              条码尺寸
              <button
                className={styles.suggestBtn}
                onClick={() => setAutoSuggest(!autoSuggest)}
                style={{
                  backgroundColor: autoSuggest ? "var(--foreground)" : "transparent",
                  color: autoSuggest ? "var(--primary-foreground)" : "var(--foreground)",
                }}
              >
                {autoSuggest ? "✓ 智能建议" : "智能建议"}
              </button>
            </label>
            <div className={styles.sizeRow}>
              <div className={styles.sizeInput}>
                <span className={styles.sizeLabel}>宽</span>
                <input
                  type="number"
                  className={styles.input}
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  min={50}
                  max={600}
                />
              </div>
              <div className={styles.sizeInput}>
                <span className={styles.sizeLabel}>高</span>
                <input
                  type="number"
                  className={styles.input}
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  min={30}
                  max={300}
                />
              </div>
              <select
                className={styles.unitSelect}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            {autoSuggest && (
              <p className={styles.hint}>
                已根据宽度 {width}px 智能建议高度 {height}px、字号 {fontSize}px
              </p>
            )}
          </div>

          {/* 4. 显示文字 */}
          <div className={styles.field}>
            <label className={styles.label}>下方显示数字</label>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={showText}
                onChange={(e) => setShowText(e.target.checked)}
              />
              <span className={styles.toggleSlider} />
              <span className={styles.toggleLabel}>
                {showText ? "显示" : "隐藏"}
              </span>
            </label>
          </div>

          {/* 5. 字体设置 */}
          {showText && (
            <div className={styles.field}>
              <label className={styles.label}>字体设置</label>
              <div className={styles.fontRow}>
                <select
                  className={styles.select}
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  style={{ flex: 2 }}
                >
                  {FONT_FAMILIES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <div className={styles.sizeInput} style={{ flex: 1 }}>
                  <span className={styles.sizeLabel}>字号</span>
                  <input
                    type="number"
                    className={styles.input}
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    min={8}
                    max={40}
                  />
                </div>
              </div>
              <p className={styles.hint}>
                条码文字过小可能导致扫码设备无法识别，建议 &ge; 14px
              </p>
            </div>
          )}

          {/* 6. 生成按钮 */}
          <button className={styles.generateBtn} onClick={handleGenerate}>
            生成条码
          </button>
        </div>

        {/* 右侧预览区 */}
        <div className={styles.preview}>
          <div className={styles.previewCard}>
            {/* Canvas 始终挂载，确保 ref 永远可用；未生成时隐藏 */}
            <canvas
              ref={canvasRef}
              className={styles.canvas}
              style={{ display: generated ? "block" : "none" }}
            />
            {generated ? (
              <motion.div
                className={styles.result}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
              >
                <div className={styles.downloadRow}>
                  <button
                    className={styles.downloadBtn}
                    onClick={() => handleDownload("png")}
                  >
                    下载 PNG
                  </button>
                  <button
                    className={styles.downloadBtnOutline}
                    onClick={() => handleDownload("svg")}
                  >
                    下载 SVG
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className={styles.placeholder}>
                <span className={styles.placeholderIcon}>∥∥∥∥∥∥∥∥∥</span>
                <p>输入条码数值并点击生成</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
