import { NextRequest, NextResponse } from "next/server"

export const maxDuration = 30

/* 纯分类 Prompt — 只贴标签，一个字都不准改 */
const CLASSIFY_PROMPT = `你是包装标签文字分类专家。你的唯一任务：给每段文字贴一个类别标签。

禁止修改任何文字内容。禁止删减。禁止优化。禁止合并。禁止拆分。如果改了一个字，你就是失职。

类别选项（只能从以下选）：
- 产品名称：正面或背面的产品名
- 产品类型：如"含乳饮料""烘烤类糕点"
- 配料表：配料及排序
- 营养成分表：营养成分数值表格
- 卖点宣称：包装上的营销卖点
- 生产信息：生产日期、保质期、贮存条件、生产商、地址、SC证号、电话、网址
- 执行标准：GB/GB-T/QB-T 等标准号
- 净含量：净含量/规格
- 致敏原：过敏原提示
- 条码：条码数字
- 其他：无法归类的文字

严格只返回 JSON，不要其他文字：
{"blocks":[{"content":"原文照抄，一字不改","category":"类别"}]}`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (!body?.text) {
      return NextResponse.json({ error: "缺少文字内容" }, { status: 400 })
    }

    const text = typeof body.text === "string" ? body.text.slice(0, 8000) : ""

    if (!text.trim()) {
      return NextResponse.json({ error: "文字内容为空" }, { status: 400 })
    }

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
              { role: "system", content: CLASSIFY_PROMPT },
              { role: "user", content: `请为以下包装文字分类：\n\n${text}` },
            ],
            response_format: { type: "json_object" },
            max_tokens: 4096,
            temperature: 0,
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
          console.warn("Classify DeepSeek failed:", lastError)
        }
      } catch (e: any) {
        lastError = `${model}: ${e.message}`
        console.warn("Classify DeepSeek error:", lastError)
      }
    }

    if (!result?.blocks) {
      return NextResponse.json(
        { error: `分类失败。${lastError ? `（${lastError}）` : ""}` },
        { status: 502 }
      )
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("Classify uncaught error:", error.message)
    return NextResponse.json(
      { error: `服务器错误：${error.message || "未知"}` },
      { status: 500 }
    )
  }
}
