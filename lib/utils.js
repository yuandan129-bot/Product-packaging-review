import standardsIndex from './standards-index.json' assert { type: 'json' }
import advertisingLawIndex from './advertising-law-index.json' assert { type: 'json' }
import checklist from './checklist.json' assert { type: 'json' }

export const getStandardsIndex = () => standardsIndex
export const getAdvertisingLawIndex = () => advertisingLawIndex
export const getChecklist = () => checklist

export const checkProhibitedTerms = (text) => {
  const results = []
  const lawIndex = getAdvertisingLawIndex()

  Object.entries(lawIndex.prohibitedTerms).forEach(([category, data]) => {
    data.terms.forEach(term => {
      if (text.includes(term.word)) {
        results.push({
          category: data.category,
          severity: data.severity,
          word: term.word,
          example: term.example,
          replacement: term.replacement
        })
      }
    })
  })

  return results
}

export const validateNutritionLabel = (nutrients) => {
  const errors = []
  const standards = getStandardsIndex()
  const gb28050 = standards.GB28050

  gb28050.mandatoryNutrients.forEach(nutrient => {
    const value = nutrients[nutrient.name]
    if (!value) {
      errors.push({
        type: 'missing',
        nutrient: nutrient.name,
        message: `缺少${nutrient.name}标注`
      })
    } else if (value.unit !== nutrient.unit) {
      errors.push({
        type: 'unit_error',
        nutrient: nutrient.name,
        expected: nutrient.unit,
        actual: value.unit,
        message: `${nutrient.name}单位应为${nutrient.unit}，不能为${value.unit}`
      })
    }
  })

  return errors
}

export const calculateEnergy = (protein, fat, carbs) => {
  return Math.round(protein * 17 + fat * 37 + carbs * 17)
}

export const validateEnergy = (labeledEnergy, protein, fat, carbs) => {
  const calculated = calculateEnergy(protein, fat, carbs)
  const tolerance = calculated * 0.2
  const diff = Math.abs(labeledEnergy - calculated)

  return {
    calculated,
    labeled: labeledEnergy,
    diff,
    tolerance,
    isValid: diff <= tolerance,
    message: diff <= tolerance
      ? '能量值符合规范'
      : `能量值偏差${((diff/calculated)*100).toFixed(1)}%，超过20%的允许范围`
  }
}

export const getMandatoryElements = () => {
  const standards = getStandardsIndex()
  return standards.GB7718.mandatoryElements
}

export const getCommonAllergens = () => {
  const standards = getStandardsIndex()
  return standards.GB7718.allergenRequirements.commonAllergens
}

/*
 * 错别字检测 —— 将 OCR 提取的文字与错别字词库逐一比对
 * 返回匹配到的错误列表，包含错误词、正确词、分类和严重程度
 */
export const checkTypos = (ocrText) => {
  if (!ocrText || typeof ocrText !== 'string') return []

  // 动态导入 JSON 避免 assert 问题
  const typoDict = require('./typo-dictionary.json')
  const results = []

  typoDict.dictionary.forEach((entry) => {
    if (ocrText.includes(entry.wrong)) {
      results.push({
        type: 'typo',
        category: entry.category,
        severity: entry.severity,
        wrong: entry.wrong,
        correct: entry.correct,
        message: `识别到"${entry.wrong}"，应为"${entry.correct}"`,
      })
    }
  })

  return results
}

export const getTypoDictionary = () => {
  return require('./typo-dictionary.json')
}

