/**
 * AI Auto-Grader Engine with Smart Batching & Rate-Limit Resilience
 * Optimized for Gemini Flash Free Tier (15 RPM / 1,500 RPD)
 */

export interface ExamQuestionToGrade {
  id: string
  body: string
  model_answer?: string | null
  marks: number
  type: string
  options?: string[]
  correct?: number[]
}

export interface StudentSubmissionToGrade {
  id: string
  student_id: string
  student_name: string
  answers: Record<string, any>
}

export interface QuestionEvaluation {
  question_id: string
  marks_awarded: number
  max_marks: number
  is_correct: boolean
  feedback: string
  teacher_note?: string
}

export interface SubmissionGradingResult {
  submission_id: string
  student_name: string
  score: number
  max_score: number
  evaluations: QuestionEvaluation[]
}

export interface ProblematicQuestion {
  question_id: string
  body_snippet: string
  average_marks: number
  max_marks: number
  success_rate: number
  common_mistakes: string
}

export interface TeacherExamReport {
  exam_title: string
  total_students: number
  average_score: number
  average_percentage: number
  highest_score: number
  lowest_score: number
  problematic_questions: ProblematicQuestion[]
  strengths: string[]
  recommendations_for_teacher: string[]
  generated_at: string
}

/**
 * Splits array into chunks of given size
 */
export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

/**
 * Sleep helper for pacing requests
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Calls Gemini API with exponential backoff on HTTP 429
 */
async function callGeminiWithRetry(
  apiKey: string,
  payload: any,
  maxRetries = 3
): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`

  let attempt = 0
  let delayMs = 2500

  while (attempt < maxRetries) {
    attempt++
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (response.status === 429) {
        console.warn(`[AIGrader] Gemini 429 Rate Limit hit. Backing off for ${delayMs}ms (attempt ${attempt}/${maxRetries})...`)
        await sleep(delayMs)
        delayMs *= 2
        continue
      }

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Gemini API error (Status ${response.status}): ${errorText}`)
      }

      const data = await response.json()
      return data
    } catch (err: any) {
      if (attempt >= maxRetries) throw err
      await sleep(delayMs)
      delayMs *= 2
    }
  }

  throw new Error('Exceeded maximum Gemini API retries.')
}

/**
 * Intelligent local rubric evaluation when running offline or without an API key
 */
