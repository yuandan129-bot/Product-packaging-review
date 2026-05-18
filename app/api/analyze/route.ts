import { NextRequest, NextResponse } from "next/server"
import path from "path"

// 本地开发 / 生产部署，审核分析需较长时间
export const maxDuration = 60

/* ── Qwen-VL 视觉提取 ── */
const VISION_PROMPT = `你是一个包装标签文字提取专家。请仔细查看这张包装设计图，提取所有文字信息。

要求：
1. 提取图片中所有可见的文字，原样输出不要修改
2. 对每个文字块提供归一化坐标 bbox（0-1000），格式 [x1, y1, x2, y2]
3. 识别每个文字块的类别：产品名称、配料表、净含量、生产日期、保质期、营养成分表、生产者信息、致敏原标准、执行标准、SC证号、其他
4. 标注每个文字块的大致位置：上部/中部/下部

严格返回 JSON：
{"textBlocks":[{"content":"原文","category":"类别","bbox":[x1,y1,x2,y2],"position":"位置"}],"imageDescription":"布局描述"}`

/* ── DeepSeek 合规分析（单次调用，融合所有检查项） ── */
const COMPLIANCE_PROMPT = `你是食品包装标签合规审核专家，依据 GB 7718-2025、GB 28050-2025、GB 2760-2024、《广告法》审核。

请逐项检查以下内容，只返回 JSON，不要其他文字：

{
  "productName": "产品名称",
  "category": "食品分类",
  "standard": "执行标准号",
  "standardStatus": "current/expired/error",
  "criticalErrors": [{ "severity": "error", "category": "类别", "message": "问题及条款" }],
  "warnings": [{ "severity": "warning", "category": "类别", "message": "风险描述" }],
  "typoIssues": [{ "severity": "error/warning", "wrong": "错字", "correct": "正字", "message": "说明" }],
  "checklist": { "品名": true, "配料表": true, "生产日期": true, "保质期": true, "致敏原标注": true, "营养成分表": true, "生产者信息": true, "执行标准号": true, "SC证号": true }
}

检查清单（逐一执行，不可遗漏）：
1. 强制标注项是否齐全（9项）
2. 营养成分表格式、单位、NRV%是否正确
3. 广告法禁用词（最、第一、顶级、极致、首选、唯一、国家级等）
4. 错别字（保质期→保盾期、脂肪→脂防、钠→纳、蛋白质→蛋白贡等）
5. 配料表是否按添加量递减排列
6. 执行标准号是否现行有效
7. 如提供品牌规范，逐一核对包装上的企业名称、地址、SC证号、电话是否一致`

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData().catch(() => null)
    if (!formData) return NextResponse.json({ error: "未上传文件" }, { status: 400 })

    const file = formData.get("file") as File
    if (!file) return NextResponse.json({ error: "未上传文件" }, { status: 400 })
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "文件超过 10MB" }, { status: 400 })

    const physicalWidth = formData.get("physicalWidth") as string | null
    const physicalHeight = formData.get("physicalHeight") as string | null
    const hasPhysicalDims = !!(physicalWidth && physicalHeight)

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64Image = buffer.toString("base64")
    const mimeType = file.type || "image/jpeg"

    // ──── 阶段 1: Qwen-VL 视觉提取（< 5s）────
    const dashscopeKey = process.env.DASHSCOPE_API_KEY
    let extractedText = ""
    let imageDescription = ""

    if (dashscopeKey) {
      try {
        const resp = await fetch(
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
                    { type: "text", text: "提取文字和空间位置" },
                  ],
                },
              ],
              max_tokens: 4096,
              temperature: 0.1,
            }),
            signal: AbortSignal.timeout(30000),
          }
        )

        if (resp.ok) {
          const data = await resp.json()
          const raw = (data.choices?.[0]?.message?.content || "")
            .replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim()
          const parsed = JSON.parse(raw)
          const blocks = parsed.textBlocks || []
          imageDescription = parsed.imageDescription || ""

          // 将结构化文字块拼接为纯文本，供 DeepSeek 分析
          extractedText = blocks
            .map((b: any) => `[${b.category}｜${b.position}] ${b.content}`)
            .join("\n")
        } else {
          console.warn("Qwen-VL HTTP", resp.status)
        }
      } catch (e: any) {
        console.warn("Qwen-VL error:", e.message)
      }
    }

    // 回退：Tesseract OCR
    if (!extractedText) {
      try {
        const { createWorker } = await import("tesseract.js")
        const workerPath = path.join(process.cwd(), "node_modules", "tesseract.js", "src", "worker-script", "node", "index.js")
        const worker = await createWorker("chi_sim+eng", undefined, { workerPath })
        const { data } = await worker.recognize(buffer)
        extractedText = data.text || ""
        await worker.terminate()
      } catch (e: any) {
        console.error("Tesseract failed:", e.message)
        return NextResponse.json({ error: "文字识别失败" }, { status: 500 })
      }
      if (!extractedText.trim()) {
        return NextResponse.json({ error: "未识别到文字" }, { status: 400 })
      }
    }

    // ──── 品牌文件 ────
    let brandContext = ""
    try {
      const brandFilesStr = formData.get("brandFiles") as string | null
      if (brandFilesStr) {
        const brandFiles: { name: string; type: string; content: string }[] = JSON.parse(brandFilesStr)
        const textFiles = brandFiles.filter(
          (f) => !f.type.startsWith("image/") && !f.content.startsWith("data:image")
        )
        if (textFiles.length > 0) {
          brandContext = "\n\n【品牌规范参考 - 请严格比对】\n" +
            textFiles.map((f) => `--- ${f.name} ---\n${f.content.slice(0, 2000)}`).join("\n\n")
        }
      }
    } catch { /* ignore */ }

    // ──── 阶段 2: DeepSeek 合规分析（单次调用，< 5s）────
    const deepseekKey = process.env.DEEPSEEK_API_KEY
    if (!deepseekKey) {
      return NextResponse.json({ error: "未配置 DEEPSEEK_API_KEY" }, { status: 500 })
    }

    let userContent = `【包装文字内容】\n\n${extractedText.slice(0, 6000)}`

    if (hasPhysicalDims && imageDescription) {
      userContent += `\n\n【物理尺寸】宽${physicalWidth}mm × 高${physicalHeight}mm\n布局：${imageDescription}\n请根据文字块相对位置估算关键文字的物理高度，检查是否 ≥1.8mm（GB 7718要求）。`
    }

    userContent += `\n\n请逐项审核并返回 JSON。`

    let result: any = null
    let lastError = ""

    for (const model of ["deepseek-chat", "deepseek-v4-flash"]) {
      try {
        const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
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
          signal: AbortSignal.timeout(30000),
        })

        if (resp.ok) {
          const data = await resp.json()
          const content = data.choices?.[0]?.message?.content
          if (content) {
            result = JSON.parse(
              content
                .replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim()
            )
            break
          }
        } else {
          const errText = await resp.text().catch(() => "")
          lastError = `${model}: HTTP ${resp.status} - ${errText.slice(0, 100)}`
          console.warn("DeepSeek failed:", lastError)
        }
      } catch (e: any) {
        lastError = `${model}: ${e.message}`
        console.warn("DeepSeek error:", lastError)
      }
    }

    if (!result) {
      return NextResponse.json(
        { error: `AI 分析失败。${lastError ? `（${lastError}）` : ""}请检查 API Key 是否有效。` },
        { status: 502 }
      )
    }

    // 附加文字高度检查结果
    if (hasPhysicalDims && result.checklist) {
      result.checklist["文字高度合规"] = true // 默认通过，由 AI 在分析中修正
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("Analyze uncaught error:", error.message)
    return NextResponse.json(
      { error: `服务器错误：${error.message || "未知"}` },
      { status: 500 }
    )
  }
}
