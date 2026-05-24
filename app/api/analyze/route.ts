import { NextRequest, NextResponse } from "next/server"

export const maxDuration = 60

/* DeepSeek 合规分析 Prompt */
const COMPLIANCE_PROMPT = `你是食品包装标签合规审核专家，依据 GB 7718-2025、GB 28050-2025、GB 2760-2024、《广告法》、《食品标识监督管理办法》审核。

请逐项检查以下内容，只返回 JSON，不要其他文字：

{
  "productName": "产品名称",
  "category": "食品分类",
  "standard": "执行标准号",
  "standardStatus": "current/expired/error",
  "criticalErrors": [{ "severity": "error", "category": "类别", "message": "问题描述", "position": "位置描述", "regulation": "规范条款", "suggestion": "修改建议", "referenceDoc": "品牌规范文件名或null" }],
  "warnings": [{ "severity": "warning", "category": "类别", "message": "风险描述", "position": "位置描述", "regulation": "规范条款", "suggestion": "优化建议", "referenceDoc": "文件名或null" }],
  "typoIssues": [{ "severity": "error/warning", "wrong": "错字", "correct": "正字", "message": "说明", "position": "位置描述" }],
  "checklist": { "品名": true, "配料表": true, "净含量": true, "生产日期": true, "保质期": true, "致敏原标注": true, "营养成分表": true, "生产者信息": true, "执行标准号": true, "SC证号": true, "营销词合规": true, "卖点证据": true }
}

检查清单（逐一执行，不可遗漏）：
1. 强制标注项是否齐全（9项：品名、配料表、净含量/规格、生产日期、保质期、贮存条件、执行标准号、SC证号、生产者信息）
2. 营养成分表格式、单位(g/mg/kJ)、NRV%是否正确，数值修约间隔是否合规
3. 配料表是否按添加量递减排列
4. 执行标准号是否现行有效
5. 错别字（保质期→保盾期、脂肪→脂防、钠→纳、蛋白质→蛋白贡等）
6. 广告法禁用词（最、第一、顶级、极致、首选、唯一、国家级、全网第一、史上最、100%等）
7. 夸大宣传检测：识别卖点宣称（如"零添加"、"无农药残留"、"96项检测"、"100%天然"、"高钙"、"低脂"等），对照GB 28050营养声称和《广告法》判断是否合规
8. 证据链检测：如卖点宣称涉及具体数据或检测结果（如"96项农药无残留"、"经SGS检测"），在warnings中标注"该宣称需提供对应检测报告或认证证书，请核实"
9. 正面与背标一致性：产品名称、产品类型在正面和背面是否一致
10. 如提供品牌规范，逐一核对包装上的企业名称、地址、SC证号、电话是否一致

重要：只报告能在提供文字中找到确切证据的问题。如果你不确定某个问题是否存在，宁可不报告。不要猜测或编造不存在的问题。

每个 criticalErrors/warnings 必须包含 regulation（规范条款编号）和 suggestion（具体修改建议）字段。`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (!body?.textBlocks) {
      return NextResponse.json({ error: "缺少提取的文字内容" }, { status: 400 })
    }

    const textBlocks: { content: string; category: string }[] = body.textBlocks
    const physicalWidth = body.physicalWidth as string | null
    const physicalHeight = body.physicalHeight as string | null
    const hasPhysicalDims = !!(physicalWidth && physicalHeight)

    // 拼接已分类的文字
    const extractedText = textBlocks
      .map((b, i) => `[${b.category}] ${b.content}`)
      .join("\n")

    // 品牌文件
    let brandContext = ""
    try {
      const brandFiles = body.brandFiles as { name: string; type: string; content: string }[] | null
      if (brandFiles && brandFiles.length > 0) {
        const textFiles = brandFiles.filter(
          (f) => !f.type.startsWith("image/") && !f.content.startsWith("data:image")
        )
        if (textFiles.length > 0) {
          brandContext = "\n\n【品牌规范参考 - 请严格比对】\n" +
            textFiles.map((f) => `--- ${f.name} ---\n${f.content.slice(0, 2000)}`).join("\n\n")
        }
      }
    } catch { /* ignore */ }

    // 物理尺寸
    let dimsContext = ""
    if (hasPhysicalDims) {
      dimsContext = `\n\n【物理尺寸】宽${physicalWidth}mm × 高${physicalHeight}mm\n请估算关键文字的物理高度，检查是否 ≥1.8mm（GB 7718要求）。`
    }

    const userContent = `【包装文字内容（已分类）】\n\n${extractedText.slice(0, 6000)}${dimsContext}\n\n请逐项审核并返回 JSON。`

    const deepseekKey = process.env.DEEPSEEK_API_KEY
    if (!deepseekKey) {
      return NextResponse.json({ error: "未配置 DEEPSEEK_API_KEY" }, { status: 500 })
    }

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
          console.warn("DeepSeek analyze failed:", lastError)
        }
      } catch (e: any) {
        lastError = `${model}: ${e.message}`
        console.warn("DeepSeek analyze error:", lastError)
      }
    }

    if (!result) {
      return NextResponse.json(
        { error: `AI 分析失败。${lastError ? `（${lastError}）` : ""}请检查 API Key 是否有效。` },
        { status: 502 }
      )
    }

    if (hasPhysicalDims && result.checklist) {
      result.checklist["文字高度合规"] = true
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
