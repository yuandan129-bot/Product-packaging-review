import { NextRequest, NextResponse } from "next/server"

interface TextBlock {
  content: string
  category: string
  bbox: [number, number, number, number]
  position: string
}

interface QwenVLResult {
  textBlocks: TextBlock[]
  imageDescription: string
}

interface CheckIssue {
  severity: "error" | "warning"
  category: string
  message: string
}

interface TypoIssue {
  severity: "error" | "warning"
  category: string
  wrong: string
  correct: string
  message: string
}

type AgentCheckFn = () => Promise<{
  name: string
  issues: CheckIssue[] | TypoIssue[]
  checklist?: { [key: string]: boolean }
  error?: string
}>

/* ── Qwen-VL 视觉提取 ── */
const VISION_PROMPT = `你是一个包装标签文字提取专家。请仔细查看这张包装设计图，提取所有文字信息。

要求：
1. 提取图片中所有可见的文字，原样输出，不要修改
2. 对每个文字块，提供归一化坐标 bbox（0-1000），格式为 [x1, y1, x2, y2]
3. 识别每个文字块的类别：产品名称、配料表、净含量、生产日期、保质期、营养成分表、生产者信息、致敏原、执行标准、SC证号、其他
4. 标注每个文字块的大致位置：上部/中部/下部
5. 在 imageDescription 中简要描述包装整体布局（横向/纵向，几栏结构等）

严格返回 JSON，不要其他文字：
{
  "textBlocks": [{ "content": "原文", "category": "类别", "bbox": [x1,y1,x2,y2], "position": "位置" }],
  "imageDescription": "布局描述"
}`

/* ── 模块化 Agent 检查 ── */

/** 识别包装中包含了哪些内容类型，用于判断需要触发哪些检查 */
function detectContentTypes(blocks: TextBlock[]): {
  hasNutrition: boolean
  hasIngredients: boolean
  hasStandard: boolean
  hasNetWeight: boolean
  hasProductionDate: boolean
  hasShelfLife: boolean
  allText: string
} {
  const allText = blocks.map((b) => b.content).join("\n")
  const allCategories = blocks.map((b) => b.category).join(" ")
  return {
    hasNutrition: /营养|NRV|nrv|能量|蛋白|脂肪|碳水|钠/.test(allText),
    hasIngredients: /配料|原料/.test(allText),
    hasStandard: /GB|gb|Q\/|执行标准/.test(allText),
    hasNetWeight: /净含量|净重/.test(allText),
    hasProductionDate: /生产日期/.test(allText),
    hasShelfLife: /保质期/.test(allText),
    allText: allText.slice(0, 5000),
  }
}

/** Agent 1: 9大强制标注项检查 — 始终执行 */
function mandatoryCheckAgent(blocks: TextBlock[], allText: string): AgentCheckFn {
  return async () => {
    const textSummary = blocks
      .map((b) => `[${b.category}] ${b.content}`)
      .join("\n")
    try {
      const resp = await callDeepSeek(
        `你是食品包装标签合规专家。只检查以下 9 项强制标注是否齐全。
每一项只能是 true（存在且规范）或 false（缺失或不规范）：
品名、配料表、净含量、生产日期、保质期、生产者信息、致敏原标注、执行标准号、SC证号。

只返回 JSON：
{
  "issues": [{ "severity": "error", "category": "强制标注缺失", "message": "..." }],
  "checklist": { "品名": true, "配料表": true, "净含量": true, "生产日期": true, "保质期": true, "致敏原标注": true, "营养成分表": true, "生产者信息": true, "执行标准号": true, "SC证号": true }
}`,
        textSummary,
      )
      const data = JSON.parse(extractJSON(resp))
      return { name: "强制标注项检查", issues: data.issues || [], checklist: data.checklist }
    } catch (e: any) {
      return { name: "强制标注项检查", issues: [], error: e.message }
    }
  }
}