function localFallbackEvaluation(
  question: ExamQuestionToGrade,
  studentAnswerText: string
): { marks_awarded: number; feedback: string; teacher_note: string } {
  const maxMarks = question.marks || 1
  const cleanAns = (studentAnswerText || '').trim()

  if (!cleanAns) {
    return {
      marks_awarded: 0,
      feedback: 'لم يتم تقديم إجابة على هذا السؤال.',
      teacher_note: 'الطالب ترك السؤال فارغاً.',
    }
  }

  const model = (question.model_answer || '').toLowerCase()
  const student = cleanAns.toLowerCase()

  // Keyword & math token overlap heuristic
  const keywords = model
    .replace(/[^\w\u0600-\u06FF\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 || /\d/.test(w))

  let matches = 0
  const uniqueKeywords = Array.from(new Set(keywords))
  uniqueKeywords.forEach((kw) => {
    if (student.includes(kw)) matches++
  })

  const ratio = uniqueKeywords.length > 0 ? matches / uniqueKeywords.length : 0.7
  // Scale awarded marks smoothly based on match ratio
  let factor = 0
  if (ratio >= 0.7) factor = 1.0
  else if (ratio >= 0.5) factor = 0.8
  else if (ratio >= 0.3) factor = 0.5
  else if (ratio > 0) factor = 0.3
  else factor = 0.1

  let awarded = Math.round(maxMarks * factor * 2) / 2
  awarded = Math.min(maxMarks, Math.max(0, awarded))

  return {
    marks_awarded: awarded,
    feedback:
      awarded === maxMarks
        ? 'إجابة ممتازة وخطوات واضحة ومطابقة للنموذج المطلوب.'
        : awarded > 0
        ? 'إجابة جيدة مع بعض الملاحظات البسيطة في دقة الخطوات الحسابية أو التعليل.'
        : 'إجابة غير مكتملة، يرجى مراجعة نموذج الحل والخطوات النموذجية.',
    teacher_note: `تقييم مبدئي استرشادي (نسبة التطابق مع الكلمات المفتاحية ${Math.round(ratio * 100)}%).`,
  }
}

/**
 * Grades all submissions for an exam using Smart Batching (10-12 students per request)
 */
export async function gradeExamSubmissionsBatch({
  examTitle,
  questions,
  submissions,
  apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
}: {
  examTitle: string
  questions: ExamQuestionToGrade[]
  submissions: StudentSubmissionToGrade[]
  apiKey?: string
}): Promise<SubmissionGradingResult[]> {
  const essayQuestions = questions.filter((q) => q.type === 'essay')
  const results: SubmissionGradingResult[] = []

  // If no submissions exist, return early
  if (submissions.length === 0) return []

  // Pre-index questions
  const qMap = new Map<string, ExamQuestionToGrade>()
  questions.forEach((q) => qMap.set(q.id, q))

  // Chunk submissions into batches of 10 students
  const batches = chunkArray(submissions, 10)

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const currentBatch = batches[batchIndex]

    // Separate empty answers from answers needing AI
    const batchEvaluationsMap = new Map<string, Map<string, QuestionEvaluation>>()

    // Prepare batch students payload for Gemini
    const studentsToEvaluateWithAI: Array<{
      submission_id: string
      student_name: string
      essay_answers: Array<{
        question_id: string
        question_body: string
        model_answer: string
        max_marks: number
        student_text: string
        has_paper_photos: boolean
      }>
    }> = []

    for (const sub of currentBatch) {
      const studentMap = new Map<string, QuestionEvaluation>()
      batchEvaluationsMap.set(sub.id, studentMap)

      const studentEssaysForAI: Array<{
        question_id: string
        question_body: string
        model_answer: string
        max_marks: number
        student_text: string
        has_paper_photos: boolean
      }> = []

      // 1. Grade MCQ questions natively (0 cost, 100% accuracy)
      for (const q of questions) {
        const studentAns = sub.answers?.[q.id]

        if (q.type !== 'essay') {
          let correctArray: any[] = []
          if (Array.isArray(q.correct)) correctArray = q.correct
          else if (q.correct !== null && q.correct !== undefined) correctArray = [q.correct]

          let isCorrect = false
          if (studentAns !== undefined && studentAns !== null) {
            const rawVal = typeof studentAns === 'object' && studentAns.selected_option !== undefined
              ? studentAns.selected_option
              : studentAns

            if (Array.isArray(rawVal)) {
              isCorrect = rawVal.length === correctArray.length && rawVal.every((v) => correctArray.includes(v))
            } else {
              isCorrect = correctArray.some((c) => String(c) === String(rawVal))
            }
          }

          const awardedMarks = isCorrect ? q.marks : 0
          studentMap.set(q.id, {
            question_id: q.id,
            marks_awarded: awardedMarks,
            max_marks: q.marks,
            is_correct: isCorrect,
            feedback: isCorrect ? 'إجابة صحيحة ✓' : 'إجابة غير صحيحة ✗',
          })
          continue
        }

        // 2. Essay Questions Handling
        const textAnswer = typeof studentAns === 'string'
          ? studentAns
          : studentAns?.text || ''
        const paperPhotos = Array.isArray(studentAns?.paper_photos) ? studentAns.paper_photos : []

        // If blank: award 0 automatically without wasting any tokens/requests
        if (!textAnswer.trim() && paperPhotos.length === 0) {
          studentMap.set(q.id, {
            question_id: q.id,
            marks_awarded: 0,
            max_marks: q.marks,
            is_correct: false,
            feedback: 'لم يتم تقديم إجابة على هذا السؤال.',
            teacher_note: 'السؤال متروك فارغاً.',
          })
          continue
        }

        // Needs evaluation
        studentEssaysForAI.push({
          question_id: q.id,
          question_body: q.body,
          model_answer: q.model_answer || 'قيم منطقية الخطوات والدقة الرياضية والناتج النهائي.',
          max_marks: q.marks,
          student_text: textAnswer,
          has_paper_photos: paperPhotos.length > 0,
        })
      }

      if (studentEssaysForAI.length > 0) {
        studentsToEvaluateWithAI.push({
          submission_id: sub.id,
          student_name: sub.student_name,
          essay_answers: studentEssaysForAI,
        })
      }
    }

    // Call Gemini for essay evaluations if any exist and API key is present
    if (studentsToEvaluateWithAI.length > 0) {
      if (apiKey) {
        try {
          const prompt = `
أنت مصحح امتحانات خبير ومساعد للمعلم في مصر للمرحلة الإعدادية والثانوية.
عنوان الاختبار: "${examTitle}"

المطلوب:
تصحيح إجابات الطلاب المقالية والمسائل بالخطوات بدقة وإنصاف تربوي، وفقاً لنموذج الإجابة ومعايير توزيع الدرجات المحددة لكل سؤال.
كن كريماً في منح الدرجات للخطوات الصحيحة والقوانين حتى لو حدث خطأ حسابي بسيط في الناتج النهائي.
اكتب ملاحظة واضحة ومحفزة للطالب (feedback) توضح أين أصاب وأين أخطأ، وملاحظة سريعة للمعلم (teacher_note).

بيانات الأسئلة وإجابات الطلاب للتقييم:
${JSON.stringify(studentsToEvaluateWithAI, null, 2)}

أخرج النتيجة بصيغة JSON فقط، بدون أي شروحات أو Markdown خارجه، وفق الهيكل البرمجي التالي:
{
  "evaluations": [
    {
      "submission_id": "معرف التسليم",
      "question_id": "معرف السؤال",
      "marks_awarded": 2.5,
      "feedback": "ملاحظة موجهة للطالب بلغة عربية لطيفة وواضحة",
      "teacher_note": "ملاحظة موجزة للمعلم عن أداء الطالب"
    }
  ]
}
`
          const geminiPayload = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              response_mime_type: 'application/json',
            },
          }

          const response = await callGeminiWithRetry(apiKey, geminiPayload)
          const rawText = response?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
          const parsed = JSON.parse(rawText)
          const evalsList = Array.isArray(parsed?.evaluations) ? parsed.evaluations : []

          evalsList.forEach((ev: any) => {
            const studentMap = batchEvaluationsMap.get(ev.submission_id)
            const q = qMap.get(ev.question_id)
            if (studentMap && q) {
              const maxM = q.marks || 1
              const awarded = Math.min(maxM, Math.max(0, Number(ev.marks_awarded) || 0))
              studentMap.set(ev.question_id, {
                question_id: ev.question_id,
                marks_awarded: awarded,
                max_marks: maxM,
                is_correct: awarded >= maxM * 0.5,
                feedback: ev.feedback || 'تم التقييم بواسطة الذكاء الاصطناعي.',
                teacher_note: ev.teacher_note,
              })
            }
          })
        } catch (apiErr) {
          console.error('[AIGrader] Gemini Batch Evaluation Error:', apiErr)
          // Fallback to local heuristic evaluation if API fails
          studentsToEvaluateWithAI.forEach((st) => {
            const studentMap = batchEvaluationsMap.get(st.submission_id)
            st.essay_answers.forEach((ea) => {
              const q = qMap.get(ea.question_id)
              if (studentMap && q) {
                const evalRes = localFallbackEvaluation(q, ea.student_text)
                studentMap.set(ea.question_id, {
                  question_id: ea.question_id,
                  marks_awarded: evalRes.marks_awarded,
                  max_marks: q.marks,
                  is_correct: evalRes.marks_awarded >= q.marks * 0.5,
                  feedback: evalRes.feedback,
                  teacher_note: evalRes.teacher_note,
                })
              }
            })
          })
        }
      } else {
        // No API Key: Run local heuristic evaluation
        studentsToEvaluateWithAI.forEach((st) => {
          const studentMap = batchEvaluationsMap.get(st.submission_id)
          st.essay_answers.forEach((ea) => {
            const q = qMap.get(ea.question_id)
            if (studentMap && q) {
              const evalRes = localFallbackEvaluation(q, ea.student_text)
              studentMap.set(ea.question_id, {
                question_id: ea.question_id,
                marks_awarded: evalRes.marks_awarded,
                max_marks: q.marks,
                is_correct: evalRes.marks_awarded >= q.marks * 0.5,
                feedback: evalRes.feedback,
                teacher_note: evalRes.teacher_note,
              })
            }
          })
        })
      }
    }

    // Assemble results for current batch
    for (const sub of currentBatch) {
      const studentMap = batchEvaluationsMap.get(sub.id)
      const evalsList = Array.from(studentMap?.values() || [])
      const totalScore = evalsList.reduce((sum, e) => sum + e.marks_awarded, 0)
      const totalMax = evalsList.reduce((sum, e) => sum + e.max_marks, 0)

      results.push({
        submission_id: sub.id,
        student_name: sub.student_name,
        score: totalScore,
        max_score: totalMax,
        evaluations: evalsList,
      })
    }

    // Pacing delay between batches to respect 15 RPM
    if (batchIndex < batches.length - 1 && apiKey) {
      await sleep(2000)
    }
  }

  return results
}

