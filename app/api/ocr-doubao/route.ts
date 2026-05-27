export async function POST(req: Request) {
  try {
    const { image } = await req.json()

    if (!image) {
      return new Response(JSON.stringify({ error: '缺少图片数据' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const apiKey = process.env.DOUBAO_API_KEY
    if (!apiKey) {
      // 自诊断：列出所有已配环境变量供排查
      const envKeys = Object.keys(process.env).filter(k =>
        k.includes('DOUBAO') || k.includes('DEEPSEEK') || k.includes('KIMI') || k.includes('DASHSCOPE')
      )
      return new Response(JSON.stringify({
        error: 'Doubao API Key 未配置',
        diagnostic: {
          matched_env_keys: envKeys,
          total_env_count: Object.keys(process.env).length,
          hint: envKeys.length === 0
            ? 'Vercel 环境变量未注入，请检查 Settings → Environment Variables 是否保存并勾选了 Production 环境'
            : `找到了相关变量 [${envKeys.join(', ')}] 但缺少 DOUBAO_API_KEY，请检查拼写是否完全一致`,
        },
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const baseUrl = process.env.DOUBAO_API_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3'

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'doubao-1-5-vision-pro-32k-250115',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: image },
              },
              {
                type: 'text',
                text: `请识别并提取这张食品包装图片中的所有文字内容。要求：
1. 保持原文的排版结构和顺序
2. 不要遗漏任何文字，包括小字、标签、说明等
3. 直接输出文字内容，不要添加任何解释或说明
4. 保留营养成分表中的数字和单位`,
              },
            ],
          },
        ],
        max_tokens: 4096,
        temperature: 0.1,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Doubao API error:', response.status, errText)
      let errMsg = `Doubao API 返回错误 (${response.status})`
      try {
        const errJson = JSON.parse(errText)
        if (errJson.error?.message) errMsg += `: ${errJson.error.message}`
      } catch {}
      return new Response(
        JSON.stringify({ error: errMsg }),
        {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || ''

    if (!text.trim()) {
      return new Response(JSON.stringify({ error: 'Doubao-Vision-Pro-32K 未提取到文字' }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({ text, usage: data.usage }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (err: any) {
    console.error('Doubao Vision error:', err)
    return new Response(
      JSON.stringify({ error: `服务异常: ${err.message}` }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
