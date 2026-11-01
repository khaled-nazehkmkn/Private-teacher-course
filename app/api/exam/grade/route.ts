import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabaseUser = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'غير مصرح لك بتصحيح الاختبار' }, { status: 401 })
    }

    const body = await request.json()
    const { submission_id, question_id, marks_awarded, feedback } = body

    if (!submission_id || !question_id || marks_awarded === undefined) {
      return NextResponse.json(
        { error: 'معرّف التسليم، معرّف السؤال، والدرجة حقول مطلوبة' },
        { status: 400 }
      )
    }

    const adminClient = getAdminClient()

    // 1. Verify this submission belongs to this teacher
    const { data: sub, error: subErr } = await adminClient
      .from('submissions')
      .select('id, teacher_id, max_score')
      .eq('id', submission_id)
      .eq('teacher_id', user.id)
      .single()

    if (subErr || !sub) {
      return NextResponse.json({ error: 'جلسة التسليم غير موجودة أو غير تابعة لك' }, { status: 404 })
    }

    // 2. Fetch current answer
    const { data: currentAns } = await adminClient
      .from('answers')
      .select('answer')
      .eq('submission_id', submission_id)
      .eq('question_id', question_id)
      .maybeSingle()

    let updatedAnswerObj: any = {}
    if (typeof currentAns?.answer === 'object' && currentAns?.answer !== null) {
      updatedAnswerObj = { ...currentAns.answer }
    } else if (currentAns?.answer !== undefined) {
      updatedAnswerObj = { text: currentAns.answer }
    }
    if (feedback !== undefined) {
      updatedAnswerObj.teacher_feedback = feedback
    }

    const numericMarks = Math.max(0, Number(marks_awarded))

    // 3. Upsert answer with teacher grade
    const { error: ansError } = await adminClient
      .from('answers')
      .upsert({
        submission_id,
        question_id,
        answer: updatedAnswerObj,
        marks_awarded: numericMarks,
        is_correct: numericMarks > 0,
      })

    if (ansError) {
      console.error('[Exam Grade] Error updating answer:', ansError)
      return NextResponse.json({ error: 'فشل تحديث درجة السؤال' }, { status: 500 })
    }

    // 4. Recalculate total score for submission
    const { data: allAnswers } = await adminClient
      .from('answers')
      .select('marks_awarded')
      .eq('submission_id', submission_id)

    const newTotalScore = (allAnswers || []).reduce(
      (sum, a) => sum + (Number(a.marks_awarded) || 0),
      0
    )

    await adminClient
      .from('submissions')
      .update({ score: newTotalScore })
      .eq('id', submission_id)

    return NextResponse.json({
      success: true,
      new_total_score: newTotalScore,
      marks_awarded: numericMarks,
    })
  } catch (error) {
    console.error('[Exam Grade] Exception:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'حدث خطأ في رصد الدرجة' },
      { status: 500 }
    )
  }
}
