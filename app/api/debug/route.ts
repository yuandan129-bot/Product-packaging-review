import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const results: Record<string, any> = {}

  // 1. 检查 Key 是否存在
  const dsKey = process.env.DEEPSEEK_API_KEY
  const dashKey = process.env.DASHSCOPE_API_KEY
  const doubaoKey = process.env.DOUBAO_API_KEY
  const kimiKey = process.env.KIMI_API_KEY

  results.doubao_key = doubaoKey
    ? `已配置 (${doubaoKey.slice(0, 6)}...)`
    : "未配置 — 请在 Vercel 环境变量中添加 DOUBAO_API_KEY"

  results.deepseek_key = dsKey
    ? `已配置 (${dsKey.slice(0, 6)}...)`
    : "未配置 — 请在 Vercel 环境变量中添加 DEEPSEEK_API_KEY"

  results.kimi_key = kimiKey
    ? `已配置 (${kimiKey.slice(0, 6)}...)`
    : "未配置 — 请在 Vercel 环境变量中添加 KIMI_API_KEY"

  results.dashscope_key = dashKey
    ? `已配置 (${dashKey.slice(0, 6)}...)`
    : "未配置 — 请在 Vercel 环境变量中添加 DASHSCOPE_API_KEY"

  // 2. 测试豆包 Vision 连通性
  if (doubaoKey) {
    const doubaoBaseUrl = process.env.DOUBAO_API_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3'
    try {
      const resp = await fetch(`${doubaoBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${doubaoKey}`,
        },
        body: JSON.stringify({
          model: "doubao-1-5-vision-pro-32k-250115",
          messages: [{ role: "user", content: "回复 OK" }],
          max_tokens: 10,
        }),
        signal: AbortSignal.timeout(10000),
      })

      const body = await resp.text().catch(() => "")
      results.doubao_test = {
        status: resp.status,
        ok: resp.ok,
        body: body.slice(0, 300),
      }

      if (resp.status === 401) {
        results.doubao_diagnosis = "API Key 无效或已过期"
      } else if (resp.status === 404) {
        results.doubao_diagnosis = "模型 ID 不存在，请检查 model 名称"
      } else if (resp.status === 429) {
        results.doubao_diagnosis = "请求频率过高被限流"
      } else if (resp.ok) {
        results.doubao_diagnosis = "豆包 Vision API 正常"
      } else {
        results.doubao_diagnosis = `未知错误 HTTP ${resp.status}`
      }
    } catch (e: any) {
      results.doubao_test = { error: e.message }
      results.doubao_diagnosis = `连接失败: ${e.message}`
    }
  }

  // 3. 测试 DeepSeek 连通性
  if (dsKey) {
    try {
      const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${dsKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [{ role: "user", content: "回复 OK" }],
          max_tokens: 10,
        }),
        signal: AbortSignal.timeout(8000),
      })

      const body = await resp.text().catch(() => "")
      results.deepseek_test = {
        status: resp.status,
        ok: resp.ok,
        body: body.slice(0, 300),
      }

      if (resp.status === 401) {
        results.deepseek_diagnosis = "API Key 无效或已过期，请重新生成"
      } else if (resp.status === 429) {
        results.deepseek_diagnosis = "请求频率过高被限流，请稍后重试"
      } else if (resp.status === 402) {
        results.deepseek_diagnosis = "账户余额不足，请充值"
      } else if (resp.ok) {
        results.deepseek_diagnosis = "DeepSeek API 正常"
      } else {
        results.deepseek_diagnosis = `未知错误 HTTP ${resp.status}`
      }
    } catch (e: any) {
      results.deepseek_test = { error: e.message }
      if (e.message.includes("timeout") || e.message.includes("abort")) {
        results.deepseek_diagnosis = "连接超时 — 网络不通或 API 地址不可达"
      } else {
        results.deepseek_diagnosis = `连接失败: ${e.message}`
      }
    }
  }

  // 3. 测试 Qwen-VL 连通性
  if (dashKey) {
    try {
      const resp = await fetch(
        "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${dashKey}`,
          },
          body: JSON.stringify({
            model: "qwen-vl-max",
            messages: [{ role: "user", content: "回复 OK" }],
            max_tokens: 10,
          }),
          signal: AbortSignal.timeout(8000),
        }
      )

      const body = await resp.text().catch(() => "")
      results.qwen_test = {
        status: resp.status,
        ok: resp.ok,
        body: body.slice(0, 300),
      }

      if (resp.status === 401) {
        results.qwen_diagnosis = "API Key 无效"
      } else if (resp.ok) {
        results.qwen_diagnosis = "Qwen-VL API 正常"
      } else {
        results.qwen_diagnosis = `HTTP ${resp.status}`
      }
    } catch (e: any) {
      results.qwen_test = { error: e.message }
      results.qwen_diagnosis = `连接失败: ${e.message}`
    }
  }

  return NextResponse.json(results)
}
