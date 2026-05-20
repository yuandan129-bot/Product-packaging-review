"use client"

import { useEffect } from "react"
import { motion } from "motion/react"

interface DocumentModalProps {
  title: string
  code: string
  docPath: string | null
  onClose: () => void
}

// 26年新国标速览 —— 包装设计师日常速查手册
const NEW_STANDARDS_SUMMARY = `## 2026 年食品标签新国标速览 · 设计师速查手册

---

### 一、文字高度硬指标（一眼看出错）

| 标注项 | 最小字高 | 备注 |
|--------|:---:|------|
| 产品名称 | ≥ 1.8mm | 正面最醒目位置 |
| 净含量 | ≥ 4mm（≤200g/ml）<br>≥ 6mm（200g-1kg/L）<br>≥ 8mm（＞1kg/L） | 与品名同一展示面 |
| 生产日期 | ≥ 3mm | 不得使用"见包装"等模糊引导语，格式统一为 YYYY.MM.DD |
| 保质期 | ≥ 3mm | 必须标注到年月日 |
| 致敏原提示 | ≥ 1.8mm | 配料表中加粗或单独醒目标注 |
| 营养成分表 | ≥ 1.8mm | 表格内文字不低于此高度，标题需加粗 |

> 换算：1mm ≈ 2.83pt（72dpi），包装宽 200mm 时，1.8mm 约占画面高度的 0.9%

---

### 二、包装正面 · 必须标注（5 大件）

1. **产品名称** — 反映食品真实属性，不得使用"神奇""超级"等夸大词
2. **净含量** — 与品名同一展示面，单位：g（固态）/ mL（液态）/ 粒（计数）
3. **生产日期** — 统一格式 YYYY.MM.DD
4. **保质期** — 必须标注"保质期至"或"此日期前最佳"
5. **生产者名称 + 地址** — 委托加工的需同时标注委托方和被委托方

> 注意：正面信息全部字体高度 ≥ 1.8mm

---

### 三、包装背面（背标）· 完整模板顺序

背标应按以下顺序完整排列：

1. **产品名称**（同正面）
2. **配料表** — 按添加量从多到少排列，致敏原**加粗**或**下划线**醒目标注
3. **净含量**
4. **生产日期 / 保质期**
5. **贮存条件** — 明确温度、湿度、避光等要求
6. **执行标准号** — GB/T 或 SB/T 开头，确认现行有效
7. **SC 证号** — SC+14 位数字，委托加工需双证号
8. **生产者信息** — 名称 + 地址 + 电话，委托加工加标委托方信息
9. **营养成分表** — 独立方框，标题加粗

---

### 四、营养成分表 · 格式规范

#### 必须标注的 5 项核心营养素（按顺序）

| 营养素 | 单位 | 修约间隔 | 能量系数 |
|--------|:---:|:---:|:---:|
| 能量 | kJ | 整数 | — |
| 蛋白质 | g | 0.1 | × 17 kJ/g |
| 脂肪 | g | 0.1 | × 37 kJ/g |
| 碳水化合物 | g | 0.1 | × 17 kJ/g |
| 钠 | mg | 整数 | — |

#### 新增强制标注

| 新增项 | 单位 | 修约间隔 | 生效时间 |
|--------|:---:|:---:|:---:|
| **糖** | g | 0.1 | 2026 年强制 |
| 饱和脂肪 | g | 0.1 | 2027 年强制 |

#### 修约规则速记

- 能量、钠 → **整数**，不允许小数点
- 蛋白质、脂肪、碳水、糖 → **小数点后 1 位**（0.1 间隔）
- NRV% → 能量和核心营养素取整数，其他保留 1 位小数

#### 能量验证公式

> 能量(kJ) ≈ 蛋白质(g) × 17 + 脂肪(g) × 37 + 碳水(g) × 17
>
> 若包装标注值与公式计算结果偏差超过 20%，需要修正。

---

### 五、致敏原 · 强制标注清单（2026 新）

8 大类致敏原必须在**配料表**中以加粗、下划线或独立方框醒目标注：

1. 大豆及豆制品（酱油、豆粉、分离蛋白）
2. 坚果类（杏仁、腰果、核桃、开心果）
3. 乳及乳制品（牛奶、乳清粉、乳糖、酪蛋白）
4. 蛋类及蛋制品
5. 花生及花生制品
6. 芝麻及芝麻制品
7. 贝类及甲壳类（虾、蟹、贝）
8. 鱼类及鱼制品

> 致敏原信息可在配料表下方单独另起一行标注"致敏原信息：含XXX"，字体高度 ≥ 1.8mm

---

### 六、广告法 · 禁用词速查

#### 绝对化用语（任何场景禁止）

最、第一、顶级、极致、首选、唯一、全网第一、史上最、100%有效、绝对、永不、万能

#### 虚假/夸大宣传（需提供证据，否则禁止）

- "零添加" → 需提供检测报告证明未检出
- "无农药残留" → 需提供第三方 96 项农残检测报告
- "经 SGS 检测" → 需提供 SGS 原版报告编号
- "100% 天然" → 不符合 GB 7718，禁止使用
- "高钙""低脂""无糖" → 必须满足 GB 28050 营养声称条件

#### 营养声称门槛（GB 28050）

| 声称 | 需满足条件 |
|------|-----------|
| 无糖 | 糖 ≤ 0.5g / 100g（固）或 100mL（液）|
| 低脂 | 脂肪 ≤ 3g / 100g（固）或 1.5g / 100mL（液）|
| 高钙 | 钙 ≥ 240mg / 100g 或 120mg / 100mL |
| 低钠 | 钠 ≤ 120mg / 100g 或 100mL |

---

### 七、常见错误 · 一眼识别

| 常见错误 | 正确做法 |
|----------|---------|
| 糖的单位写成 mg | 必须是 **g** |
| 钠的单位写成 g | 必须是 **mg** |
| 能量的单位写成 kcal | 必须是 **kJ** |
| 配料表未按添加量排序 | 从多到少严格递减 |
| "保盾期" | 应为"保质期" |
| "脂防" | 应为"脂肪" |
| "蛋白贡" | 应为"蛋白质" |
| "纳" | 应为"钠" |
| 生产日期写"见包装底部" | 必须直接打印具体日期 |
| 委托加工只标被委托方 | 必须同时标注委托方和被委托方 |
| SC 证号少位数 | 必须 SC + 14 位数字 |
| 营养成分表用 mg 标糖 | 糖的单位统一用 g |

---

### 八、SC 证号 · 格式说明

- 格式：**SC + 14 位数字**（如 SC12345678901234）
- 严禁使用 QS 标志（已废止）
- 委托加工场景：需同时标注委托方 SC 证号和被委托方 SC 证号
- 2027 年前需完成二维码关联（建议提前预留码区）

---

### 九、执行标准号 · 时效性验证

- 食品行业以 **GB**（强制执行）或 **GB/T**（推荐执行）开头
- 标准号格式：GB XXXX-年份 / GB/T XXXX-年份
- 审核时确认年份为**现行有效版本**
- 常见失效标准示例：GB/T 19343-2017（巧克力）→ 已被 2025 版替代

---

> 📋 本速览仅供设计参考，正式合规审核请查阅国家标准全文。
> 标准来源：国家标准化管理委员会（sac.gov.cn）、国家市场监管总局（samr.gov.cn）`

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
