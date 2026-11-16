import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { releaseExamSession } from '@/lib/rate-limit'
import { evaluateTeacherStatus } from '@/lib/teacher-status'

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const supabaseUser = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'غير مصرح لك' }, { status: 401 })
    }

    const submissionId = params.id
    const adminClient = getAdminClient()

    // 1. Fetch submission with student and exam
    const { data: sub, error: subErr } = await adminClient
      .from('submissions')
      .select(`
        id,
        exam_id,
        student_id,
        score,
        max_score,
        started_at,
        submitted_at,
        student:students (id, full_name, parent_phone, grade),
        exam:exams (id, title, grade)
      `)
      .eq('id', submissionId)
      .eq('teacher_id', user.id)
      .single()

    if (subErr || !sub) {
      return NextResponse.json({ error: 'جلسة التسليم غير موجودة' }, { status: 404 })
    }

    // 2. Fetch exam questions
    const { data: examQuestions } = await adminClient
      .from('exam_questions')
      .select(`
        question_id,
        marks_override,
        position,
        question:questions (
          id,
          body,
          image_path,
          options,
          correct,
          marks,
          type
        )
      `)
      .eq('exam_id', sub.exam_id)
      .order('position', { ascending: true })

    // 3. Fetch student answers for this submission
    const { data: answers } = await adminClient
      .from('answers')
      .select('question_id, answer, is_correct, marks_awarded')
      .eq('submission_id', submissionId)

    const answersMap: Record<string, any> = {}
    answers?.forEach((a) => {
      answersMap[a.question_id] = a
    })

    const questionsWithAnswers = (examQuestions || []).map((eq: any) => {
      const q = eq.question
      const ans = answersMap[eq.question_id]
      return {
        id: eq.question_id,
        body: q?.body || '',
        image_path: q?.image_path || null,
        type: q?.type || 'mcq',
        options: Array.isArray(q?.options) ? q.options : [],
        correct: Array.isArray(q?.correct) ? q.correct : [],
        marks: Number(eq.marks_override ?? q?.marks ?? 1),
        student_answer: ans?.answer || null,
        is_correct: ans?.is_correct ?? null,
        marks_awarded: ans?.marks_awarded !== undefined ? Number(ans.marks_awarded) : null,
      }
    })

    return NextResponse.json({
      success: true,
      submission: sub,
      questions: questionsWithAnswers,
    })
  } catch (error) {
    console.error('[Get Submission Detail] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'حدث خطأ غير متوقع' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const supabaseUser = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'غير مصرح لك' }, { status: 401 })
    }

    const adminClient = getAdminClient()

    // Check teacher active status
    const { data: teacherRow } = await adminClient
      .from('teachers')
      .select('is_admin, is_suspended, active_from, active_to')
      .eq('id', user.id)
      .single()

    if (teacherRow && !evaluateTeacherStatus(teacherRow).isActive) {
      return NextResponse.json(
        { error: 'حسابك في وضع القراءة فقط، لا يمكنك حذف سجلات الاختبار' },
        { status: 403 }
      )
    }

    const submissionId = params.id

    // Verify ownership and get exam_id + student_id to release active session lock
    const { data: sub, error: fetchErr } = await adminClient
      .from('submissions')
      .select('id, exam_id, student_id')
      .eq('id', submissionId)
      .eq('teacher_id', user.id)
      .single()

    if (fetchErr || !sub) {
      return NextResponse.json({ error: 'سجل الطالب غير موجود' }, { status: 404 })
    }

    const { error: deleteErr } = await adminClient
      .from('submissions')
      .delete()
      .eq('id', submissionId)
      .eq('teacher_id', user.id)

    if (deleteErr) {
      console.error('[Delete Submission] Error:', deleteErr)
      return NextResponse.json({ error: 'فشل حذف سجل الطالب' }, { status: 500 })
    }

    // Also clear any in-memory single-device session lock
    releaseExamSession(sub.exam_id, sub.student_id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Delete Submission] Exception:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'حدث خطأ غير متوقع' },
      { status: 500 }
    )
  }
}
