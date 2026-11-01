import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { releaseExamSession } from '@/lib/rate-limit'

export async function POST(
  request: Request,
  props: { params: Promise<{ token: string }> }
) {
  const params = await props.params;
  try {
    const { token } = params
    const body = await request.json()
    const { submission_id, final_answers, paper_photos } = body

    if (!submission_id) {
      return NextResponse.json({ error: 'معرّف الجلسة مطلوب' }, { status: 400 })
    }

    const adminClient = getAdminClient()

    // 1. Fetch exam
    const { data: exam, error: examError } = await adminClient
      .from('exams')
      .select('id, results_released')
      .eq('public_token', token)
      .single()

    if (examError || !exam) {
      return NextResponse.json({ error: 'الاختبار غير صالح' }, { status: 404 })
    }

    // 2. Fetch submission
    const { data: submission, error: subError } = await adminClient
      .from('submissions')
      .select('id, submitted_at, student_id')
      .eq('id', submission_id)
      .eq('exam_id', exam.id)
      .single()

    if (subError || !submission) {
      return NextResponse.json({ error: 'جلسة الاختبار غير صحيحة' }, { status: 404 })
    }

    if (submission.submitted_at) {
      return NextResponse.json(
        { error: 'تم تسليم الاختبار بالفعل مسبقاً' },
        { status: 400 }
      )
    }

    // 3. Save any last submitted answers from body if provided
    if (final_answers && typeof final_answers === 'object') {
      const entries = Object.entries(final_answers)
      for (const [qId, ans] of entries) {
        await adminClient
          .from('answers')
          .upsert({
            submission_id,
            question_id: qId,
            answer: ans as any,
          })
      }
    }

    // 4. Server-Side Auto-Marking
    // Fetch all exam questions with correct answers
    const { data: examQuestions, error: eqError } = await adminClient
      .from('exam_questions')
      .select(`
        question_id,
        marks_override,
        question:questions (
          id,
          correct,
          marks,
          type
        )
      `)
      .eq('exam_id', exam.id)

    if (eqError || !examQuestions) {
      console.error('[Exam Submit] Error fetching exam questions:', eqError)
      return NextResponse.json({ error: 'تعذر تقييم الأسئلة' }, { status: 500 })
    }

    // Fetch saved answers
    const { data: studentAnswers } = await adminClient
      .from('answers')
      .select('question_id, answer')
      .eq('submission_id', submission_id)

    const studentAnswersMap = new Map<string, any>()
    studentAnswers?.forEach((a) => {
      studentAnswersMap.set(a.question_id, a.answer)
    })

    let totalScore = 0
    let totalMaxScore = 0

    for (const item of examQuestions) {
      const q = item.question as any
      if (!q) continue

      const qMaxMarks = Number(item.marks_override ?? q.marks ?? 1)
      totalMaxScore += qMaxMarks

      const isEssay = q.type === 'essay'
      const studentAns = studentAnswersMap.get(item.question_id)
      let isCorrect: boolean | null = false
      let awardedMarks = 0

      if (isEssay) {
        // Essay questions are marked manually by the teacher
        isCorrect = null
        awardedMarks = 0
      } else if (studentAns !== undefined && studentAns !== null) {
        // MCQ choice questions: auto-marked
        let correctArray: any[] = []
        if (Array.isArray(q.correct)) {
          correctArray = q.correct
        } else if (q.correct !== null && q.correct !== undefined) {
          correctArray = [q.correct]
        }

        if (Array.isArray(studentAns)) {
          isCorrect =
            studentAns.length === correctArray.length &&
            studentAns.every((val) => correctArray.includes(val))
        } else {
          isCorrect = correctArray.some((c) => String(c) === String(studentAns))
        }
        awardedMarks = isCorrect ? qMaxMarks : 0
      }

      totalScore += awardedMarks

      // Format answer payload (attach paper photos if this is an essay question and photos exist)
      let answerToSave = studentAns ?? null
      if (isEssay && Array.isArray(paper_photos) && paper_photos.length > 0) {
        if (typeof answerToSave === 'object' && answerToSave !== null) {
          answerToSave = { ...answerToSave, paper_photos }
        } else {
          answerToSave = { text: answerToSave || '', paper_photos }
        }
      }

      // Update answer record with result
      await adminClient
        .from('answers')
        .upsert({
          submission_id,
          question_id: item.question_id,
          answer: answerToSave,
          is_correct: isCorrect,
          marks_awarded: awardedMarks,
        })
    }

    // 5. Finalize submission
    const submittedAt = new Date().toISOString()
    const { data: subData } = await adminClient
      .from('submissions')
      .update({
        submitted_at: submittedAt,
        score: totalScore,
        max_score: totalMaxScore,
      })
      .eq('id', submission_id)
      .select('student_id')
      .single()

    if (subData?.student_id) {
      releaseExamSession(exam.id, subData.student_id)
    }

    const hasEssayQuestions = examQuestions.some((eq: any) => eq.question?.type === 'essay')

    return NextResponse.json({
      success: true,
      has_essay: hasEssayQuestions,
      results_released: exam.results_released,
      score: exam.results_released ? totalScore : null,
      max_score: exam.results_released ? totalMaxScore : null,
    })
  } catch (error) {
    console.error('[Exam Submit] Exception in POST /api/exam/[token]/submit:', error)
    return NextResponse.json(
      { error: 'حدث خطأ في تسليم الاختبار' },
      { status: 500 }
    )
  }
}
