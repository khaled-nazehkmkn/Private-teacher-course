/**
 * Generates an access code (4 to 6 digits) for student exam authorization
 */
export function generateAccessCode(length: number = 5): string {
  const digits = '0123456789'
  let result = ''
  // Ensure the first digit is not 0 for clarity
  result += digits.charAt(Math.floor(Math.random() * 9) + 1)
  for (let i = 1; i < length; i++) {
    result += digits.charAt(Math.floor(Math.random() * 10))
  }
  return result
}

/**
 * Normalizes Eastern Arabic-Indic digits (٠-٩) to Western Arabic digits (0-9)
 */
export function normalizeArabicDigits(input: string): string {
  const arabicIndicMap: Record<string, string> = {
    '٠': '0',
    '١': '1',
    '٢': '2',
    '٣': '3',
    '٤': '4',
    '٥': '5',
    '٦': '6',
    '٧': '7',
    '٨': '8',
    '٩': '9',
  }
  return input.replace(/[٠-٩]/g, (digit) => arabicIndicMap[digit] || digit).trim()
}
