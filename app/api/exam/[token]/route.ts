import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function GET(
  request: Request,
  props: { params: Promise<{ token: string }> }
) {
  const params = await props.params;
  try {
    const { token } = params
    const adminClient = getAdminClient()

    // Fetch exam with teacher info
    const { data: exam, error } = await adminClient
      .from('exams')
      .select('id, title, duration_min, opens_at, closes_at, grade, teacher_id')
      .eq('public_token', token)
      .single()

    if (error || !exam) {
      return NextResponse.json({ error: 'الاختبار غير موجود أو الرابط غير صالح' }, { status: 404 })
    }

    // Verify teacher status
    const { data: teacher } = await adminClient
      .from('teachers')
      .select('full_name, subject, is_suspended, active_from, active_to')
      .eq('id', exam.teacher_id)
      .single()

    const now = new Date()
    let isOpen = true
    let closedReason = ''

    if (exam.opens_at && new Date(exam.opens_at) > now) {
      isOpen = false
      closedReason = 'لم يحن موعد فتح الاختبار بعد'
    } else if (exam.closes_at && new Date(exam.closes_at) < now) {
      isOpen = false
      closedReason = 'انتهى موعد استقبال إجابات هذا الاختبار'
    }

    if (teacher?.is_suspended) {
      isOpen = false
      closedReason = 'الاختبار غير متاح حالياً'
    }

    return NextResponse.json({
      title: exam.title,
      duration_min: exam.duration_min,
      grade: exam.grade,
      teacher_name: teacher?.full_name || 'المعلم',
      subject: teacher?.subject || '',
      isOpen,
      closedReason,
      opens_at: exam.opens_at,
      closes_at: exam.closes_at,
    })
  } catch (error) {
    console.error('[Exam API] Exception in GET /api/exam/[token]:', error)
    return NextResponse.json(
      { error: 'حدث خطأ في جلب بيانات الاختبار' },
      { status: 500 }
    )
  }
}