/** Agent 2: 广告法禁用词 — 有文本就执行 */
function advertisingCheckAgent(allText: string): AgentCheckFn {
  return async () => {
    const textSample = allText.slice(0, 3000)
    try {
      const resp = await callDeepSeek(
        `你是广告法合规专家。扫描以下包装文字，找出违反《广告法》的禁用词（最、第一、顶级、极致、首选、唯一、第一品牌、国家级、世界级等绝对化用语）。

只返回 JSON：
{ "issues": [{ "severity": "error或warning", "category": "广告法", "message": "具体违规内容和条款" }] }`,
        textSample,
      )
      const data = JSON.parse(extractJSON(resp))
      return { name: "广告法禁用词", issues: data.issues || [] }
    } catch (e: any) {
      return { name: "广告法禁用词", issues: [], error: e.message }
    }
  }
}

/** Agent 3: 错别字扫描 — 有文本就执行 */
function typoCheckAgent(allText: string): AgentCheckFn {
  return async () => {
    const textSample = allText.slice(0, 3000)
    try {
      const resp = await callDeepSeek(
        `你是中文错别字检测专家。扫描以下包装文字中的错别字，常见错误包括：
保质→保盾、脂肪→脂防、钠→纳、蛋白质→蛋白贡、碳水→碳木、致敏原→致敏源 等。

只返回 JSON：
{ "issues": [{ "severity": "error或warning", "category": "错别字", "wrong": "错误文字", "correct": "正确文字", "message": "说明" }] }`,
        textSample,
      )
      const data = JSON.parse(extractJSON(resp))
      return { name: "错别字扫描", issues: data.issues || [] }
    } catch (e: any) {
      return { name: "错别字扫描", issues: [], error: e.message }
    }
  }
}

/** Agent 4: 营养成分表 — 仅检测到时执行 */
function nutritionCheckAgent(blocks: TextBlock[], hasPhysicalDims: boolean, physicalWidth?: string, physicalHeight?: string): AgentCheckFn | null {
  const nutritionBlocks = blocks.filter(
    (b) => /营养|NRV|能量|蛋白|脂肪|碳水|钠/.test(b.content) || b.category === "营养成分表"
  )
  if (nutritionBlocks.length === 0) return null

  return async () => {
    const nutritionText = nutritionBlocks.map((b) => b.content).join("\n")
    try {
      const resp = await callDeepSeek(
        `你是食品营养标签专家。检查营养成分表的格式和内容是否符合 GB 28050：

1. 必须包含：能量(kJ)、蛋白质(g)、脂肪(g)、碳水化合物(g)、钠(mg)
2. NRV% 是否合理
3. 单位和修约间隔是否正确
4. "0"界限值是否合规

只返回 JSON：
{ "issues": [{ "severity": "error或warning", "category": "营养成分表", "message": "问题描述及违反的条款" }] }`,
        nutritionText,
      )
      const data = JSON.parse(extractJSON(resp))
      return { name: "营养成分表检查", issues: data.issues || [] }
    } catch (e: any) {
      return { name: "营养成分表检查", issues: [], error: e.message }
    }
  }
}

/** Agent 5: 配料表顺序 — 仅检测到时执行 */
function ingredientsCheckAgent(blocks: TextBlock[]): AgentCheckFn | null {
  const ingredientBlocks = blocks.filter(
    (b) => /配料|原料/.test(b.content) || b.category === "配料表"
  )
  if (ingredientBlocks.length === 0) return null

  return async () => {
    const ingredientText = ingredientBlocks.map((b) => b.content).join("\n")
    try {
      const resp = await callDeepSeek(
        `你是食品配料标注专家。检查配料表是否按 GB 7718 要求从高到低排列（添加量递减）。
如果配料表以"食品添加剂"单独列出，检查其标注格式。

只返回 JSON：
{ "issues": [{ "severity": "error或warning", "category": "配料表", "message": "问题描述及违反的条款" }] }`,
        ingredientText,
      )
      const data = JSON.parse(extractJSON(resp))
      return { name: "配料表检查", issues: data.issues || [] }
    } catch (e: any) {
      return { name: "配料表检查", issues: [], error: e.message }
    }
  }
}

