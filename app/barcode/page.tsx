"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import { motion } from "motion/react"
import Image from "next/image"
import { getStats, getStatsSync, incrementBarcode } from "../../lib/usageStats"
import styles from "./barcode.module.css"

// EAN-13 校验码计算 (ISO/IEC 7064)
function calcEAN13CheckDigit(digits: string): number {
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i]) * (i % 2 === 0 ? 1 : 3)
  }
  return (10 - (sum % 10)) % 10
}

// 各格式的模块数（估算，用于从目标宽度反推模块宽）
function estimateModules(format: string): number {
  switch (format) {
    case "ean13": return 95
    case "ean8":  return 67
    case "upc":   return 95
    case "code128": return 110
    case "itf14": return 156
    default: return 100
  }
}

const BARCODE_FORMATS = [
  { value: "ean13", label: "EAN-13（13位商品条码）" },
  { value: "ean8", label: "EAN-8（8位短码）" },
  { value: "upc", label: "UPC-A（12位北美条码）" },
  { value: "code128", label: "CODE128（通用物流码）" },
  { value: "itf14", label: "ITF-14（14位箱码）" },
]

const FONT_FAMILIES = [
  { value: "MiSans", label: "MiSans（小米体）" },
  { value: "monospace", label: "等宽字体" },
  { value: "arial", label: "Arial" },
  { value: "helvetica", label: "Helvetica" },
  { value: "ocr-b", label: "OCR-B（条码标准字体）" },
]

// 尺寸预设
interface Preset {
  label: string
  ratio: string
  w: number
  h: number
  icon: "square" | "landscape" | "wide"
}

const PRESETS: Preset[] = [
  { label: "1:1", ratio: "1:1", w: 250, h: 250, icon: "square" },
  { label: "4:3", ratio: "4:3", w: 400, h: 300, icon: "landscape" },
  { label: "2:1", ratio: "2:1", w: 400, h: 200, icon: "landscape" },
  { label: "16:9", ratio: "16:9", w: 400, h: 225, icon: "wide" },
  { label: "3:1", ratio: "3:1", w: 450, h: 150, icon: "wide" },
  { label: "4:1", ratio: "4:1", w: 480, h: 120, icon: "wide" },
]

const UNITS = ["mm", "px"]

