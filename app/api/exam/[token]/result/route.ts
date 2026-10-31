import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function GET(
  request: Request,
  props: { params: Promise<{ token: string }> }
) {
  const params = await props.params;
  try {
    const { token } = params
    const { searchParams } = new URL(request.url)
    const submissionId = searchParams.get('submission_id')

    if (!submissionId) {
      return NextResponse.json({ error: 'معرّف الجلسة مطلوب' }, { status: 400 })
    }

    const adminClient = getAdminClient()

    // 1. Fetch exam
    const { data: exam, error: examError } = await adminClient
      .from('exams')
      .select('id, title, results_released')
      .eq('public_token', token)
      .single()

    if (examError || !exam) {
      return NextResponse.json({ error: 'الاختبار غير صالح' }, { status: 404 })
    }

    // 2. Fetch submission
    const { data: submission, error: subError } = await adminClient
      .from('submissions')
      .select('id, score, max_score, submitted_at, student:students(full_name)')
      .eq('id', submissionId)
      .eq('exam_id', exam.id)
      .single()

    if (subError || !submission) {
      return NextResponse.json({ error: 'جلسة الاختبار غير صحيحة' }, { status: 404 })
    }

    if (!submission.submitted_at) {
      return NextResponse.json({ error: 'لم يتم تسليم الاختبار بعد' }, { status: 400 })
    }

    if (!exam.results_released) {
      return NextResponse.json({
        results_released: false,
        message: 'لم يتم إعلان درجات هذا الاختبار بعد من قبل المعلم.',
      })
    }

    const studentObj = submission.student as any
    const score = Number(submission.score ?? 0)
    const maxScore = Number(submission.max_score ?? 1)
    const percentage = Math.round((score / maxScore) * 100)

    return NextResponse.json({
      results_released: true,
      title: exam.title,
      student_name: studentObj?.full_name || '',
      score,
      max_score: maxScore,
      percentage,
      submitted_at: submission.submitted_at,
    })
  } catch (error) {
    console.error('[Exam Result] Exception in GET /api/exam/[token]/result:', error)
    return NextResponse.json(
      { error: 'حدث خطأ في جلب نتيجة الاختبار' },
      { status: 500 }
    )
  }
}