/** Agent 6: 执行标准 — 仅检测到时执行 */
function standardCheckAgent(blocks: TextBlock[]): AgentCheckFn | null {
  const standardBlocks = blocks.filter(
    (b) => /GB|Q\/|执行标准/.test(b.content) || b.category === "执行标准"
  )
  if (standardBlocks.length === 0) return null

  return async () => {
    const standardText = standardBlocks.map((b) => b.content).join("\n")
    try {
      const resp = await callDeepSeek(
        `你是食品标准合规专家。检查包装上标注的执行标准号是否现行有效。
判断标准号格式是否正确，是否存在已废止或被替代的标准。

只返回 JSON：
{ "issues": [{ "severity": "error或warning", "category": "执行标准", "message": "问题描述" }], "standardName": "标准号", "standardStatus": "current或expired或error" }`,
        standardText,
      )
      const data = JSON.parse(extractJSON(resp))
      return { name: "执行标准检查", issues: data.issues || [] }
    } catch (e: any) {
      return { name: "执行标准检查", issues: [], error: e.message }
    }
  }
}

/** Agent 7: 文字高度合规 — 仅提供物理尺寸时执行 */
function textHeightCheckAgent(blocks: TextBlock[], physicalWidth: string, physicalHeight: string, imageDescription: string): AgentCheckFn {
  return async () => {
    const blocksWithBbox = blocks.filter((b) => b.bbox && b.bbox.length === 4)
    const blocksJson = JSON.stringify(blocksWithBbox.slice(0, 30))
    try {
      const resp = await callDeepSeek(
        `你是包装文字排版合规专家。根据 GB 7718，包装上强制标注内容的文字高度不得小于 1.8mm。

已知：包装物理宽度 ${physicalWidth}mm，物理高度 ${physicalHeight}mm
图片布局：${imageDescription}

请根据每个文字块的 bbox 坐标估算其物理文字高度：
文字高度(mm) = (bbox_y2 - bbox_y1) / 1000 × 图片实际对应高度(mm)

仅分析净含量、品名、配料表标题等关键标注文字的高度。

只返回 JSON：
{ "issues": [{ "severity": "error或warning", "category": "文字高度", "content": "文字内容", "estimatedHeightMM": 数字, "message": "文字高度约Xmm，低于/满足GB 7718要求的1.8mm最小字高" }] }`,
        blocksJson,
      )
      const data = JSON.parse(extractJSON(resp))
      return { name: "文字高度检查", issues: data.issues || [] }
    } catch (e: any) {
      return { name: "文字高度检查", issues: [], error: e.message }
    }
  }
}

/** Agent 8: 品牌一致性 — 仅提供品牌文件时执行 */
function brandCheckAgent(blocks: TextBlock[], brandContext: string): AgentCheckFn {
  return async () => {
    const textSummary = blocks.map((b) => `[${b.category}] ${b.content}`).join("\n")
    try {
      const resp = await callDeepSeek(
        `你是品牌合规审核专家。请将以下品牌规范与包装实际文字逐项核对，检查是否一致。
重点核对：企业名称、地址、电话、SC证号、委托方/受委托方信息。
如有不一致请作为严重错误报告。

只返回 JSON：
{ "issues": [{ "severity": "error", "category": "品牌比对", "message": "不一致的具体内容和差异" }] }`,
        textSummary,
        brandContext,
      )
      const data = JSON.parse(extractJSON(resp))
      return { name: "品牌一致性检查", issues: data.issues || [] }
    } catch (e: any) {
      return { name: "品牌一致性检查", issues: [], error: e.message }
    }
  }
}

/* ── 工具函数 ── */

