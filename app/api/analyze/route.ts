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

interface AnalysisResult {
  productName: string
  category: string
  standard: string
  standardStatus: "current" | "expired" | "error"
  criticalErrors: any[]
  warnings: any[]
  typoIssues: any[]
  checklist: { [key: string]: boolean }
  textHeightIssues?: any[]
}

/* ── Qwen-VL 视觉提取系统提示 ── */
const VISION_PROMPT = `你是一个包装标签文字提取专家。请仔细查看这张包装设计图，提取所有文字信息。

要求：
1. 提取图片中所有可见的文字，原样输出，不要修改任何文字
2. 对每个文字块，提供其在图片中的归一化坐标 bbox（0-1000），格式为 [x1, y1, x2, y2]
3. 识别每个文字块的类别：产品名称、配料表、净含量、生产日期、保质期、营养成分表、生产者信息、致敏原、执行标准、SC证号、其他
4. 标注每个文字块的大致位置：上部/中部/下部

请严格以 JSON 格式返回，不要其他文字：
{
  "textBlocks": [
    {
      "content": "文字内容原文",
      "category": "类别",
      "bbox": [x1, y1, x2, y2],
      "position": "上部"
    }
  ],
  "imageDescription": "包装整体布局简述"
}`

/* ── DeepSeek 合规分析系统提示 ── */
const COMPLIANCE_PROMPT = `你是一个中国食品包装标签合规审核专家，严格依据 GB 7718-2025 / GB 28050-2025 / GB 2760-2024 /《广告法》审核包装。

下面是从包装图片中通过 AI 视觉模型提取的带空间坐标的文字信息。请逐项审核并返回 JSON：

{
  "productName": "产品名称",
  "category": "食品分类",
  "standard": "执行标准号",
  "standardStatus": "current 或 expired 或 error",
  "criticalErrors": [
    { "severity": "error", "category": "类别", "message": "问题描述及违反的国标条款" }
  ],
  "warnings": [
    { "severity": "warning", "category": "类别", "message": "风险描述" }
  ],
  "typoIssues": [
    { "severity": "error或warning", "category": "类别", "wrong": "识别到的错误文字", "correct": "正确文字", "message": "说明" }
  ],
  "textHeightIssues": [
    { "severity": "error或warning", "content": "文字内容", "estimatedHeightMM": 1.2, "category": "类别", "message": "文字高度约1.2mm，低于GB 7718要求的1.8mm最小字高" }
  ],
  "checklist": {
    "品名": true, "配料表": true, "生产日期": true, "保质期": true,
    "致敏原标注": true, "营养成分表": true, "生产者信息": true,
    "错别字检测": true, "净含量": true, "文字高度合规": true
  }
}

审核要点：
1. 9 大强制标注项是否齐全（品名、配料表、净含量、生产日期、保质期、生产者、致敏原、标准号、SC证号）
2. 营养成分表格式、单位（能量kJ、蛋白质g、脂肪g、碳水g、钠mg）、NRV% 是否正确
3. 是否有广告法禁用词（最、第一、顶级、极致等）
4. 是否存在错别字（保质期→保盾期、脂肪→脂防、钠→纳 等常见错误）
5. 配料表是否按添加量从高到低排列
6. 执行标准号是否现行有效
7. 如提供了品牌规范，请逐一核对图片中的企业名称、地址、电话、SC证号是否与品牌规范一致，不一致请作为严重错误报告
8. 如果提供了图片物理尺寸和文字bbox坐标，请估算每个文字块的实际物理高度(mm)，并检查是否满足GB 7718要求的≥1.8mm

只返回 JSON，不要其他文字。`