/**
 * Generates an executive pedagogical summary and feedback report for the teacher
 */
export async function generateTeacherExamReport({
  examTitle,
  questions,
  evaluatedSubmissions,
  apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
}: {
  examTitle: string
  questions: ExamQuestionToGrade[]
  evaluatedSubmissions: SubmissionGradingResult[]
  apiKey?: string
}): Promise<TeacherExamReport> {
  const totalStudents = evaluatedSubmissions.length
  if (totalStudents === 0) {
    return {
      exam_title: examTitle,
      total_students: 0,
      average_score: 0,
      average_percentage: 0,
      highest_score: 0,
      lowest_score: 0,
      problematic_questions: [],
      strengths: ['لا توجد تسليمات مسجلة حتى الآن.'],
      recommendations_for_teacher: ['شجع الطلاب على دخول الاختبار بكودهم الشخصي.'],
      generated_at: new Date().toISOString(),
    }
  }

  const scores = evaluatedSubmissions.map((s) => s.score)
  const maxScore = evaluatedSubmissions[0]?.max_score || 10
  const avgScore = Math.round((scores.reduce((a, b) => a + b, 0) / totalStudents) * 10) / 10
  const avgPerc = Math.round((avgScore / (maxScore || 1)) * 100)
  const highest = Math.max(...scores)
  const lowest = Math.min(...scores)

  // Calculate success rate per question
  const questionStats = questions.map((q) => {
    let totalMarksEarned = 0
    let countEvaluated = 0

    evaluatedSubmissions.forEach((sub) => {
      const ev = sub.evaluations.find((e) => e.question_id === q.id)
      if (ev) {
        totalMarksEarned += ev.marks_awarded
        countEvaluated++
      }
    })

    const avgQMarks = countEvaluated > 0 ? Math.round((totalMarksEarned / countEvaluated) * 10) / 10 : 0
    const successRate = q.marks > 0 ? Math.round((avgQMarks / q.marks) * 100) : 100

    return {
      question_id: q.id,
      body_snippet: q.body.length > 80 ? q.body.slice(0, 80) + '...' : q.body,
      average_marks: avgQMarks,
      max_marks: q.marks,
      success_rate: successRate,
      type: q.type,
    }
  })

  // Identify problematic questions (success rate < 65%)
  const weakQuestions = questionStats
    .filter((q) => q.success_rate < 65)
    .sort((a, b) => a.success_rate - b.success_rate)
    .slice(0, 4)

  const problematicList: ProblematicQuestion[] = weakQuestions.map((wq) => ({
    question_id: wq.question_id,
    body_snippet: wq.body_snippet,
    average_marks: wq.average_marks,
    max_marks: wq.max_marks,
    success_rate: wq.success_rate,
    common_mistakes:
      wq.type === 'essay'
        ? 'نسيان كتابة القانون الأساسي أو التسرع في الاختصارات الحسابية النهائية.'
        : 'الخلط بين الخيارات المتشابهة والإشارات الرياضية.',
  }))

  // Generate actionable recommendations
  const strengths: string[] = []
  const recommendations: string[] = []

  if (avgPerc >= 80) {
    strengths.push('المستوى العام للمجموعة ممتاز ويظهر استيعاباً قوياً للمفاهيم الأساسية.')
  } else if (avgPerc >= 65) {
    strengths.push('المستوى العام جيد مع وجود تفاوت بين أسئلة الاختيار والمسائل المقالية.')
  } else {
    strengths.push('تفاعل الطلاب في تسليم الاختبار جيد، لكن يحتاجون تعزيزاً في خطوات الحل.')
  }

  if (weakQuestions.length > 0) {
    recommendations.push(
      `تخصيص 15 دقيقة في بداية الحصة القادمة لمراجعة المسائل الأكثر صعوبة (نسبة النجاح فيها أقل من 65%).`
    )
    recommendations.push('تأكيد أهمية كتابة القوانين وتوضيح خطوات الحل بدلاً من القفز للناتج النهائي.')
  } else {
    recommendations.push('الانتقال للوحدة التالية مع إعطاء مسائل إثرائية للمتفوقين لتعزيز التفكير الإبداعي.')
  }

  // If API key is available, enhance report with Gemini synthesis
  if (apiKey && weakQuestions.length > 0) {
    try {
      const reportPrompt = `
أنت مستشار تعليمي وتربوي خبير.
لدينا نتائج اختبار بعنوان "${examTitle}":
- عدد الطلاب: ${totalStudents}
- متوسط الدرجات: ${avgScore} من ${maxScore} (${avgPerc}%)
- أعلى درجة: ${highest}، وأدنى درجة: ${lowest}
- الأسئلة التي تعثر فيها الطلاب:
${JSON.stringify(weakQuestions, null, 2)}

المطلوب:
اكتب 2 نقاط قوة للمجموعة، و 3 توصيات تربوية وتدريسية عملية ومحددة للمعلم للحصة القادمة لعلاج الأخطاء الشائعة.
أخرج النتيجة بصيغة JSON حصراً:
{
  "strengths": ["نقطة قوة 1", "نقطة قوة 2"],
  "recommendations": ["توصية 1", "توصية 2", "توصية 3"]
}
`
      const payload = {
        contents: [{ parts: [{ text: reportPrompt }] }],
        generationConfig: {
          temperature: 0.2,
          response_mime_type: 'application/json',
        },
      }
      const resp = await callGeminiWithRetry(apiKey, payload, 2)
      const rawReportText = resp?.candidates?.[0]?.content?.parts?.[0]?.text
      if (rawReportText) {
        const parsedReport = JSON.parse(rawReportText)
        if (Array.isArray(parsedReport.strengths) && parsedReport.strengths.length > 0) {
          strengths.splice(0, strengths.length, ...parsedReport.strengths)
        }
        if (Array.isArray(parsedReport.recommendations) && parsedReport.recommendations.length > 0) {
          recommendations.splice(0, recommendations.length, ...parsedReport.recommendations)
        }
      }
    } catch (e) {
      // Fallback kept
    }
  }

  return {
    exam_title: examTitle,
    total_students: totalStudents,
    average_score: avgScore,
    average_percentage: avgPerc,
    highest_score: highest,
    lowest_score: lowest,
    problematic_questions: problematicList,
    strengths,
    recommendations_for_teacher: recommendations,
    generated_at: new Date().toISOString(),
  }
}
