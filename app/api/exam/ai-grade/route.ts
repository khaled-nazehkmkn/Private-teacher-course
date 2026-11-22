import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { evaluateTeacherStatus } from '@/lib/teacher-status'
import {
  gradeExamSubmissionsBatch,
  generateTeacherExamReport,
  type ExamQuestionToGrade,
  type StudentSubmissionToGrade,
} from '@/lib/ai-grader'

export async function POST(request: Request) {
  try {
    const supabaseUser = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'غير مصرح لك بإجراء التصحيح الذكي' }, { status: 401 })
    }

    const adminClient = getAdminClient()

    // 1. Verify teacher active status
    const { data: teacherProfile } = await adminClient
      .from('teachers')
      .select('*')
      .eq('id', user.id)
      .single()

    const teacherStatus = evaluateTeacherStatus(teacherProfile)
    if (teacherStatus.isSuspended || teacherStatus.isExpired) {
      return NextResponse.json(
        { error: 'حسابك في وضع القراءة فقط ولا يمكن إجراء التصحيح الآلي حالياً' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { exam_id } = body

    if (!exam_id) {
      return NextResponse.json({ error: 'معرّف الاختبار مطلوب' }, { status: 400 })
    }

    // 2. Fetch exam and verify ownership
    const { data: exam, error: examErr } = await adminClient
      .from('exams')
      .select('id, title, grade, teacher_id')
      .eq('id', exam_id)
      .eq('teacher_id', user.id)
      .single()

    if (examErr || !exam) {
      return NextResponse.json({ error: 'الاختبار غير موجود أو غير تابع لك' }, { status: 404 })
    }

    // 3. Fetch exam questions
    const { data: examQuestions, error: eqErr } = await adminClient
      .from('exam_questions')
      .select(`
        question_id,
        marks_override,
        position,
        question:questions (
          id,
          body,
          options,
          correct,
          marks,
          type,
          model_answer
        )
      `)
      .eq('exam_id', exam_id)
      .order('position', { ascending: true })

    if (eqErr || !examQuestions || examQuestions.length === 0) {
      return NextResponse.json({ error: 'لم يتم العثور على أسئلة لهذا الاختبار' }, { status: 400 })
    }

    const questionsToGrade: ExamQuestionToGrade[] = examQuestions
      .filter((eq) => Boolean(eq.question))
      .map((eq: any) => {
        const q = eq.question
        return {
          id: eq.question_id,
          body: q.body || '',
          model_answer: q.model_answer || null,
          marks: Number(eq.marks_override ?? q.marks ?? 1),
          type: q.type || 'mcq',
          options: Array.isArray(q.options) ? q.options : [],
          correct: Array.isArray(q.correct) ? q.correct : [],
        }
      })

    // 4. Fetch submissions for this exam
    const { data: submissions, error: subErr } = await adminClient
      .from('submissions')
      .select(`
        id,
        exam_id,
        student_id,
        score,
        max_score,
        submitted_at,
        student:students (id, full_name)
      `)
      .eq('exam_id', exam_id)
      .eq('teacher_id', user.id)

    if (subErr) {
      console.error('[AI Grade] Submissions fetch error:', subErr)
      return NextResponse.json({ error: 'فشل جلب بيانات التسليمات' }, { status: 500 })
    }

    if (!submissions || submissions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'لا توجد تسليمات مسجلة لهذا الاختبار بعد.',
        graded_count: 0,
        results: [],
        report: null,
      })
    }

    const subIds = submissions.map((s) => s.id)

    // 5. Fetch all answers for these submissions
    const { data: answersData, error: ansErr } = await adminClient
      .from('answers')
      .select('submission_id, question_id, answer, marks_awarded, is_correct')
      .in('submission_id', subIds)

    if (ansErr) {
      console.error('[AI Grade] Answers fetch error:', ansErr)
      return NextResponse.json({ error: 'فشل جلب إجابات الطلاب' }, { status: 500 })
    }

    // Map answers by submission_id -> question_id -> answer
    const answersBySub = new Map<string, Record<string, any>>()
    const existingRawAnswers = new Map<string, any>() // key: `${subId}:${qId}`

    answersData?.forEach((a) => {
      if (!answersBySub.has(a.submission_id)) {
        answersBySub.set(a.submission_id, {})
      }
      answersBySub.get(a.submission_id)![a.question_id] = a.answer
      existingRawAnswers.set(`${a.submission_id}:${a.question_id}`, a.answer)
    })

    const submissionsToGrade: StudentSubmissionToGrade[] = submissions.map((s: any) => ({
      id: s.id,
      student_id: s.student_id,
      student_name: s.student?.full_name || 'طالب',
      answers: answersBySub.get(s.id) || {},
    }))

    // 6. Execute smart batch grading
    const gradedResults = await gradeExamSubmissionsBatch({
      examTitle: exam.title,
      questions: questionsToGrade,
      submissions: submissionsToGrade,
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
    })

    // 7. Persist evaluation results into Supabase
    const answersToUpsert: any[] = []

    for (const res of gradedResults) {
      for (const ev of res.evaluations) {
        const rawExisting = existingRawAnswers.get(`${res.submission_id}:${ev.question_id}`)
        let updatedAnswerObj: any = {}

        if (typeof rawExisting === 'object' && rawExisting !== null) {
          updatedAnswerObj = { ...rawExisting }
        } else if (rawExisting !== undefined) {
          updatedAnswerObj = { text: rawExisting }
        }

        updatedAnswerObj.teacher_feedback = ev.feedback
        if (ev.teacher_note) {
          updatedAnswerObj.teacher_note = ev.teacher_note
        }
        updatedAnswerObj.ai_evaluated = true
        updatedAnswerObj.ai_evaluated_at = new Date().toISOString()

        answersToUpsert.push({
          submission_id: res.submission_id,
          question_id: ev.question_id,
          answer: updatedAnswerObj,
          marks_awarded: ev.marks_awarded,
          is_correct: ev.is_correct,
        })
      }

      // Update total submission score & max_score
      await adminClient
        .from('submissions')
        .update({
          score: res.score,
          max_score: res.max_score,
        })
        .eq('id', res.submission_id)
    }

    // Chunk answers upsert to avoid oversized payloads
    const answerBatches: any[][] = []
    for (let i = 0; i < answersToUpsert.length; i += 50) {
      answerBatches.push(answersToUpsert.slice(i, i + 50))
    }

    for (const batch of answerBatches) {
      const { error: upsertErr } = await adminClient.from('answers').upsert(batch)
      if (upsertErr) {
        console.error('[AI Grade] Answers upsert error:', upsertErr)
      }
    }

    // 8. Generate Teacher Exam Report
    const teacherReport = await generateTeacherExamReport({
      examTitle: exam.title,
      questions: questionsToGrade,
      evaluatedSubmissions: gradedResults,
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
    })

    return NextResponse.json({
      success: true,
      graded_count: gradedResults.length,
      results: gradedResults,
      report: teacherReport,
    })
  } catch (error: any) {
    console.error('[AI Grade] Exception:', error)
    return NextResponse.json(
      { error: error.message || 'حدث خطأ غير متوقع أثناء التصحيح الذكي' },
      { status: 500 }
    )
  }
}
