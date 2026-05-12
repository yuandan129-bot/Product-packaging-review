import { NextRequest, NextResponse } from "next/server"

interface ComplianceIssue {
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

interface AnalysisResult {
  productName: string
  category: string
  standard: string
  standardStatus: "current" | "expired" | "error"
  criticalErrors: ComplianceIssue[]
  warnings: ComplianceIssue[]
  typoIssues: TypoIssue[]
  checklist: { [key: string]: boolean }
}

const SYSTEM_PROMPT = `你是一个中国食品包装标签合规审核专家。你需要严格依据以下国家标准审核包装图片：

- GB 7718-2025《预包装食品标签通则》
- GB 28050-2025《预包装食品营养标签通则》
- GB 2760-2024《食品添加剂使用标准》
- 《中华人民共和国广告法》食品相关条款

请仔细识别图片中的所有文字信息，并按以下 JSON 格式返回审核结果：

{
  "productName": "产品名称（从标签中提取）",
  "category": "食品分类",
  "standard": "标签声明的执行标准号",
  "standardStatus": "current 或 expired 或 error",
  "criticalErrors": [
    { "severity": "error", "category": "错误类别", "message": "具体问题描述及违反的国标条款" }
  ],
  "warnings": [
    { "severity": "warning", "category": "提醒类别", "message": "潜在风险描述" }
  ],
  "typoIssues": [
    { "severity": "error或warning", "category": "错字类别", "wrong": "识别到的错误文字", "correct": "正确的文字", "message": "说明" }
  ],
  "checklist": {
    "品名": true,
    "配料表": true,
    "生产日期": true,
    "保质期": true,
    "致敏原标注": true,
    "营养成分表": true,
    "生产者信息": true,
    "错别字检测": true,
    "净含量": true
  }
}

审核要点：
1. 强制标注项是否齐全（品名、配料表、净含量、生产日期、保质期、生产者、致敏原）
2. 营养成分表的格式、单位、NRV% 是否正确
3. 是否有广告法禁用词（如"最好""第一""最""极致""顶级"等）
4. 是否存在错别字（如"保盾期"应为"保质期"、"脂防"应为"脂肪"）
5. 配料表是否按添加量递减排列
6. 执行标准号是否现行有效

只需返回 JSON，不要包含任何其他文字。`

export async function POST(request: NextRequest) {
  try {
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json(
        { error: "未上传文件" },
        { status: 400 }
      )
    }

    const file = formData.get("file") as File
    if (!file) {
      return NextResponse.json(
        { error: "未上传文件" },
        { status: 400 }
      )
    }

    // 文件大小限制 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "文件大小超过 10MB 限制，请使用更小的图片" },
        { status: 400 }
      )
    }

    // 图片转 base64
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString("base64")
    const mimeType = file.type || "image/jpeg"
    const dataUrl = `data:${mimeType};base64,${base64}`

    // 调用 DeepSeek Vision API
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "服务配置错误：未设置 API Key" },
        { status: 500 }
      )
    }

    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: dataUrl },
              },
              {
                type: "text",
                text: "请审核这张食品包装标签图片。",
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 4096,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(120000),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => "")
      console.error("DeepSeek API error:", response.status, errText)
      return NextResponse.json(
        { error: `AI 服务返回错误 (${response.status})，请稍后重试` },
        { status: 502 }
      )
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      console.error("DeepSeek returned empty content:", JSON.stringify(data).slice(0, 500))
      return NextResponse.json(
        { error: "AI 未返回有效审核结果，请重试" },
        { status: 502 }
      )
    }

    // 解析 AI 返回的 JSON
    let result: AnalysisResult
    try {
      // 清理可能的 markdown 代码块包裹
      const jsonStr = content
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/, "")
        .replace(/\s*```$/, "")
        .trim()
      result = JSON.parse(jsonStr) as AnalysisResult
    } catch {
      console.error("Failed to parse AI response:", content.slice(0, 500))
      return NextResponse.json(
        { error: "AI 返回格式异常，请重试" },
        { status: 502 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Analyze error:", error)
    return NextResponse.json(
      { error: "分析失败，请重试" },
      { status: 500 }
    )
  }
}
