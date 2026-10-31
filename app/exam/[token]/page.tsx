'use client'

import React, { useState, useEffect, useRef, use } from 'react'
import {
  GraduationCap,
  Clock,
  AlertCircle,
  CheckCircle2,
  Send,
  Loader2,
  Award,
} from 'lucide-react'

interface QuestionItem {
  id: string
  body: string
  image_path?: string | null
  marks: number
  options: string[]
  saved_answer?: unknown
}

interface ExamMeta {
  title: string
  duration_min: number
  grade?: string
  teacher_name: string
  subject: string
  isOpen: boolean
  closedReason?: string
  opens_at?: string
  closes_at?: string
}

export default function StudentExamPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)

  const [meta, setMeta] = useState<ExamMeta | null>(null)
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [metaError, setMetaError] = useState<string | null>(null)

  // Step 1: Code entry
  const [accessCode, setAccessCode] = useState('')
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  // Step 2: Live exam session
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [studentName, setStudentName] = useState<string>('')
  const [questions, setQuestions] = useState<QuestionItem[]>([])
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({})
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0)
  const [autosavingQuestionId, setAutosavingQuestionId] = useState<string | null>(null)

  // Step 3: Submitted state
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [resultData, setResultData] = useState<{
    results_released: boolean
    score?: number | null
    max_score?: number | null
  } | null>(null)

  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch Exam Metadata
  useEffect(() => {
    async function loadMeta() {
      try {
        const res = await fetch(`/api/exam/${token}`)
        const data = await res.json()
        if (!res.ok) {
          setMetaError(data.error || 'تعذر تحميل بيانات الاختبار')
        } else {
          setMeta(data)
        }
      } catch (err) {
        console.error('Error fetching exam metadata:', err)
        setMetaError('حدث خطأ في الاتصال بالخادم')
      } finally {
        setLoadingMeta(false)
      }
    }
    loadMeta()
  }, [token])

  // Countdown Timer
  useEffect(() => {
    if (!submissionId || isSubmitted || secondsRemaining <= 0) return

    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          // Auto submit when time runs out
          handleFinalSubmit()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [submissionId, isSubmitted, secondsRemaining])

  // Start exam session
  const handleStartExam = async (e: React.FormEvent) => {
    e.preventDefault()
    setStartError(null)
    setStarting(true)

    try {
      const res = await fetch(`/api/exam/${token}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_code: accessCode }),
      })

      const data = await res.json()
      if (!res.ok) {
        setStartError(data.error || 'كود الدخول غير صحيح')
        setStarting(false)
        return
      }

      setSubmissionId(data.submission_id)
      setStudentName(data.student_name)
      setQuestions(data.questions || [])

      // Initial answers from server autosave if any
      const initialAnswers: Record<string, number> = {}
      data.questions.forEach((q: QuestionItem) => {
        if (q.saved_answer !== null && q.saved_answer !== undefined) {
          initialAnswers[q.id] = Number(q.saved_answer)
        }
      })
      setSelectedAnswers(initialAnswers)

      // Calculate remaining time
      const startedAtTime = new Date(data.started_at).getTime()
      const totalSeconds = (data.duration_min || 30) * 60
      const elapsedSeconds = Math.floor((Date.now() - startedAtTime) / 1000)
      const remaining = Math.max(0, totalSeconds - elapsedSeconds)
      setSecondsRemaining(remaining)
    } catch (err) {
      console.error('[Exam Start] Request error:', err)
      setStartError('حدث خطأ أثناء بدء الاختبار')
    } finally {
      setStarting(false)
    }
  }

  // Handle option select with automatic background autosave
  const handleSelectOption = async (questionId: string, optionIndex: number) => {
    if (isSubmitted) return

    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex,
    }))

    // Background Autosave
    setAutosavingQuestionId(questionId)
    try {
      await fetch(`/api/exam/${token}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_id: submissionId,
          question_id: questionId,
          answer: optionIndex,
        }),
      })
    } catch (e) {
      console.error('[Autosave] Failed to autosave answer:', e)
    } finally {
      setAutosavingQuestionId(null)
    }
  }

  // Submit Exam
  const handleFinalSubmit = async () => {
    if (submitting || isSubmitted || !submissionId) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/exam/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_id: submissionId,
          final_answers: selectedAnswers,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        setIsSubmitted(true)
        setResultData(data)
      } else {
        alert(data.error || 'حدث خطأ أثناء تسليم الاختبار')
      }
    } catch (err) {
      console.error('[Submit Exam] Error:', err)
      alert('فشل تسليم الاختبار، يرجى المحاولة مرة أخرى')
    } finally {
      setSubmitting(false)
    }
  }

  // Format timer
  const minutes = Math.floor(secondsRemaining / 60)
  const seconds = secondsRemaining % 60
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  if (loadingMeta) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f8fb] text-[#17263b] p-4">
        <div className="flex items-center gap-3 rounded-2xl bg-white px-6 py-4 shadow-sm">
          <Loader2 className="size-5 animate-spin text-[#1d5ca8]" />
          <span className="text-sm font-bold">جاري تحميل الاختبار...</span>
        </div>
      </div>
    )
  }

  if (metaError || !meta) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f6f8fb] p-4 text-[#17263b]">
        <div className="w-full max-w-md rounded-3xl border border-rose-200 bg-white p-6 sm:p-8 text-center shadow-lg">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-rose-50 text-rose-600">
            <AlertCircle className="size-8" />
          </div>
          <h2 className="mt-4 text-lg sm:text-xl font-bold text-slate-800">تعذر فتح الاختبار</h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-500">{metaError || 'الرابط غير صالح'}</p>
        </div>
      </div>
    )
  }

  // Render Step 3: Submitted State
  if (isSubmitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f6f8fb] p-4 text-[#17263b]">
        <div className="w-full max-w-lg rounded-3xl border border-[#e6ebf2] bg-white p-6 sm:p-8 text-center shadow-xl">
          <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="size-10" />
          </div>

          <h2 className="mt-4 text-xl sm:text-2xl font-extrabold text-[#153b68]">تم تسليم الاختبار بنجاح</h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-600">
            شكراً لك، <span className="font-bold text-slate-800">{studentName}</span>. تم تسجيل إجاباتك بنجاح على الخادم.
          </p>

          {resultData?.results_released ? (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 sm:p-6 text-emerald-900">
              <div className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                <Award className="size-6" />
              </div>
              <p className="mt-3 text-xs font-bold text-emerald-700">درجة الاختبار</p>
              <p className="mt-1 text-3xl sm:text-4xl font-black">
                {resultData.score}{' '}
                <span className="text-lg sm:text-xl font-normal text-emerald-600">/ {resultData.max_score}</span>
              </p>
              <p className="mt-2 text-xs font-semibold">
                النسبة المئوية: {Math.round(((resultData.score || 0) / (resultData.max_score || 1)) * 100)}%
              </p>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 sm:p-5 text-xs sm:text-sm text-blue-900">
              <p className="font-bold">ملاحظة بشأن النتيجة</p>
              <p className="mt-1 text-xs text-blue-700">
                سيتم إعلان الدرجة والتفاصيل من قبل الأستاذ بعد انتهاء موعد الاختبار ومراجعة الإجابات.
              </p>
            </div>
          )}

          <div className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-400">
            {meta.title} · الأستاذ: {meta.teacher_name} ({meta.subject})
          </div>
        </div>
      </div>
    )
  }

  // Render Step 1: Access Code Prompt
  if (!submissionId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f6f8fb] p-4 text-[#17263b]">
        <div className="w-full max-w-md rounded-3xl border border-[#e6ebf2] bg-white p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <div className="flex flex-col items-center text-center">
            <div className="grid size-12 sm:size-14 place-items-center rounded-2xl bg-[#153b68] text-white shadow-md">
              <GraduationCap className="size-6 sm:size-8" />
            </div>
            <h1 className="mt-4 text-lg sm:text-xl font-extrabold text-[#153b68]">{meta.title}</h1>
            <p className="mt-1 text-xs text-slate-500">
              الأستاذ: {meta.teacher_name} · مادة {meta.subject}
            </p>
            {meta.grade && (
              <span className="mt-2 rounded-full bg-slate-100 px-3 py-0.5 text-xs font-bold text-slate-600">
                {meta.grade}
              </span>
            )}
          </div>

          <div className="mt-5 flex items-center justify-around rounded-2xl bg-slate-50 p-3 text-center text-xs text-slate-600">
            <div>
              <p className="text-[11px] text-slate-400">مدة الاختبار</p>
              <p className="mt-0.5 font-bold">{meta.duration_min} دقيقة</p>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <p className="text-[11px] text-slate-400">المحاولات</p>
              <p className="mt-0.5 font-bold text-amber-600">محاولة واحدة فقط</p>
            </div>
          </div>

          {!meta.isOpen ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center text-xs font-bold text-amber-800">
              <AlertCircle className="mx-auto mb-1.5 size-5" />
              {meta.closedReason || 'الاختبار مغلق حالياً'}
            </div>
          ) : (
            <form onSubmit={handleStartExam} className="mt-5 space-y-4">
              {startError && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{startError}</span>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  أدخل كود الدخول الخاص بك (Access Code)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  placeholder="مثال: 48921"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-3.5 px-4 text-center font-mono text-xl font-bold tracking-widest transition focus:border-[#1d5ca8] focus:bg-white focus:outline-hidden"
                  autoFocus
                />
                <p className="mt-1.5 text-center text-[11px] text-slate-400">
                  الكود مكوّن من ٤ إلى ٦ أرقام ومخصص لك من المعلم
                </p>
              </div>

              <button
                type="submit"
                disabled={starting || !accessCode.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1d5ca8] py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#164e93] active:scale-98 disabled:opacity-50"
              >
                {starting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    جاري التحقق وبدء الاختبار...
                  </>
                ) : (
                  <span>ابدأ الاختبار الآن</span>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    )
  }

  // Render Step 2: Live Exam Taking (Mobile-Screen Optimized)
  const answeredCount = Object.keys(selectedAnswers).length
  const totalCount = questions.length

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-[#17263b] pb-24 sm:pb-12">
      {/* Sticky Top Mobile Header with Timer and Student Info */}
      <header className="sticky top-0 z-30 border-b border-[#e6ebf2] bg-white/95 backdrop-blur-md px-4 py-2.5 sm:py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="min-w-0 pr-1">
            <h1 className="truncate text-sm sm:text-base font-extrabold text-[#153b68]">
              {meta.title}
            </h1>
            <p className="text-[11px] text-slate-500 truncate">الطالب: {studentName}</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Progress counter */}
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700">
              {answeredCount}/{totalCount}
            </span>

            {/* Countdown timer pill */}
            <div
              className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 font-mono text-xs font-bold shadow-xs ${
                secondsRemaining < 300
                  ? 'bg-rose-50 text-rose-600 animate-pulse border border-rose-200'
                  : 'bg-slate-100 text-[#153b68]'
              }`}
            >
              <Clock className="size-3.5" />
              <span>{formattedTime}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Question Flow */}
      <main className="mx-auto max-w-3xl px-3 sm:px-6 py-4 space-y-4">
        {questions.map((q, qIndex) => {
          const isAnswered = selectedAnswers[q.id] !== undefined
          const selectedOpt = selectedAnswers[q.id]

          return (
            <div
              key={q.id}
              className={`rounded-2xl border bg-white p-4 sm:p-6 shadow-xs transition ${
                isAnswered ? 'border-[#1d5ca8]/40 ring-1 ring-[#1d5ca8]/10' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-lg bg-[#153b68] text-xs font-bold text-white">
                    {qIndex + 1}
                  </span>
                  <span className="text-xs font-bold text-slate-400">
                    ({q.marks} {q.marks === 1 ? 'درجة' : 'درجات'})
                  </span>
                </div>

                {autosavingQuestionId === q.id && (
                  <span className="text-[10px] text-slate-400 animate-pulse">جاري الحفظ...</span>
                )}
              </div>

              {/* Question Body */}
              <p className="mt-2.5 text-sm sm:text-base font-bold text-slate-800 leading-relaxed">
                {q.body}
              </p>

              {/* Optional Image */}
              {q.image_path && (
                <div className="mt-2.5 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={q.image_path}
                    alt="توضيح السؤال"
                    className="max-h-60 w-full object-contain"
                  />
                </div>
              )}

              {/* Phone-Friendly Options (Minimum 48px Touch Height) */}
              <div className="mt-3.5 space-y-2">
                {q.options.map((option, optIdx) => {
                  const isSelected = selectedOpt === optIdx

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => handleSelectOption(q.id, optIdx)}
                      className={`flex min-h-[48px] w-full items-center justify-between rounded-xl border p-3 text-right text-xs sm:text-sm font-semibold transition active:scale-[0.99] ${
                        isSelected
                          ? 'border-[#1d5ca8] bg-[#eaf2ff] text-[#1d5ca8] shadow-xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                            isSelected
                              ? 'bg-[#1d5ca8] text-white'
                              : 'border border-slate-300 text-slate-500'
                          }`}
                        >
                          {String.fromCharCode(65 + optIdx)}
                        </span>
                        <span className="break-words">{option}</span>
                      </div>
                      {isSelected && <CheckCircle2 className="size-4 shrink-0 text-[#1d5ca8]" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Floating / Sticky Mobile Bottom Action Bar */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 backdrop-blur-md sm:static sm:border-none sm:bg-transparent sm:p-0">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <div className="text-xs">
              <span className="font-bold text-slate-800">
                {answeredCount} من {totalCount}
              </span>
              <span className="text-slate-400 mr-1 hidden sm:inline">أسئلة مُجابة</span>
            </div>

            <button
              onClick={handleFinalSubmit}
              disabled={submitting}
              className="flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl bg-[#1d5ca8] px-6 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md active:bg-[#164e93] disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  جاري التسليم...
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  <span>تسليم الاختبار</span>
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
