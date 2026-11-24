export type ExamLanguage = 'ar' | 'en'

const ARABIC_INDIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']

/**
 * Converts Western digits (0-9) into Eastern Arabic-Indic digits (٠-٩) for Arabic exam numbering (e.g. س١، س٢).
 */
export function toArabicIndicDigits(value: number | string): string {
  return String(value).replace(/\d/g, (d) => ARABIC_INDIC_DIGITS[Number(d)] ?? d)
}

/**
 * Normalizes an arbitrary exam language value to 'ar' | 'en'.
 */
export function normalizeExamLanguage(lang?: string | null): ExamLanguage {
  return lang === 'en' ? 'en' : 'ar'
}

/**
 * Formats question number badge:
 * - 'ar': 'س١', 'س٢', ...
 * - 'en': 'Q1', 'Q2', ...
 */
export function formatQuestionLabel(index: number, language: ExamLanguage): string {
  const num = index + 1
  return language === 'en' ? `Q${num}` : `س${toArabicIndicDigits(num)}`
}

/**
 * Option labels according to exam language:
 * - 'ar': ['أ', 'ب', 'ج', 'د', 'هـ', 'و']
 * - 'en': ['A', 'B', 'C', 'D', 'E', 'F']
 */
export function getOptionLetters(language: ExamLanguage): string[] {
  return language === 'en'
    ? ['A', 'B', 'C', 'D', 'E', 'F']
    : ['أ', 'ب', 'ج', 'د', 'هـ', 'و']
}

/**
 * Formats marks text for a question card / print sheet.
 */
export function formatMarksBadge(marks: number, language: ExamLanguage): string {
  if (language === 'en') {
    return `(${marks} ${marks === 1 ? 'mark' : 'marks'})`
  }
  return `(${toArabicIndicDigits(marks)} ${marks === 1 ? 'درجة' : 'درجات'})`
}
