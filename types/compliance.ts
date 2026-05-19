export interface ComplianceIssue {
  severity: 'error' | 'warning'
  category: string
  message: string
  position?: string
  bbox?: [number, number, number, number]
  referenceDoc?: string
}

export interface TypoIssue {
  severity: 'error' | 'warning'
  category: string
  wrong: string
  correct: string
  message: string
  position?: string
  bbox?: [number, number, number, number]
}

export interface ComplianceReport {
  productName: string
  category: string
  standard: string
  standardStatus: 'current' | 'expired' | 'error'
  criticalErrors: ComplianceIssue[]
  warnings: ComplianceIssue[]
  typoIssues: TypoIssue[]
  checklist: { [key: string]: boolean }
}