export async function POST(request: NextRequest) {
  try {
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json({ error: "未上传文件" }, { status: 400 })
    }

    const file = formData.get("file") as File
    if (!file) {
      return NextResponse.json({ error: "未上传文件" }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "文件大小超过 10MB 限制" }, { status: 400 })
    }

    // 物理尺寸（mm），可选
    const physicalWidth = formData.get("physicalWidth") as string | null
    const physicalHeight = formData.get("physicalHeight") as string | null
    const hasPhysicalDims = physicalWidth && physicalHeight

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
                    {
                      type: "image_url",
                      image_url: {
                        url: `data:${mimeType};base64,${base64Image}`,
                      },
                    },
                    {
                      type: "text",
                      text: "请提取这张包装设计图中的所有文字及其空间位置。",
                    },
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
          if (content) {
            const jsonStr = content
              .replace(/^```json\s*/i, "")
              .replace(/^```\s*/, "")
              .replace(/\s*```$/, "")
              .trim()
            visionResult = JSON.parse(jsonStr)
          }
        } else {
          console.warn("Qwen-VL failed:", visionResponse.status)
        }
      } catch (err: any) {
        console.warn("Qwen-VL error:", err.message)
      }
    }

    // 回退：如果没有 DashScope Key 或 Qwen-VL 调用失败，使用 Tesseract.js
    if (!visionResult) {
      try {
        const { createWorker } = await import("tesseract.js")
        const worker = await createWorker("chi_sim+eng")
        const { data } = await worker.recognize(buffer)
        ocrTextFallback = data.text || ""
        await worker.terminate()
      } catch (ocrErr) {
        console.error("Tesseract OCR failed:", ocrErr)
        return NextResponse.json(
          { error: "图片文字识别失败，请配置 DASHSCOPE_API_KEY 或确认图片清晰可读" },
          { status: 500 }
        )
      }

      if (!ocrTextFallback.trim()) {
        return NextResponse.json(
          { error: "未从图片中识别到文字，请上传清晰的包装背标图片" },
          { status: 400 }
        )
      }
    }

    // ──── 构建 DeepSeek 分析输入 ────
    let userContent = ""

    if (visionResult && visionResult.textBlocks && visionResult.textBlocks.length > 0) {
      // Qwen-VL 成功：组装结构化信息
      const blocksJson = visionResult.textBlocks
        .map((b) => ({
          content: b.content,
          category: b.category,
          bbox: b.bbox,
          position: b.position,
        }))
      userContent = `【AI 视觉识别的包装文字及空间信息】\n\n${JSON.stringify(blocksJson, null, 2)}`

      if (visionResult.imageDescription) {
        userContent += `\n\n【包装整体布局】\n${visionResult.imageDescription}`
      }
    } else {
      // 回退：使用 Tesseract OCR 文字
      userContent = `【OCR 识别文字】\n\n${ocrTextFallback.slice(0, 8000)}`
    }

    // 附加物理尺寸信息，用于文字高度合规检查
    if (hasPhysicalDims && visionResult) {
      userContent += `\n\n【图片物理尺寸（用于计算文字实际高度）】\n包装实际宽度：${physicalWidth}mm\n包装实际高度：${physicalHeight}mm\n\n请根据文字块的 bbox 归一化坐标和图片物理尺寸，估算每个文字块的实际物理高度。计算公式：文字物理高度(mm) = (bbox高度差/1000) × 图片对应方向像素尺寸 × (物理尺寸mm/像素尺寸)。重点检查净含量、品名等关键文字的高度是否 ≥ 1.8mm（GB 7718 强制要求）。`
    }

    userContent += `\n\n请逐项审核并返回 JSON。`

    // ──── 品牌规范文件 ────
    let brandContext = ""
    const brandFilesStr = formData.get("brandFiles") as string | null
    if (brandFilesStr) {
      try {
        const brandFiles: { name: string; type: string; content: string }[] =
          JSON.parse(brandFilesStr)
        const textFiles = brandFiles.filter(
          (f) => !f.type.startsWith("image/") && !f.content.startsWith("data:image")
        )
        if (textFiles.length > 0) {
          brandContext =
            "\n\n【品牌规范参考 - 请严格比对】\n" +
            textFiles
              .map((f) => `--- ${f.name} ---\n${f.content.slice(0, 2000)}`)
              .join("\n\n")
        }
      } catch {
        // 忽略品牌文件解析错误
      }
    }

    // ──── 阶段 2: DeepSeek 合规分析 ────
    const deepseekKey = process.env.DEEPSEEK_API_KEY
    if (!deepseekKey) {
      return NextResponse.json(
        { error: "未配置 DEEPSEEK_API_KEY" },
        { status: 500 }
      )
    }

    const modelNames = ["deepseek-chat", "deepseek-v4-flash"]
    let result: AnalysisResult | null = null
    let lastError = ""

    for (const model of modelNames) {
      try {
        const response = await fetch(
          "https://api.deepseek.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${deepseekKey}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: COMPLIANCE_PROMPT + brandContext },
                { role: "user", content: userContent },
              ],
              response_format: { type: "json_object" },
              max_tokens: 4096,
              temperature: 0.1,
            }),
            signal: AbortSignal.timeout(120000),
          }
        )

        if (response.ok) {
          const data = await response.json()
          const content = data.choices?.[0]?.message?.content
          if (content) {
            const jsonStr = content
              .replace(/^```json\s*/i, "")
              .replace(/^```\s*/, "")
              .replace(/\s*```$/, "")
              .trim()
            result = JSON.parse(jsonStr)
            break
          }
        } else {
          const errText = await response.text().catch(() => "")
          lastError = `${model}: ${response.status} ${errText.slice(0, 200)}`
          console.warn("DeepSeek attempt failed:", lastError)
        }
      } catch (err: any) {
        lastError = `${model}: ${err.message || "unknown"}`
        console.warn("DeepSeek error:", lastError)
      }
    }

    if (!result) {
      return NextResponse.json(
        {
          error: `AI 分析失败（${lastError || "未知错误"}）。请确认 API Key 有效且账户余额充足。`,
        },
        { status: 502 }
      )
    }

    // 附加视觉提取信息到报告中
    return NextResponse.json({
      ...result,
      _vision: visionResult
        ? { model: "qwen-vl-max", blocksCount: visionResult.textBlocks?.length || 0 }
        : { model: "tesseract.js (fallback)", blocksCount: 0 },
      _physicalDims: hasPhysicalDims
        ? { widthMM: parseFloat(physicalWidth!), heightMM: parseFloat(physicalHeight!) }
        : null,
    })
  } catch (error) {
    console.error("Analyze error:", error)
    return NextResponse.json(
      { error: "分析失败，请重试" },
      { status: 500 }
    )
  }
}
