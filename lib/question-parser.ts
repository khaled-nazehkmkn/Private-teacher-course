import { normalizeArabicDigits } from './access-code'
import { cleanGeminiArtifacts, cleanGeminiOption } from '@/components/ui/math-renderer'

export interface ParsedQuestion {
  type: 'mcq' | 'essay'
  body: string
  options: string[]
  correct: number[]
  marks: number
  topic?: string
  grade?: string
  lesson?: string
  difficulty?: string
  image_path?: string
  model_answer?: string
}

function cleanJsonText(raw: string): string {
  let cleaned = raw.trim()
  // Strip markdown code fences if teacher copied from ChatGPT / Gemini directly
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/i, '')
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/i, '')
  }
  return cleaned.trim()
}

export function parseJsonQuestions(jsonContent: string): {
  questions: ParsedQuestion[]
  errors: string[]
} {
  const errors: string[] = []
  const parsedQuestions: ParsedQuestion[] = []

  try {
    const sanitized = cleanJsonText(jsonContent)
    const data = JSON.parse(sanitized)
    const rawList = Array.isArray(data)
      ? data
      : Array.isArray(data.questions)
      ? data.questions
      : Array.isArray(data.items)
      ? data.items
      : data.data

    if (!Array.isArray(rawList)) {
      errors.push('تنسيق ملف JSON غير صحيح. يجب أن يحتوي على مصفوفة questions أو مصفوفة أسئلة مباشرة.')
      return { questions: [], errors }
    }

    rawList.forEach((q, index) => {
      const qNum = index + 1
      const body = q.body || q.text || q.question || q.prompt || q.title
      if (!body || typeof body !== 'string' || !body.trim()) {
        errors.push(`السؤال رقم ${qNum}: نص السؤال غير موجود.`)
        return
      }

      // Detect question type
      let qType: 'mcq' | 'essay' | 'true_false' = 'mcq'
      const rawType = String(q.type || '').toLowerCase().trim()
      if (rawType === 'essay' || rawType === 'subjective' || rawType === 'problem' || rawType === 'written' || rawType === 'مقالي') {
        qType = 'essay'
      } else if (rawType === 'true_false' || rawType === 'tf' || rawType === 'boolean' || rawType === 'صح_وخطأ' || rawType === 'صواب_وخطأ') {
        qType = 'true_false'
      } else if (!q.options && !q.choices && (q.model_answer || q.solution || q.answer_text)) {
        // Automatically inferred as essay if no options and has model answer
        qType = 'essay'
      }

      const lesson = cleanGeminiArtifacts(
        String(q.lesson || q.lesson_name || q.lesson_number || q.lesson_num || '')
      ).trim()

      // Handle Essay Questions
      if (qType === 'essay') {
        const modelAns = q.model_answer || q.solution || q.answer || q.answer_text || ''
        parsedQuestions.push({
          type: 'essay',
          body: cleanGeminiArtifacts(body.trim()),
          options: [],
          correct: [],
          marks: Number(q.marks) || 2,
          topic: cleanGeminiArtifacts(q.topic || '').trim(),
          grade: cleanGeminiArtifacts(q.grade || '').trim(),
          lesson: lesson || undefined,
          difficulty: q.difficulty || 'medium',
          image_path: q.image || q.image_path || undefined,
          model_answer: modelAns ? cleanGeminiArtifacts(String(modelAns).trim()) : undefined,
        })
        return
      }

      // Handle True / False or Multiple Choice Questions
      let rawOptions = q.options || q.choices || q.answers

      if (qType === 'true_false' && (!Array.isArray(rawOptions) || rawOptions.length < 2)) {
        const isEnglish = /[a-zA-Z]{4,}/.test(body)
        rawOptions = isEnglish ? ['True', 'False'] : ['صواب', 'خطأ']
      }

      if (!Array.isArray(rawOptions) || rawOptions.length < 2) {
        errors.push(`السؤال رقم ${qNum}: يجب توفير خيارين على الأقل لأسئلة الاختيار من متعدد.`)
        return
      }

      const options = rawOptions.map((opt: unknown) => cleanGeminiOption(String(opt).trim()))

      let correctIndices: number[] = []
      const rawCorrect = q.correct ?? q.correct_answer ?? q.answer ?? q.answer_index

      if (rawCorrect !== undefined && rawCorrect !== null) {
        const list = Array.isArray(rawCorrect) ? rawCorrect : [rawCorrect]
        
        list.forEach((val) => {
          if (typeof val === 'boolean') {
            correctIndices.push(val ? 0 : 1)
          } else if (typeof val === 'number') {
            correctIndices.push(val)
          } else {
            const strVal = String(val).trim()
            const normalizedNum = Number(normalizeArabicDigits(strVal))

            if (!isNaN(normalizedNum)) {
              correctIndices.push(normalizedNum)
            } else {
              const lower = strVal.toLowerCase()
              // Handle boolean keywords
              if (lower === 'true' || lower === 't' || strVal === 'صواب' || strVal === 'صح' || strVal === 'ص') {
                correctIndices.push(0)
              } else if (lower === 'false' || lower === 'f' || strVal === 'خطأ' || strVal === 'غلط' || strVal === 'خ') {
                correctIndices.push(1)
              } else if (lower === 'a' || strVal === 'أ' || strVal === 'ا') {
                correctIndices.push(0)
              } else if (lower === 'b' || strVal === 'ب') {
                correctIndices.push(1)
              } else if (lower === 'c' || strVal === 'ج') {
                correctIndices.push(2)
              } else if (lower === 'd' || strVal === 'د') {
                correctIndices.push(3)
              } else {
                // Check if string matches an option text exactly
                const matchedIdx = options.findIndex((opt) => opt === strVal)
                if (matchedIdx !== -1) {
                  correctIndices.push(matchedIdx)
                }
              }
            }
          }
        })
      }

      // If correct indices are 1-based (e.g. 1, 2, 3, 4 where 4 === options.length or min >= 1 and max <= options.length without 0)
      if (correctIndices.length > 0) {
        const hasZero = correctIndices.some((idx) => idx === 0)
        const allInRange1Based = correctIndices.every((idx) => idx >= 1 && idx <= options.length)
        if (!hasZero && allInRange1Based) {
          correctIndices = correctIndices.map((idx) => idx - 1)
        }
      }

      // Fallback to option 0 if empty
      if (correctIndices.length === 0) {
        errors.push(`السؤال رقم ${qNum}: لم يتم التعرف على الإجابة الصحيحة.`)
        return
      }

      // Check if indices are valid
      const hasInvalidIndex = correctIndices.some(
        (idx) => isNaN(idx) || idx < 0 || idx >= options.length
      )
      if (hasInvalidIndex) {
        errors.push(`السؤال رقم ${qNum}: رقم الإجابة الصحيحة خارج حدود الخيارات.`)
        return
      }

      parsedQuestions.push({
        type: 'mcq',
        body: cleanGeminiArtifacts(body.trim()),
        options,
        correct: correctIndices,
        marks: Number(q.marks) || 1,
        topic: cleanGeminiArtifacts(q.topic || '').trim(),
        grade: cleanGeminiArtifacts(q.grade || '').trim(),
        lesson: lesson || undefined,
        difficulty: q.difficulty || 'medium',
        image_path: q.image || q.image_path || undefined,
      })
    })
  } catch (err) {
    errors.push('فشل قراءة كود JSON: تأكد من إغلاق الأقواس والفواصل بصورة صحيحة.')
  }

  return { questions: parsedQuestions, errors }
}

