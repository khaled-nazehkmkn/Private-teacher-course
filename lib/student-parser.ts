import { generateAccessCode, normalizeArabicDigits } from './access-code'

export interface ParsedStudent {
  full_name: string
  phone?: string | null
  parent_phone: string
  grade: string
  group_id: string | null
  group_name?: string
  access_code: string
}

export interface GroupOption {
  id: string
  name: string
  grade: string
}

/**
 * Normalizes Egyptian mobile phone numbers.
 * Handles cases where Excel strips leading zeroes (e.g. 1012345678 -> 01012345678)
 * and formats with country codes (+2010... -> 010...)
 */
function cleanPhoneNumber(raw: unknown): string {
  if (!raw) return ''
  let cleaned = normalizeArabicDigits(String(raw)).replace(/\D/g, '')

  // Remove leading 20 if entered as +2010... or 2010...
  if (cleaned.startsWith('20') && cleaned.length === 12) {
    cleaned = cleaned.slice(2)
  }

  // Prepend 0 if Excel stripped leading zero (10 digits starting with 10, 11, 12, 15)
  if (
    cleaned.length === 10 &&
    (cleaned.startsWith('10') ||
      cleaned.startsWith('11') ||
      cleaned.startsWith('12') ||
      cleaned.startsWith('15'))
  ) {
    cleaned = '0' + cleaned
  }

  return cleaned
}

export async function parseExcelStudents(
  fileBuffer: ArrayBuffer,
  defaultGrade?: string,
  existingGroups?: GroupOption[],
  defaultGroupId?: string
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
        row['اسم الطالب رباعي'] ||
        row['name'] ||
        row['full_name'] ||
        row['student_name']

      const studentPhone =
        row['رقم هاتف الطالب'] ||
        row['رقم الطالب'] ||
        row['هاتف الطالب'] ||
        row['موبايل الطالب'] ||
        row['تليفون الطالب'] ||
        row['student_phone'] ||
        row['student_mobile'] ||
        row['phone']

      const parentPhone =
        row['رقم هاتف ولي الأمر'] ||
        row['هاتف ولي الأمر'] ||
        row['رقم ولي الأمر'] ||
        row['موبايل ولي الأمر'] ||
        row['تليفون ولي الأمر'] ||
        row['parent_phone'] ||
        row['parent_mobile']

      const rawGroupName =
        row['المجموعة'] ||
        row['اسم المجموعة'] ||
        row['الجروب'] ||
        row['اسم الجروب'] ||
        row['group'] ||
        row['group_name']

      const rawGrade =
        row['الصف'] ||
        row['المرحلة'] ||
        row['المرحلة الدراسية'] ||
        row['الصف الدراسي'] ||
        row['grade']

      if (!fullName) {
        errors.push(`السطر ${rowNum}: اسم الطالب مطلوب.`)
        return
      }

      const cleanParentPhone = cleanPhoneNumber(parentPhone)
      if (!cleanParentPhone) {
        errors.push(`السطر ${rowNum}: هاتف ولي الأمر مطلوب.`)
        return
      }

      const cleanStudentPhone = studentPhone ? cleanPhoneNumber(studentPhone) : null

      // Match group name against existing groups
      let matchedGroupId: string | null = defaultGroupId || null
      let matchedGroupName: string | undefined = undefined

      if (rawGroupName && typeof rawGroupName === 'string' && rawGroupName.trim()) {
        const cleanedGroupName = rawGroupName.trim()
        const matched = existingGroups?.find(
          (g) => g.name.trim().toLowerCase() === cleanedGroupName.toLowerCase()
        )
        if (matched) {
          matchedGroupId = matched.id
          matchedGroupName = matched.name
        } else {
          matchedGroupName = cleanedGroupName
        }
      } else if (defaultGroupId && existingGroups) {
        const defaultGrp = existingGroups.find((g) => g.id === defaultGroupId)
        if (defaultGrp) {
          matchedGroupName = defaultGrp.name
        }
      }

      const finalGrade =
        (rawGrade ? String(rawGrade).trim() : '') ||
        (matchedGroupId && existingGroups
          ? existingGroups.find((g) => g.id === matchedGroupId)?.grade
          : '') ||
        defaultGrade ||
        'الصف الأول الثانوي'

      students.push({
        full_name: String(fullName).trim(),
        phone: cleanStudentPhone || null,
        parent_phone: cleanParentPhone,
        group_id: matchedGroupId,
        group_name: matchedGroupName,
        grade: finalGrade,
        access_code: generateAccessCode(5),
      })
    })
  } catch (error) {
    console.error('[Student Parser] Error parsing excel file:', error)
    errors.push('حدث خطأ أثناء معالجة ملف الإكسيل.')
  }

  return { students, errors }
}
