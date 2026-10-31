import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function POST(
  request: Request,
  props: { params: Promise<{ token: string }> }
) {
  const params = await props.params;
  try {
    const { token } = params
    const body = await request.json()
    const { submission_id, question_id, answer } = body

    if (!submission_id || !question_id) {
      return NextResponse.json({ error: 'معرّف الجلسة والسؤال مطلوبان' }, { status: 400 })
    }

    const adminClient = getAdminClient()

    // 1. Verify exam and submission state
    const { data: exam, error: examError } = await adminClient
      .from('exams')
      .select('id, duration_min, closes_at')
      .eq('public_token', token)
      .single()

    if (examError || !exam) {
      return NextResponse.json({ error: 'الاختبار غير صالح' }, { status: 404 })
    }

    const { data: submission, error: subError } = await adminClient
      .from('submissions')
      .select('id, submitted_at, started_at')
      .eq('id', submission_id)
      .eq('exam_id', exam.id)
      .single()

    if (subError || !submission) {
      return NextResponse.json({ error: 'جلسة الاختبار غير صحيحة' }, { status: 404 })
    }

    if (submission.submitted_at) {
      return NextResponse.json({ error: 'تم تسليم الاختبار بالفعل' }, { status: 400 })
    }

    // Check timer expiration with 60-second grace buffer for network latency
    const started = new Date(submission.started_at).getTime()
    const maxDurationMs = (exam.duration_min * 60 + 60) * 1000
    if (Date.now() - started > maxDurationMs) {
      return NextResponse.json({ error: 'انتهت مدة الاختبار المحددة' }, { status: 403 })
    }

    // 2. Upsert answer
    const { error: upsertError } = await adminClient
      .from('answers')
      .upsert({
        submission_id,
        question_id,
        answer,
      })

    if (upsertError) {
      console.error('[Exam Answer] Error saving answer:', upsertError)
      return NextResponse.json({ error: 'فشل حفظ الإجابة' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Exam Answer] Exception in POST /api/exam/[token]/answer:', error)
    return NextResponse.json(
      { error: 'حدث خطأ في حفظ الإجابة' },
      { status: 500 }
    )
  }
}
