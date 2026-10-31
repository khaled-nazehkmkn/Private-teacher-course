import { generateAccessCode, normalizeArabicDigits } from './access-code'

export interface ParsedStudent {
  full_name: string
  parent_phone: string
  grade: string
  access_code: string
}

export async function parseExcelStudents(
  fileBuffer: ArrayBuffer,
  defaultGrade?: string
): Promise<{
  students: ParsedStudent[]
  errors: string[]
}> {
  const errors: string[] = []
  const students: ParsedStudent[] = []

  try {
    const XLSX = await import('xlsx')
    const workbook = XLSX.read(fileBuffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      return { students: [], errors: ['الملف فارغ ولا يحتوي على أوراق عمل.'] }
    }

    const worksheet = workbook.Sheets[sheetName]
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet)

    if (!rows.length) {
      return { students: [], errors: ['ورقة العمل فارغة.'] }
    }

    rows.forEach((row, idx) => {
      const rowNum = idx + 2
      const fullName =
        row['اسم الطالب'] ||
        row['الاسم'] ||
        row['الاسم بالكامل'] ||
        row['name'] ||
        row['full_name']

      const parentPhone =
        row['هاتف ولي الأمر'] ||
        row['رقم ولي الأمر'] ||
        row['الموبايل'] ||
        row['phone'] ||
        row['parent_phone']

      const grade =
        row['الصف'] ||
        row['المرحلة'] ||
        row['grade'] ||
        defaultGrade ||
        ''

      if (!fullName) {
        errors.push(`السطر ${rowNum}: اسم الطالب مطلوب.`)
        return
      }

      if (!parentPhone) {
        errors.push(`السطر ${rowNum}: هاتف ولي الأمر مطلوب.`)
        return
      }

      const cleanPhone = normalizeArabicDigits(String(parentPhone)).replace(/\D/g, '')

      students.push({
        full_name: String(fullName).trim(),
        parent_phone: cleanPhone,
        grade: String(grade).trim(),
        access_code: generateAccessCode(5),
      })
    })
  } catch (error) {
    console.error('[Student Parser] Error parsing excel file:', error)
    errors.push('حدث خطأ أثناء معالجة ملف الإكسيل.')
  }

  return { students, errors }
}
