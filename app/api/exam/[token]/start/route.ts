import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, recordFailedAttempt, resetAttempts } from '@/lib/rate-limit'
import { normalizeArabicDigits } from '@/lib/access-code'

export async function POST(
  request: Request,
  props: { params: Promise<{ token: string }> }
) {
  const params = await props.params;
  try {
    const { token } = params
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'anonymous-ip'

    // 1. Rate limiting
    const rateCheck = checkRateLimit(clientIp)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'تجاوزت الحد المسموح من المحاولات الخاطئة. يرجى الانتظار ١٠ دقائق ثم المحاولة مجدداً.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const rawCode = body.access_code ? String(body.access_code) : ''
    const cleanCode = normalizeArabicDigits(rawCode)

    if (!cleanCode) {
      return NextResponse.json({ error: 'كود الدخول مطلوب' }, { status: 400 })
    }

    const adminClient = getAdminClient()

    // 2. Fetch exam
    const { data: exam, error: examError } = await adminClient
      .from('exams')
      .select('id, teacher_id, title, duration_min, opens_at, closes_at, shuffle')
      .eq('public_token', token)
      .single()

    if (examError || !exam) {
      return NextResponse.json({ error: 'الاختبار غير موجود' }, { status: 404 })
    }

    // Check window
    const now = new Date()
    if (exam.opens_at && new Date(exam.opens_at) > now) {
      return NextResponse.json({ error: 'لم يبدأ وقت الاختبار بعد' }, { status: 403 })
    }
    if (exam.closes_at && new Date(exam.closes_at) < now) {
      return NextResponse.json({ error: 'انتهى موعد استقبال إجابات هذا الاختبار' }, { status: 403 })
    }

    // 3. Validate student access code
    const { data: student, error: studentError } = await adminClient
      .from('students')
      .select('id, full_name, group_id, grade')
      .eq('teacher_id', exam.teacher_id)
      .eq('access_code', cleanCode)
      .single()

    if (studentError || !student) {
      recordFailedAttempt(clientIp)
      return NextResponse.json({ error: 'كود الدخول غير صحيح' }, { status: 401 })
    }

    // Successful code verification, reset rate limit
    resetAttempts(clientIp)

    // 4. Check for previous submission (one attempt only constraint)
    const { data: existingSubmission } = await adminClient
      .from('submissions')
      .select('id, submitted_at, started_at')
      .eq('exam_id', exam.id)
      .eq('student_id', student.id)
      .maybeSingle()

    if (existingSubmission?.submitted_at) {
      return NextResponse.json(
        { error: 'لقد قمت بتسليم هذا الاختبار مسبقاً، ولا يمكن إعادة المحاولة.' },
        { status: 403 }
      )
    }

    // 5. Create or retrieve active submission
    let submissionId = existingSubmission?.id
    let startedAt = existingSubmission?.started_at

    if (!submissionId) {
      const { data: newSub, error: createSubError } = await adminClient
        .from('submissions')
        .insert({
          exam_id: exam.id,
          teacher_id: exam.teacher_id,
          student_id: student.id,
        })
        .select('id, started_at')
        .single()

      if (createSubError || !newSub) {
        console.error('[Exam Start] Failed to create submission:', createSubError)
        return NextResponse.json({ error: 'فشل بدء جلسة الاختبار' }, { status: 500 })
      }
      submissionId = newSub.id
      startedAt = newSub.started_at
    }

    // 6. Fetch questions for this exam
    const { data: examQuestions, error: eqError } = await adminClient
      .from('exam_questions')
      .select(`
        position,
        marks_override,
        question:questions (
          id,
          body,
          image_path,
          options,
          marks
        )
      `)
      .eq('exam_id', exam.id)
      .order('position', { ascending: true })

    if (eqError || !examQuestions) {
      console.error('[Exam Start] Error fetching exam questions:', eqError)
      return NextResponse.json({ error: 'تعذر جلب أسئلة الاختبار' }, { status: 500 })
    }

    // Fetch any previously autosaved answers for this submission
    const { data: savedAnswers } = await adminClient
      .from('answers')
      .select('question_id, answer')
      .eq('submission_id', submissionId)

    const savedAnswersMap = new Map<string, unknown>()
    savedAnswers?.forEach((a) => {
      savedAnswersMap.set(a.question_id, a.answer)
    })

    // Prepare questions WITHOUT correct answers!
    let formattedQuestions = examQuestions
      .filter((eq) => eq.question !== null)
      .map((eq) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const q = eq.question as any
        const optionsList: string[] = Array.isArray(q.options) ? [...q.options] : []

        return {
          id: q.id,
          body: q.body,
          image_path: q.image_path,
          marks: eq.marks_override ?? q.marks,
          options: optionsList,
          saved_answer: savedAnswersMap.get(q.id) ?? null,
        }
      })

    // Shuffle if enabled
    if (exam.shuffle) {
      // Deterministic or pseudorandom shuffle
      formattedQuestions = formattedQuestions.sort(() => Math.random() - 0.5)
    }

    return NextResponse.json({
      submission_id: submissionId,
      started_at: startedAt,
      duration_min: exam.duration_min,
      student_name: student.full_name,
      questions: formattedQuestions,
    })
  } catch (error) {
    console.error('[Exam Start] Exception in POST /api/exam/[token]/start:', error)
    return NextResponse.json(
      { error: 'حدث خطأ في بدء الاختبار' },
      { status: 500 }
    )
  }
}