function extractJSON(content: string): string {
  return content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/\s*```$/, "")
    .trim()
}

async function callDeepSeek(systemPrompt: string, userContent: string, brandContext?: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY!
  const models = ["deepseek-chat", "deepseek-v4-flash"]
  let lastError = ""

  for (const model of models) {
    try {
      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt + (brandContext || "") },
            { role: "user", content: userContent },
          ],
          response_format: { type: "json_object" },
          max_tokens: 2048,
          temperature: 0.1,
        }),
        signal: AbortSignal.timeout(90000),
      })

      if (response.ok) {
        const data = await response.json()
        return data.choices?.[0]?.message?.content || ""
      }
      const errText = await response.text().catch(() => "")
      lastError = `${model}: ${response.status} ${errText.slice(0, 100)}`
      console.warn("DeepSeek call failed:", lastError)
    } catch (err: any) {
      lastError = `${model}: ${err.message}`
      console.warn("DeepSeek error:", lastError)
    }
  }
  throw new Error(lastError || "所有模型调用失败")
}

/* ── 主 API 路由 ── */

export async function POST(request: NextRequest) {
  try {
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json({ error: "未上传文件" }, { status: 400 })
    }

    const file = formData.get("file") as File
    if (!file) return NextResponse.json({ error: "未上传文件" }, { status: 400 })
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "文件大小超过 10MB" }, { status: 400 })

    const physicalWidth = formData.get("physicalWidth") as string | null
    const physicalHeight = formData.get("physicalHeight") as string | null
    const hasPhysicalDims = !!(physicalWidth && physicalHeight)

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64Image = buffer.toString("base64")
    const mimeType = file.type || "image/jpeg"

    // ──── 阶段 1: Qwen-VL 视觉提取 ────
    const dashscopeKey = process.env.DASHSCOPE_API_KEY
    let visionResult: QwenVLResult | null = null
    let ocrTextFallback = ""

    if (dashscopeKey) {
      try {
        const visionResponse = await fetch(
          "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${dashscopeKey}`,
            },
            body: JSON.stringify({
              model: "qwen-vl-max",
              messages: [
                { role: "system", content: VISION_PROMPT },
                {
                  role: "user",
                  content: [
                    { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } },
                    { type: "text", text: "请提取文字及空间位置。" },
                  ],
                },
              ],
              max_tokens: 4096,
              temperature: 0.1,
            }),
            signal: AbortSignal.timeout(60000),
          }
        )

        if (visionResponse.ok) {
          const data = await visionResponse.json()
          const content = data.choices?.[0]?.message?.content
          if (content) visionResult = JSON.parse(extractJSON(content))
        } else {
          console.warn("Qwen-VL failed:", visionResponse.status)
        }
      } catch (err: any) {
        console.warn("Qwen-VL error:", err.message)
      }
    }

    if (!visionResult) {
      try {
        const { createWorker } = await import("tesseract.js")
        const worker = await createWorker("chi_sim+eng")
        const { data } = await worker.recognize(buffer)
        ocrTextFallback = data.text || ""
        await worker.terminate()
      } catch (ocrErr) {
        console.error("Tesseract OCR failed:", ocrErr)
        return NextResponse.json({ error: "图片文字识别失败" }, { status: 500 })
      }
      if (!ocrTextFallback.trim()) {
        return NextResponse.json({ error: "未识别到文字" }, { status: 400 })
      }
    }

    if (!process.env.DEEPSEEK_API_KEY) {
      return NextResponse.json({ error: "未配置 DEEPSEEK_API_KEY" }, { status: 500 })
    }

    // ──── 品牌文件 ────
    let brandContext = ""
    const brandFilesStr = formData.get("brandFiles") as string | null
    if (brandFilesStr) {
      try {
        const brandFiles: { name: string; type: string; content: string }[] = JSON.parse(brandFilesStr)
        const textFiles = brandFiles.filter((f) => !f.type.startsWith("image/") && !f.content.startsWith("data:image"))
        if (textFiles.length > 0) {
          brandContext = "\n\n【品牌规范】\n" + textFiles.map((f) => `--- ${f.name} ---\n${f.content.slice(0, 2000)}`).join("\n\n")
        }
      } catch { /* ignore */ }
    }

    // ──── 阶段 2: 多 Agent 并行分析 ────
    const blocks = visionResult?.textBlocks || []
    const allText = blocks.map((b) => b.content).join("\n") || ocrTextFallback
    const contentTypes = detectContentTypes(blocks.length > 0 ? blocks : [])

    // 组装 Agent 列表：按需触发
    const agents: AgentCheckFn[] = []

    // 始终执行
    agents.push(mandatoryCheckAgent(blocks, allText))
    agents.push(advertisingCheckAgent(allText))
    agents.push(typoCheckAgent(allText))

    // 按内容类型触发
    const nutritionAgent = nutritionCheckAgent(blocks, hasPhysicalDims, physicalWidth || undefined, physicalHeight || undefined)
    if (nutritionAgent) agents.push(nutritionAgent)

    const ingredientsAgent = ingredientsCheckAgent(blocks)
    if (ingredientsAgent) agents.push(ingredientsAgent)

    const standardAgent = standardCheckAgent(blocks)
    if (standardAgent) agents.push(standardAgent)

    // 按条件触发
    if (hasPhysicalDims && physicalWidth && physicalHeight && visionResult) {
      agents.push(textHeightCheckAgent(blocks, physicalWidth, physicalHeight, visionResult.imageDescription))
    }

    if (brandContext) {
      agents.push(brandCheckAgent(blocks, brandContext))
    }

    // 顺序执行 Agent，避免并行调用触发 DeepSeek 限流
    console.log(`[analyze] Running ${agents.length} agent checks sequentially...`)
    const agentResults: Awaited<ReturnType<AgentCheckFn>>[] = []
    for (let i = 0; i < agents.length; i++) {
      // Agent 之间间隔 500ms，避免触发频率限制
      if (i > 0) await new Promise((r) => setTimeout(r, 500))
      agentResults.push(await agents[i]())
    }

    // ──── 合并结果 ────
    const criticalErrors: any[] = []
    const warnings: any[] = []
    const typoIssues: any[] = []
    const textHeightIssues: any[] = []
    let mergedChecklist: { [key: string]: boolean } = {}
    let productName = ""
    let category = ""
    let standard = ""
    let standardStatus: "current" | "expired" | "error" = "current"
    const agentErrors: string[] = []

    for (const result of agentResults) {
      if (result.error) {
        agentErrors.push(`${result.name}: ${result.error}`)
        continue
      }
      for (const issue of result.issues) {
        if (result.name === "错别字扫描") {
          typoIssues.push(issue)
        } else if (result.name === "文字高度检查") {
          textHeightIssues.push(issue)
        } else if (issue.severity === "error") {
          criticalErrors.push(issue)
        } else {
          warnings.push(issue)
        }
      }
      if (result.checklist) {
        mergedChecklist = { ...mergedChecklist, ...result.checklist }
      }
    }

    // 从文字块提取基本信息
    if (blocks.length > 0) {
      productName = blocks.find((b) => b.category === "产品名称")?.content || ""
      category = blocks.find((b) => /食品|类别|类型/.test(b.category))?.content || ""
      standard = blocks.find((b) => b.category === "执行标准")?.content || ""
    }

    return NextResponse.json({
      productName,
      category,
      standard,
      standardStatus,
      criticalErrors,
      warnings,
      typoIssues,
      textHeightIssues: textHeightIssues.length > 0 ? textHeightIssues : undefined,
      checklist: {
        品名: !!mergedChecklist["品名"],
        配料表: !!mergedChecklist["配料表"],
        生产日期: !!mergedChecklist["生产日期"],
        保质期: !!mergedChecklist["保质期"],
        致敏原标注: !!mergedChecklist["致敏原标注"],
        营养成分表: !!mergedChecklist["营养成分表"],
        生产者信息: !!mergedChecklist["生产者信息"],
        错别字检测: typoIssues.length === 0,
        净含量: !!mergedChecklist["净含量"],
        ...(hasPhysicalDims ? { "文字高度合规": textHeightIssues.filter((i: any) => i.severity === "error").length === 0 } : {}),
      },
      _meta: {
        visionModel: visionResult ? "qwen-vl-max" : "tesseract.js (fallback)",
        agentsRun: agentResults.length,
        agentsFailed: agentErrors.length,
        agentErrors: agentErrors.length > 0 ? agentErrors : undefined,
      },
    })
  } catch (error) {
    console.error("Analyze error:", error)
    return NextResponse.json({ error: "分析失败，请重试" }, { status: 500 })
  }
}
