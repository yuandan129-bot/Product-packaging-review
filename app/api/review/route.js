import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file) {
      return NextResponse.json(
        { error: '未上传文件' },
        { status: 400 }
      )
    }

    const mockReview = {
      productName: '苹果汁饮料',
      standard: 'GB/T 29602',
      criticalErrors: [
        '营养成分表中"糖"的单位标注为 mg，法定单位应为 g',
        '配料中发现"全脂奶粉"，未按 GB 7718 要求标注致敏原提醒',
        '生产商地址与品牌知识库不一致'
      ],
      warnings: [
        '识别到"保盾期"，应为"保质期"',
        '净含量字符高度需确认是否 ≥ 4mm',
        '宣传语中出现"全网第一"，存在违规风险'
      ],
      checklist: {
        '品名': true,
        '配料表': true,
        '生产日期': false,
        '保质期': true,
        '营养成分表': true,
        '生产者信息': true,
        '执行标准': true,
        '生产许可证': true,
        '致敏原标注': false
      },
      summary: {
        total: 9,
        passed: 7,
        failed: 2
      }
    }

    return NextResponse.json(mockReview)
  } catch (error) {
    console.error('Review error:', error)
    return NextResponse.json(
      { error: '审核失败' },
      { status: 500 }
    )
  }
}