/* ── 比例示意图图标组件 ── */
function RatioIcon({ icon }: { icon: Preset["icon"] }) {
  return (
    <span className={styles.ratioIcon}>
      <svg width="28" height="20" viewBox="0 0 28 20" fill="none">
        {icon === "square" && (
          <rect x="4" y="2" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
        )}
        {icon === "landscape" && (
          <rect x="2" y="4" width="24" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
        )}
        {icon === "wide" && (
          <rect x="1" y="5" width="26" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
        )}
      </svg>
    </span>
  )
}

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
  const [fontSize, setFontSize] = useState(40)
  const [fontFamily, setFontFamily] = useState("MiSans")

  // 生成状态
  const [generated, setGenerated] = useState(false)
  const [fontsReady, setFontsReady] = useState(false)
  const [barcodeCount, setBarcodeCount] = useState(0)

  // 确保网页字体加载完成后 canvas 才能正确渲染
  useEffect(() => {
    if (typeof document !== "undefined" && document.fonts) {
      document.fonts.ready.then(() => setFontsReady(true))
    } else {
      setFontsReady(true)
    }
    setBarcodeCount(getStatsSync().barcodeCount)
    getStats().then((s) => setBarcodeCount(s.barcodeCount))
  }, [])

  // 完整 EAN-13（自动补校验码）
  const fullEAN13 = (() => {
    if (format === "ean13") {
      if (codeValue.length === 13 && /^\d{13}$/.test(codeValue)) {
        return codeValue.slice(0, 12) + calcEAN13CheckDigit(codeValue.slice(0, 12))
      }
      if (codeValue.length === 12 && /^\d{12}$/.test(codeValue))
        return codeValue + calcEAN13CheckDigit(codeValue)
    }
    return null
  })()

  // 校验码计算
  useEffect(() => {
    if (format === "ean13") {
      if (codeValue.length === 12 && /^\d{12}$/.test(codeValue)) {
        setCheckDigit(calcEAN13CheckDigit(codeValue))
      } else if (codeValue.length === 13 && /^\d{13}$/.test(codeValue)) {
        setCheckDigit(calcEAN13CheckDigit(codeValue.slice(0, 12)))
      } else {
        setCheckDigit(null)
      }
    } else {
      setCheckDigit(null)
    }
    setGenerated(false)
  }, [codeValue, format])

  /* ── 生成条码 ── */
  const handleGenerate = useCallback(async () => {
    if (!codeValue) {
      alert("请输入条码数值")
      return
    }
    if (!canvasRef.current) return

    const fullCode = fullEAN13 || codeValue

    // 按格式校验长度
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

      // 从用户目标尺寸反推 JsBarcode 的模块宽和条高
      // margin=10 → 左右共 20px
      const totalModules = estimateModules(format)
      const marginTotal = 20 // margin left + right
      const moduleWidth = Math.max(1, Math.round((width - marginTotal) / totalModules))

      // 总高度 = barHeight + (显示文字 ? fontSize + textMargin + marginTop + marginBottom : marginTop + marginBottom)
      // marginTop/marginBottom 默认 = margin = 10, textMargin = 2
      const marginV = 20 // marginTop + marginBottom
      const textSpace = showText ? fontSize + 2 + marginV : marginV
      const barHeight = Math.max(10, height - textSpace)

      JsBarcode(canvas, fullCode, {
        format: format as any,
        width: moduleWidth,
        height: barHeight,
        displayValue: showText,
        fontSize: fontSize,
        font: fontFamily,
        fontOptions: "",
        textMargin: 2,
        margin: 10,
        background: "#ffffff",
        lineColor: "#000000",
      })
      setGenerated(true)
      incrementBarcode().then((newCount) => setBarcodeCount(newCount))
    } catch (err) {
      console.error("条码生成失败:", err)
      alert(`条码生成失败：${err instanceof Error ? err.message : "请检查输入值是否符合格式要求"}`)
    }
  }, [codeValue, fullEAN13, format, width, height, showText, fontSize, fontFamily])

  // 尺寸或文字参数变化时自动重新生成
  useEffect(() => {
    if (generated) {
      const t = setTimeout(() => handleGenerate(), 150)
      return () => clearTimeout(t)
    }
  }, [width, height, fontSize, showText, fontFamily, format])

  /* ── 应用预设尺寸 ── */
  const applyPreset = (preset: Preset) => {
    setWidth(preset.w)
    setHeight(preset.h)
  }

  /* ── 下载 PNG ── */
  const handleDownloadPNG = useCallback(async () => {
    const fullCode = fullEAN13 || codeValue
    if (!fullCode) return
    try {
      const JsBarcode = (await import("jsbarcode")).default
      const scale = 3
      const exportCanvas = document.createElement("canvas")
      const totalModules = estimateModules(format)
      const moduleWidth = Math.max(1, Math.round((width * scale - 20) / totalModules))
      const textSpace = showText ? fontSize * scale + 2 + 20 : 20
      const barHeight = Math.max(10, height * scale - textSpace)

      exportCanvas.width = width * scale
      exportCanvas.height = height * scale

      JsBarcode(exportCanvas, fullCode, {
        format: format as any,
        width: moduleWidth,
        height: barHeight,
        displayValue: showText,
        fontSize: fontSize * scale,
        font: fontFamily,
        fontOptions: "",
        textMargin: 2,
        margin: 10 * scale,
        background: "#ffffff",
        lineColor: "#000000",
      })
      const link = document.createElement("a")
      link.download = `barcode-${fullCode}.png`
      link.href = exportCanvas.toDataURL("image/png")
      link.click()
    } catch (err) {
      console.error("PNG 导出失败:", err)
      alert("PNG 导出失败，请重试")
    }
  }, [codeValue, fullEAN13, format, width, height, showText, fontSize, fontFamily])

  /* ── 下载 SVG ── */
  const handleDownloadSVG = useCallback(async () => {
    const fullCode = fullEAN13 || codeValue
    if (!fullCode) return
    try {
      const JsBarcode = (await import("jsbarcode")).default
      const totalModules = estimateModules(format)
      const moduleWidth = Math.max(1, Math.round((width - 20) / totalModules))
      const textSpace = showText ? fontSize + 2 + 20 : 20
      const barHeight = Math.max(10, height - textSpace)

      // 用正确的 namespace 创建 SVG 元素
      const svgns = "http://www.w3.org/2000/svg"
      const svg = document.createElementNS(svgns, "svg")
      svg.setAttribute("xmlns", svgns)

      JsBarcode(svg as any, fullCode, {
        format: format as any,
        width: moduleWidth,
        height: barHeight,
        displayValue: showText,
        fontSize: fontSize,
        font: fontFamily,
        fontOptions: "",
        textMargin: 2,
        margin: 10,
        background: "#ffffff",
        lineColor: "#000000",
      } as any)

      // 修正 SVG font-size：JsBarcode 设置的是纯数字，需要补 px 单位
      const textElems = svg.querySelectorAll("text")
      textElems.forEach((el) => {
        const fs = el.getAttribute("font-size")
        if (fs && !fs.includes("px")) {
          el.setAttribute("font-size", fs + "px")
        }
      })

      const data = new XMLSerializer().serializeToString(svg)
      const blob = new Blob([data], { type: "image/svg+xml;charset=utf-8" })
      const link = document.createElement("a")
      link.download = `barcode-${fullCode}.svg`
      link.href = URL.createObjectURL(blob)
      link.click()
      URL.revokeObjectURL(link.href)
    } catch (err) {
      console.error("SVG 导出失败:", err)
      alert(`SVG 导出失败：${err instanceof Error ? err.message : "未知错误"}`)
    }
  }, [codeValue, fullEAN13, format, width, height, showText, fontSize, fontFamily])

  const handleCopyValue = () => {
    const full = fullEAN13 || codeValue
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
            <label className={styles.label}>
              条码数值
              {(() => {
                const lenMap: Record<string, number> = { ean13: 13, ean8: 8, upc: 12, itf14: 14 }
                const expected = lenMap[format]
                if (expected) {
                  return <span className={styles.digitCount}>{codeValue.length}/{expected}</span>
                }
                return null
              })()}
            </label>
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

          {/* 3. 尺寸预设 */}
          <div className={styles.field}>
            <label className={styles.label}>比例预设</label>
            <div className={styles.presetRow}>
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  className={`${styles.presetBtn} ${
                    width === preset.w && height === preset.h ? styles.presetBtnActive : ""
                  }`}
                  onClick={() => applyPreset(preset)}
                  title={`${preset.ratio}（${preset.w}×${preset.h}）`}
                >
                  <RatioIcon icon={preset.icon} />
                  <span className={styles.presetLabel}>{preset.label}</span>
                </button>
              ))}
            </div>
            <p className={styles.hint}>点击预设快速设置尺寸，或手动输入</p>
          </div>

          {/* 4. 尺寸手动调整 */}
          <div className={styles.field}>
            <label className={styles.label}>条码尺寸</label>
            <div className={styles.sizeRow}>
              <div className={styles.sizeInput}>
                <span className={styles.sizeLabel}>宽</span>
                <input
                  type="number"
                  className={styles.input}
                  value={width}
                  onChange={(e) => setWidth(Math.max(50, Math.min(1200, Number(e.target.value) || 50)))}
                  min={50}
                  max={1200}
                />
              </div>
              <span className={styles.sizeSep}>×</span>
              <div className={styles.sizeInput}>
                <span className={styles.sizeLabel}>高</span>
                <input
                  type="number"
                  className={styles.input}
                  value={height}
                  onChange={(e) => setHeight(Math.max(30, Math.min(600, Number(e.target.value) || 30)))}
                  min={30}
                  max={600}
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
          </div>

          {/* 5. 显示文字 */}
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

          {/* 6. 字体设置 */}
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
                    onChange={(e) => setFontSize(Math.max(8, Math.min(48, Number(e.target.value) || 14)))}
                    min={8}
                    max={48}
                    step={1}
                  />
                </div>
              </div>
              <p className={styles.hint}>
                条码文字过小可能导致扫码设备无法识别，建议 &ge; 14px
              </p>
            </div>
          )}

          {/* 7. 生成按钮 */}
          <button
            className={styles.generateBtn}
            onClick={handleGenerate}
            disabled={!fontsReady}
          >
            {fontsReady ? "生成条码" : "加载字体中..."}
          </button>
        </div>

        {/* 右侧预览区 */}
        <div className={styles.preview}>
          <div className={styles.previewWrapper}>
            {generated && (
              <span className={styles.badgeAuth}>
                基于 JsBarcode 渲染引擎生成
              </span>
            )}
            <div className={styles.previewCard}>
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
                    <button className={styles.downloadBtn} onClick={handleDownloadPNG}>
                      下载 PNG（高清）
                    </button>
                    <button className={styles.downloadBtnOutline} onClick={handleDownloadSVG}>
                      下载 SVG（矢量）
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className={styles.placeholder}>
                  <span className={styles.placeholderIcon}>∥∥∥∥∥∥∥∥∥</span>
                  <p>输入条码数值并选择尺寸预设</p>
                </div>
              )}
            </div>
            {barcodeCount > 0 && (
              <div className={styles.usageCounter}>
                已为您生成过 {barcodeCount} 张条码
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
