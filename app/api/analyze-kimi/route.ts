import { NextRequest, NextResponse } from "next/server"

export const maxDuration = 60

/* Kimi 合规分析 Prompt */
const SYSTEM_PROMPT = `你是食品包装标签合规审核专家，依据 GB 7718-2025、GB 28050-2025、GB 2760-2024、《广告法》、《食品标识监督管理办法》审核。

请根据提供的已提取文字逐项审核。严格只返回 JSON，不要其他文字：

{
  "productName": "产品名称",
  "category": "食品分类",
  "standard": "执行标准号",
  "standardStatus": "current/expired/error",
  "criticalErrors": [{"severity":"error","category":"类别","message":"问题描述","position":"文字中的具体位置","regulation":"违反的规范条款（如GB 28050-2025 第4.2条）","suggestion":"具体修改建议","referenceDoc":"品牌规范文件名或null"}],
  "warnings": [{"severity":"warning","category":"类别","message":"风险描述","position":"位置描述","regulation":"规范条款","suggestion":"优化建议","referenceDoc":"文件名或null"}],
  "typoIssues": [{"severity":"error/warning","wrong":"错字","correct":"正字","message":"说明","position":"位置描述"}],
  "checklist": {"品名":true,"配料表":true,"净含量":true,"生产日期":true,"保质期":true,"致敏原标注":true,"营养成分表":true,"生产者信息":true,"执行标准号":true,"SC证号":true,"营销词合规":true,"卖点证据":true}
}

═══════════════════════════════════════
输出顺序约束（格式塔分组 — 必须遵守）
═══════════════════════════════════════
criticalErrors 和 warnings 数组中的条目，必须按以下分组顺序排列，同类条目连续。用 category 字段标识所属分组：

第1组·品牌标识：品名、商标、logo 相关
第2组·产品基础信息：产品名称、产品类型/分类、规格/净含量、配料表
第3组·生产方信息：生产商/供应商名称、地址、电话、邮编
第4组·委托方信息（如有）：委托商名称、地址、电话、邮编
第5组·执行标准与许可：产品标准号、SC 许可证号、食品生产许可证编号、生产日期、保质期
第6组·营养成分表：营养成分格式、单位(g/mg/kJ)、NRV%、修约间隔、能量换算
第7组·其他强制项：贮存条件、致敏原、食用方法、辐照/转基因标注
第8组·广告合规：禁用词、夸大宣传、营养声称、证据链
第9组·错别字与格式：错别字、符号错误、排版问题

同一分组内按 severity 排列（error 在前 warning 在后）。
═══════════════════════════════════════

逐项检查（不可遗漏）：
1. 强制标注项是否齐全（9项：品名、配料表、净含量/规格、生产日期、保质期、贮存条件、执行标准号、SC证号、生产者信息）
2. 营养成分表格式、单位(g/mg/kJ)、NRV%是否正确，数值修约间隔是否合规（能量整数、蛋白质/脂肪/碳水保留一位小数、钠整数）
3. 能量值按公式粗略验算：蛋白质g×17 + 脂肪g×37 + 碳水化合物g×17，允许±20%误差
4. 配料表是否按添加量递减排列
5. 执行标准号是否现行有效
6. 错别字检测（保质期→保盾期、脂肪→脂防、钠→纳、蛋白质→蛋白贡、碳水化合物→炭水化合物等）
7. 广告法禁用词：最、第一、顶级、极致、首选、唯一、国家级、全网第一、史上最、100%等
8. 夸大宣传检测：识别卖点宣称（如"零添加"、"无农药残留"、"96项检测"、"100%天然"、"高钙"、"低脂"等），对照GB 28050营养声称和《广告法》判断是否合规
9. 证据链检测：如卖点宣称涉及具体数据或检测结果（如"96项农药无残留"、"经SGS检测"、"通过XX认证"），在warnings中标注"该宣称需提供对应检测报告或认证证书，请核实"
10. 正面与背标一致性：产品名称、产品类型在正面和背面是否一致
11. 如提供品牌规范，逐一核对包装上的企业名称、地址、SC证号、电话是否一致

═══════════════════════════════════════
英文字段检测
═══════════════════════════════════════
如包装文字中包含英文内容：
- 检查英文拼写是否正确
- 判断中英文是否准确对应（翻译准确性）
- 如英文宣传语声称某功效（如"low fat"、"organic"、"natural"），对照GB 28050营养声称判断是否合规
- 英文相关问题以 category="英文翻译" 记录，归入第9组
═══════════════════════════════════════

═══════════════════════════════════════
计量称重/散装称重特殊规则
═══════════════════════════════════════
如果包装文字中出现"计量称重"、"散装称重"、"称重销售"、"计量方式：称重"等关键词：
- 不要将"缺少净含量数值"列为错误
- 在 warnings 中添加一条：category="净含量"，message="该产品为计量称重销售，依据 GB 7718 无需标注具体净含量数值"，severity="warning"
- checklist 中"净含量"记为 true（不扣分）
═══════════════════════════════════════

═══════════════════════════════════════
物理尺寸校验（仅当提供宽高时执行）
═══════════════════════════════════════
如果上下文提供了物理尺寸，请估算包装上关键文字（品名、净含量、SC证号等9项强制标注内容）的物理高度，判断是否 ≥1.8mm（GB 7718 强制要求）。将不符合的以 category="文字高度" 记录为 error。
═══════════════════════════════════════

重要约束：只报告能在提供文字中找到确切证据的问题。不确定的问题宁可不报。不要猜测或编造不存在的问题。

每个 criticalErrors/warnings 必须包含：
- regulation：违反的具体规范条款编号 + 条款原文，用中文冒号连接，格式为"GB 28050-2025 第4.2条：能量和营养成分的名称和表达，能量以千焦（kJ）或千卡（kcal）标示……"（必须包含条款关键原文，控制在150字以内）
- suggestion：具体的修改建议（如"将糖 5.2mg 改为 糖 5.2g"）
- position：问题在文字中的具体位置
- referenceDoc：如品牌规范中有对应正确信息，标注文件名，否则填 null`

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
      .map((b) => `[${b.category}] ${b.content}`)
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
          brandContext = "\n【品牌规范参考】\n" +
            textFiles.map((f) => `--- ${f.name} ---\n${f.content.slice(0, 1500)}`).join("\n\n")
        }
      }
    } catch { /* ignore */ }

    // 构建用户消息
    const userTextParts: string[] = [
      `【包装文字内容（已分类）】\n\n${extractedText.slice(0, 6000)}`,
    ]

    if (hasPhysicalDims) {
      userTextParts.push(`物理尺寸：宽${physicalWidth}mm × 高${physicalHeight}mm。请估算关键文字高度，检查是否 ≥1.8mm（GB 7718 要求）。`)
    }

    userTextParts.push("请逐项审核，返回 JSON。")

    const userText = userTextParts.join("\n\n")

    // 调用 Kimi
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
          model: "moonshot-v1-32k-vision-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT + brandContext },
            { role: "user", content: userText },
          ],
          max_tokens: 4096,
          temperature: 0.1,
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

      // 解析 JSON
      const cleaned = content
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/, "")
        .replace(/\s*```$/, "")
        .trim()

      let result: any
      try {
        result = JSON.parse(cleaned)
      } catch {
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0])
        } else {
          console.error("Kimi JSON parse failed:", cleaned.slice(0, 300))
          return NextResponse.json({ error: "Kimi 返回格式异常，请重试。" }, { status: 502 })
        }
      }

      if (hasPhysicalDims && result.checklist) {
        result.checklist["文字高度合规"] = true
      }

      const usage = data.usage
      if (usage) {
        console.log(
          `[Kimi] tokens: ${usage.prompt_tokens} in / ${usage.completion_tokens} out / ${usage.total_tokens} total`
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
