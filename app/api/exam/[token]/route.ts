import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { normalizeExamLanguage } from '@/lib/exam-language'

export async function GET(
  request: Request,
  props: { params: Promise<{ token: string }> }
) {
  const params = await props.params
  try {
    const { token } = params
    const adminClient = getAdminClient()

    // Fetch exam with teacher info (gracefully fallback if language column migration hasn't run yet)
    let { data: exam, error } = await adminClient
      .from('exams')
      .select('id, title, duration_min, opens_at, closes_at, grade, teacher_id, language')
      .eq('public_token', token)
      .single()

    if (error && (error.code === '42703' || error.message?.includes('language'))) {
      const fallback = await adminClient
        .from('exams')
        .select('id, title, duration_min, opens_at, closes_at, grade, teacher_id')
        .eq('public_token', token)
        .single()
      exam = fallback.data ? { ...fallback.data, language: 'ar' } : null
      error = fallback.error
    }

    if (error || !exam) {
      return NextResponse.json({ error: 'الاختبار غير موجود أو الرابط غير صالح' }, { status: 404 })
    }

    // Verify teacher status
    const { data: teacher } = await adminClient
      .from('teachers')
      .select('full_name, subject, is_suspended, active_from, active_to')
      .eq('id', exam.teacher_id)
      .single()

    const language = normalizeExamLanguage((exam as { language?: string | null }).language)
    const now = new Date()
    let isOpen = true
    let closedReason = ''

    if (exam.opens_at && new Date(exam.opens_at) > now) {
      isOpen = false
      closedReason =
        language === 'en'
          ? 'This exam has not opened yet'
          : 'لم يحن موعد فتح الاختبار بعد'
    } else if (exam.closes_at && new Date(exam.closes_at) < now) {
      isOpen = false
      closedReason =
        language === 'en'
          ? 'The submission window for this exam has ended'
          : 'انتهى موعد استقبال إجابات هذا الاختبار'
    }

    if (teacher?.is_suspended) {
      isOpen = false
      closedReason =
        language === 'en'
          ? 'This exam is currently unavailable'
          : 'الاختبار غير متاح حالياً'
    }

    return NextResponse.json({
      title: exam.title,
      duration_min: exam.duration_min,
      grade: exam.grade,
      language,
      teacher_name: teacher?.full_name || (language === 'en' ? 'Teacher' : 'المعلم'),
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