/**
 * Lazy loads the heavy xlsx module on-demand
 */
export async function parseExcelQuestions(fileBuffer: ArrayBuffer): Promise<{
  questions: ParsedQuestion[]
  errors: string[]
}> {
  const errors: string[] = []
  const parsedQuestions: ParsedQuestion[] = []

  try {
    // Dynamic import for performance rule
    const XLSX = await import('xlsx')
    const workbook = XLSX.read(fileBuffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      return { questions: [], errors: ['الملف لا يحتوي على أي أوراق عمل.'] }
    }

    const worksheet = workbook.Sheets[sheetName]
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet)

    if (!rows.length) {
      return { questions: [], errors: ['ورقة العمل فارغة.'] }
    }

    rows.forEach((row, idx) => {
      const qNum = idx + 1
      const body =
        row['نص السؤال'] ||
        row['السؤال'] ||
        row['question'] ||
        row['text'] ||
        row['body']

      if (!body) {
        return
      }

      const options: string[] = []
      const opt1 = row['الخيار الأول'] || row['خيار 1'] || row['option 1'] || row['opt1']
      const opt2 = row['الخيار الثاني'] || row['خيار 2'] || row['option 2'] || row['opt2']
      const opt3 = row['الخيار الثالث'] || row['خيار 3'] || row['option 3'] || row['opt3']
      const opt4 = row['الخيار الرابع'] || row['خيار 4'] || row['option 4'] || row['opt4']

      if (opt1) options.push(cleanGeminiOption(String(opt1).trim()))
      if (opt2) options.push(cleanGeminiOption(String(opt2).trim()))
      if (opt3) options.push(cleanGeminiOption(String(opt3).trim()))
      if (opt4) options.push(cleanGeminiOption(String(opt4).trim()))

      const marks = Number(row['الدرجة'] || row['marks'] || 1)
      const topic = cleanGeminiArtifacts(String(row['الموضوع'] || row['topic'] || '')).trim()
      const grade = cleanGeminiArtifacts(String(row['الصف'] || row['grade'] || '')).trim()
      const lesson = cleanGeminiArtifacts(
        String(
          row['الدرس'] ||
          row['رقم الدرس'] ||
          row['اسم الدرس'] ||
          row['lesson'] ||
          row['lesson_number'] ||
          ''
        )
      ).trim()
      const difficulty = String(row['الصعوبة'] || row['difficulty'] || 'medium').trim()
      const typeVal = String(row['نوع السؤال'] || row['النوع'] || row['type'] || '').toLowerCase().trim()
      const modelAnswer = row['الإجابة النموذجية'] || row['model_answer'] || row['إجابة نموذجية'] || row['حل']

      if (typeVal === 'essay' || typeVal === 'مقالي' || (options.length === 0 && modelAnswer)) {
        parsedQuestions.push({
          type: 'essay',
          body: cleanGeminiArtifacts(String(body).trim()),
          options: [],
          correct: [],
          marks: isNaN(marks) ? 2 : marks,
          topic,
          grade,
          lesson: lesson || undefined,
          difficulty,
          model_answer: modelAnswer ? cleanGeminiArtifacts(String(modelAnswer).trim()) : undefined,
        })
        return
      }

      if (options.length < 2) {
        errors.push(`السطر ${qNum}: يتطلب خيارين على الأقل.`)
        return
      }

      const rawCorrect =
        row['الإجابة الصحيحة'] ||
        row['الرقم الصحيح'] ||
        row['correct'] ||
        row['answer']

      let correctIdx = 0
      if (rawCorrect !== undefined) {
        const val = Number(normalizeArabicDigits(String(rawCorrect)))
        // Support 1-based (1,2,3,4) or 0-based (0,1,2,3)
        if (val >= 1 && val <= options.length) {
          correctIdx = val - 1
        } else if (val >= 0 && val < options.length) {
          correctIdx = val
        }
      }

      parsedQuestions.push({
        type: 'mcq',
        body: cleanGeminiArtifacts(String(body).trim()),
        options,
        correct: [correctIdx],
        marks: isNaN(marks) ? 1 : marks,
        topic,
        grade,
        lesson: lesson || undefined,
        difficulty,
      })
    })
  } catch (error) {
    console.error('[Excel Parser] Error parsing excel:', error)
    errors.push('حدث خطأ أثناء قراءة ملف Excel.')
  }

  return { questions: parsedQuestions, errors }
}
