import { NextRequest, NextResponse } from "next/server"

export const maxDuration = 60

/* ── Kimi K2.5 多模态合规分析 Prompt（精简版，降低 token 消耗）── */
const SYSTEM_PROMPT = `你是食品包装标签合规审核专家，依据 GB 7718-2025、GB 28050-2025、GB 2760-2024、《广告法》审核。

查看包装图片，提取所有文字并逐项审核。严格只返回 JSON，不要其他文字：

{
  "productName": "产品名称",
  "category": "食品分类",
  "standard": "执行标准号",
  "standardStatus": "current/expired/error",
  "criticalErrors": [{"severity":"error","category":"类别","message":"问题及条款","position":"问题在图片上的具体位置（如'左上角产品名称区域'）","referenceDoc":"品牌规范文件名或null"}],
  "warnings": [{"severity":"warning","category":"类别","message":"风险描述","position":"位置描述","referenceDoc":"文件名或null"}],
  "typoIssues": [{"severity":"error/warning","wrong":"错字","correct":"正字","message":"说明","position":"位置描述"}],
  "checklist": {"品名":true,"配料表":true,"生产日期":true,"保质期":true,"致敏原标注":true,"营养成分表":true,"生产者信息":true,"执行标准号":true,"SC证号":true}
}

逐项检查（不可遗漏）：
1. 强制标注项是否齐全（9项）
2. 营养成分表格式、单位(g/mg/kJ)、NRV%是否正确
3. 广告法禁用词：最、第一、顶级、极致、首选、唯一、国家级等
4. 错别字：保质期→保盾期、脂肪→脂防、钠→纳、蛋白质→蛋白贡等
5. 配料表是否按添加量递减排列
6. 执行标准号是否现行有效
7. 如有品牌规范，逐一核对包装上的企业名称、地址、SC证号、电话是否一致

每个问题（criticalErrors/warnings/typoIssues）都必须标注：
- position：问题在图片上的具体位置。你直接看到了图片，用自然语言精确描述（如"包装正面左上角产品名称区域"、"背标中部营养成分表第三行"、"右下角生产者信息栏"）
- referenceDoc：如品牌规范文件中有对应的正确信息，标注文件名（如"brand_standard_v2.txt"），否则填 null`

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

    // ── 图片压缩（平衡 OCR 精度与 token 消耗）──
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64Image = buffer.toString("base64")
    const mimeType = file.type || "image/jpeg"

    // ── 品牌文件 ──
    let brandContext = ""
    try {
      const brandFilesStr = formData.get("brandFiles") as string | null
      if (brandFilesStr) {
        const brandFiles: { name: string; type: string; content: string }[] = JSON.parse(brandFilesStr)
        const textFiles = brandFiles.filter(
          (f) => !f.type.startsWith("image/") && !f.content.startsWith("data:image")
        )
        if (textFiles.length > 0) {
          brandContext = "\n【品牌规范参考】\n" +
            textFiles.map((f) => `--- ${f.name} ---\n${f.content.slice(0, 1500)}`).join("\n\n")
        }
      }
    } catch { /* ignore */ }

    // ── 构建用户消息 ──
    const userTextParts: string[] = ["请审核这张包装设计图。"]

    if (hasPhysicalDims) {
      userTextParts.push(`物理尺寸：宽${physicalWidth}mm × 高${physicalHeight}mm。请估算关键文字高度，检查是否 ≥1.8mm（GB 7718 要求）。`)
    }

    userTextParts.push("返回 JSON。")

    const userText = userTextParts.join(" ")

    // ── 调用 Kimi K2.5 ──
    const kimiKey = process.env.KIMI_API_KEY
    if (!kimiKey) {
      return NextResponse.json({ error: "未配置 KIMI_API_KEY" }, { status: 500 })
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 55000)

    try {
      const kimiBaseUrl = process.env.KIMI_API_BASE_URL || "https://api.moonshot.cn/v1"
      const resp = await fetch(`${kimiBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${kimiKey}`,
        },
        body: JSON.stringify({
          model: "kimi-k2.5",
          messages: [
            { role: "system", content: SYSTEM_PROMPT + brandContext },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: `data:${mimeType};base64,${base64Image}` },
                },
                { type: "text", text: userText },
              ],
            },
          ],
          max_tokens: 6000,
          temperature: 1,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "")
        console.error("Kimi API error:", resp.status, errText.slice(0, 200))
        return NextResponse.json(
          { error: `Kimi API 返回错误 (${resp.status})，请稍后重试。` },
          { status: 502 }
        )
      }

      const data = await resp.json()
      const content = data.choices?.[0]?.message?.content

      if (!content) {
        console.error("Kimi empty response:", JSON.stringify(data).slice(0, 300))
        return NextResponse.json({ error: "Kimi 返回为空，请重试。" }, { status: 502 })
      }

      // ── 解析 JSON ──
      const cleaned = content
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/, "")
        .replace(/\s*```$/, "")
        .trim()

      let result: any
      try {
        result = JSON.parse(cleaned)
      } catch {
        // 尝试提取 JSON 片段
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0])
        } else {
          console.error("Kimi JSON parse failed:", cleaned.slice(0, 300))
          return NextResponse.json({ error: "Kimi 返回格式异常，请重试。" }, { status: 502 })
        }
      }

      // 附加文字高度检查
      if (hasPhysicalDims && result.checklist) {
        result.checklist["文字高度合规"] = true
      }

      // 记录 token 用量（便于监控成本）
      const usage = data.usage
      if (usage) {
        console.log(
          `[Kimi K2.5] tokens: ${usage.prompt_tokens} in / ${usage.completion_tokens} out / ${usage.total_tokens} total`
        )
      }

      return NextResponse.json(result)
    } catch (e: any) {
      clearTimeout(timeoutId)
      if (e.name === "AbortError") {
        return NextResponse.json({ error: "Kimi 请求超时，请重试。" }, { status: 504 })
      }
      throw e
    }
  } catch (error: any) {
    console.error("Kimi analyze error:", error.message)
    return NextResponse.json(
      { error: `服务器错误：${error.message || "未知"}` },
      { status: 500 }
    )
  }
}
