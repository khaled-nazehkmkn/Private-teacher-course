'use client'

import React, { useState } from 'react'
import {
  BarChart3,
  Plus,
  Share2,
  QrCode,
  Eye,
  EyeOff,
  Clock,
  Calendar,
  MessageCircle,
  TrendingUp,
  AlertCircle,
  Shuffle,
  Users,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  Printer,
  Edit3,
  ZoomIn,
  FileText,
  Image as ImageIcon,
} from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { DateTimePicker } from '@/components/ui/datetime-picker'
import { QRCodeModal } from '@/components/QRCodeModal'
import { buildWhatsAppLink, formatExamResultMessage } from '@/lib/whatsapp'
import type { TeacherStatus } from '@/lib/teacher-status'
import type { GroupItem } from '../groups/GroupsView'
import type { QuestionBankItem } from '../questions/QuestionsView'
import type { StudentItem } from '../students/StudentsView'

export interface ExamItem {
  id: string
  title: string
  group_id: string | null
  grade: string | null
  duration_min: number
  opens_at: string | null
  closes_at: string | null
  shuffle: boolean
  results_released: boolean
  public_token: string
  question_ids: string[]
  created_at: string
}

export interface ExamSubmissionDetail {
  id: string
  student_id: string
  student_name: string
  parent_phone: string
  score: number
  max_score: number
  submitted_at: string
  answers: Array<{
    question_id: string
    is_correct: boolean
    marks_awarded: number
  }>
}

interface Props {
  exams: ExamItem[]
  groups: GroupItem[]
  questions: QuestionBankItem[]
  students: StudentItem[]
  teacherName: string
  onCreateExam: (exam: {
    title: string
    group_id?: string | null
    grade?: string | null
    duration_min: number
    opens_at?: string | null
    closes_at?: string | null
    shuffle: boolean
    question_ids: string[]
  }) => Promise<void>
  onToggleResultsRelease: (examId: string, currentReleased: boolean) => Promise<void>
  onDeleteExam: (examId: string) => Promise<void>
  onFetchExamSubmissions: (examId: string) => Promise<ExamSubmissionDetail[]>
  onLogWhatsAppResult: (studentId: string, message: string) => Promise<void>
  teacherStatus: TeacherStatus
}

export function ExamsView({
  exams,
  groups,
  questions,
  students,
  teacherName,
  onCreateExam,
  onToggleResultsRelease,
  onDeleteExam,
  onFetchExamSubmissions,
  onLogWhatsAppResult,
  teacherStatus,
}: Props) {
  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [activeShareExam, setActiveShareExam] = useState<ExamItem | null>(null)

  // Results details modal state
  const [resultsModalOpen, setResultsModalOpen] = useState(false)
  const [selectedExamForResults, setSelectedExamForResults] = useState<ExamItem | null>(null)
  const [submissionsList, setSubmissionsList] = useState<ExamSubmissionDetail[]>([])
  const [loadingSubmissions, setLoadingSubmissions] = useState(false)

  // Create Form State
  const [title, setTitle] = useState('')
  const [targetGroupId, setTargetGroupId] = useState<string>('')
  const [durationMin, setDurationMin] = useState(30)
  const [opensAt, setOpensAt] = useState('')
  const [closesAt, setClosesAt] = useState('')
  const [shuffle, setShuffle] = useState(true)
  const [selectionMode, setSelectionMode] = useState<'pick' | 'random'>('random')
  const [randomCount, setRandomCount] = useState(10)
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([])
  const [savingExam, setSavingExam] = useState(false)

  // Print PDF Modal
  const [printModalOpen, setPrintModalOpen] = useState(false)
  const [printExam, setPrintExam] = useState<ExamItem | null>(null)

  // Grading Modal
  const [gradingModalOpen, setGradingModalOpen] = useState(false)
  const [gradingSubmission, setGradingSubmission] = useState<ExamSubmissionDetail | null>(null)
  const [gradingData, setGradingData] = useState<any>(null)
  const [loadingGrading, setLoadingGrading] = useState(false)
  const [awardedMarksMap, setAwardedMarksMap] = useState<Record<string, number>>({})
  const [feedbackMap, setFeedbackMap] = useState<Record<string, string>>({})
  const [savingGradeId, setSavingGradeId] = useState<string | null>(null)
  const [previewZoomImage, setPreviewZoomImage] = useState<string | null>(null)

  const handleOpenPrintPdf = (exam: ExamItem) => {
    setPrintExam(exam)
    setPrintModalOpen(true)
  }

  const handleOpenGrading = async (sub: ExamSubmissionDetail) => {
    setGradingSubmission(sub)
    setGradingModalOpen(true)
    setLoadingGrading(true)
    try {
      const res = await fetch(`/api/exam/submission/${sub.id}`)
      if (!res.ok) throw new Error('فشل جلب تفاصيل الإجابات')
      const data = await res.json()
      setGradingData(data)
      const initialMarks: Record<string, number> = {}
      const initialFeedback: Record<string, string> = {}
      data.questions?.forEach((q: any) => {
        initialMarks[q.id] = q.marks_awarded !== null ? Number(q.marks_awarded) : 0
        if (q.student_answer?.teacher_feedback) {
          initialFeedback[q.id] = q.student_answer.teacher_feedback
        }
      })
      setAwardedMarksMap(initialMarks)
      setFeedbackMap(initialFeedback)
    } catch (err) {
      console.error(err)
      alert('حدث خطأ أثناء تحميل إجابات الطالب')
    } finally {
      setLoadingGrading(false)
    }
  }

  const handleSaveQuestionGrade = async (questionId: string) => {
    if (!gradingSubmission) return
    setSavingGradeId(questionId)
    try {
      const marks = awardedMarksMap[questionId] ?? 0
      const feedback = feedbackMap[questionId] || ''
      const res = await fetch('/api/exam/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_id: gradingSubmission.id,
          question_id: questionId,
          marks_awarded: marks,
          feedback,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'فشل حفظ الدرجة')

      if (result.new_total_score !== undefined) {
        setSubmissionsList((prev) =>
          prev.map((s) =>
            s.id === gradingSubmission.id ? { ...s, score: result.new_total_score } : s
          )
        )
      }
      alert('تم حفظ واعتماد درجة السؤال بنجاح ✓')
    } catch (err) {
      console.error(err)
      alert('فشل حفظ الدرجة')
    } finally {
      setSavingGradeId(null)
    }
  }

  // Handle Open Results Analysis Modal
  const handleOpenResults = async (exam: ExamItem) => {
    setSelectedExamForResults(exam)
    setResultsModalOpen(true)
    setLoadingSubmissions(true)
    try {
      const subs = await onFetchExamSubmissions(exam.id)
      setSubmissionsList(subs)
    } catch (e) {
      console.error('Error fetching submissions:', e)
    } finally {
      setLoadingSubmissions(false)
    }
  }

  // Handle Create Exam
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    let finalQuestionIds = [...selectedQuestionIds]

    if (selectionMode === 'random') {
      const targetGroup = groups.find((g) => g.id === targetGroupId)
      const matchingQuestions = questions.filter(
        (q) => !targetGroup || q.grade === targetGroup.grade
      )

      if (matchingQuestions.length === 0) {
        alert('لا توجد أسئلة كافية في بنك الأسئلة لهذه المرحلة الدراسية')
        return
      }

      // Pick random
      const shuffledPool = [...matchingQuestions].sort(() => Math.random() - 0.5)
      finalQuestionIds = shuffledPool.slice(0, randomCount).map((q) => q.id)
    }

    if (finalQuestionIds.length === 0) {
      alert('يجب تحديد سؤال واحد على الأقل للاختبار')
      return
    }

    setSavingExam(true)
    try {
      const targetGroup = groups.find((g) => g.id === targetGroupId)
      await onCreateExam({
        title: title.trim(),
        group_id: targetGroupId || null,
        grade: targetGroup?.grade || null,
        duration_min: durationMin,
        opens_at: opensAt ? new Date(opensAt).toISOString() : null,
        closes_at: closesAt ? new Date(closesAt).toISOString() : null,
        shuffle,
        question_ids: finalQuestionIds,
      })

      setCreateModalOpen(false)
      setTitle('')
      setSelectedQuestionIds([])
    } catch (err) {
      console.error(err)
      alert('فشل إنشاء الاختبار')
    } finally {
      setSavingExam(false)
    }
  }

  // Handle WhatsApp Result Send
  const handleSendResultWhatsApp = async (sub: ExamSubmissionDetail, examTitle: string) => {
    const percentage = Math.round((sub.score / (sub.max_score || 1)) * 100)
    const message = formatExamResultMessage({
      studentName: sub.student_name,
      examTitle,
      teacherName: teacherName || 'المعلم',
      score: sub.score,
      maxScore: sub.max_score,
      percentage,
    })

    const link = buildWhatsAppLink(sub.parent_phone, message)
    try {
      await onLogWhatsAppResult(sub.student_id, message)
    } catch (e) {
      console.error(e)
    }
    window.open(link, '_blank')
  }

  // Calculate stats for open exam results modal
  const totalSubmissions = submissionsList.length
  const avgScore = totalSubmissions
    ? Math.round(
        (submissionsList.reduce((acc, curr) => acc + curr.score, 0) / totalSubmissions) * 10
      ) / 10
    : 0

  const originUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-extrabold text-[#153b68]">الاختبارات والتقييمات</h2>
          <p className="text-xs text-slate-500">
            إنشاء الاختبارات، توليد روابط ورموز QR للطلاب، وتصحيح الإجابات تلقائياً
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          disabled={!teacherStatus.isActive}
          className="inline-flex items-center gap-2 rounded-xl bg-[#1d5ca8] px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#164e93] disabled:opacity-50"
        >
          <Plus className="size-4" />
          <span>إنشاء اختبار جديد</span>
        </button>
      </div>

      {/* Exams Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {exams.map((exam) => {
          const shareUrl = `${originUrl}/exam/${exam.public_token}`
          const grp = groups.find((g) => g.id === exam.group_id)

          return (
            <div
              key={exam.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-[#1d5ca8]/40"
            >
              <div>
                <div className="flex items-start justify-between">
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                    {grp?.name || exam.grade || 'عام'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onToggleResultsRelease(exam.id, exam.results_released)}
                      disabled={!teacherStatus.isActive}
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition disabled:opacity-50 ${
                        exam.results_released
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                      title={
                        exam.results_released ? 'الدرجات معلنة للطلاب' : 'الدرجات محجوبة عن الطلاب'
                      }
                    >
                      {exam.results_released ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
                      <span>{exam.results_released ? 'النتيجة معلنة' : 'حجب النتيجة'}</span>
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`هل أنت متأكد من حذف اختبار "${exam.title}"؟`)) {
                          onDeleteExam(exam.id)
                        }
                      }}
                      disabled={!teacherStatus.isActive}
                      className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>

                <h3 className="mt-3 text-base font-extrabold text-slate-800">{exam.title}</h3>

                <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5 text-[#1d5ca8]" />
                    {exam.duration_min} دقيقة
                  </span>
                  <span className="flex items-center gap-1">
                    <Shuffle className="size-3.5 text-slate-400" />
                    {exam.shuffle ? 'ترتيب عشوائي' : 'ترتيب ثابت'}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3">
                <button
                  onClick={() => handleOpenResults(exam)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1d5ca8] hover:underline"
                >
                  <BarChart3 className="size-4" />
                  <span>سجل الطلاب والنتائج (History)</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenPrintPdf(exam)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                    title="تصدير وطباعة ورقة الامتحان PDF"
                  >
                    <Printer className="size-3.5 text-[#1d5ca8]" />
                    <span>طباعة PDF</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveShareExam(exam)
                      setQrModalOpen(true)
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                    title="مشاركة الرمز ورابط الامتحان"
                  >
                    <QrCode className="size-3.5" />
                    <span>مشاركة</span>
                  </button>
                </div>
              </div>
            </div>
          )
        })}

        {exams.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">
            <BarChart3 className="mx-auto size-10 text-slate-300" />
            <p className="mt-3 text-sm font-bold text-slate-600">لا توجد اختبارات منشأة بعد</p>
            <p className="mt-1 text-xs text-slate-400">
              قم بإنشاء اختبارك الأول واختيار الأسئلة من بنك الأسئلة لمشاركتها مع الطلاب
            </p>
          </div>
        )}
      </div>

      {/* Create Exam Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="إنشاء اختبار جديد"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">عنوان الاختبار</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: اختبار الوحدة الأولى - الجبر"
              className="w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-hidden focus:border-[#1d5ca8]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">المجموعة المستهدفة</label>
              <select
                value={targetGroupId}
                onChange={(e) => setTargetGroupId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-hidden"
              >
                <option value="">متاح لجميع المجموعات</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.grade})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">المدة بالدقائق</label>
              <input
                type="number"
                min="5"
                max="180"
                required
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-hidden"
              />
            </div>
          </div>

          <div className="space-y-3">
            <DateTimePicker
              label="موعد فتح الاختبار (اختياري)"
              value={opensAt}
              onChange={setOpensAt}
            />

            <DateTimePicker
              label="موعد إغلاق الاختبار (اختياري)"
              value={closesAt}
              onChange={setClosesAt}
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="shuffleCheck"
              checked={shuffle}
              onChange={(e) => setShuffle(e.target.checked)}
              className="size-4 rounded text-[#1d5ca8]"
            />
            <label htmlFor="shuffleCheck" className="text-xs font-bold text-slate-700 cursor-pointer">
              خلط وترتيب الأسئلة والخيارات عشوائياً لكل طالب (للحد من الغش)
            </label>
          </div>

          {/* Question Selection Strategy */}
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <label className="block text-xs font-bold text-slate-700">طريقة اختيار الأسئلة:</label>
            <div className="flex gap-4 text-xs font-semibold">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="qMode"
                  checked={selectionMode === 'random'}
                  onChange={() => setSelectionMode('random')}
                />
                اختيار عشوائي من بنك الأسئلة
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="qMode"
                  checked={selectionMode === 'pick'}
                  onChange={() => setSelectionMode('pick')}
                />
                تحديد الأسئلة يدوياً
              </label>
            </div>

            {selectionMode === 'random' ? (
              <div className="mt-2 flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-xs">
                <span>عدد الأسئلة العشوائية المطلوبة:</span>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={randomCount}
                  onChange={(e) => setRandomCount(Number(e.target.value))}
                  className="w-20 rounded-lg border border-slate-200 bg-white p-1 text-center font-bold"
                />
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 p-2 text-xs space-y-1.5">
                {questions.map((q) => {
                  const isChecked = selectedQuestionIds.includes(q.id)
                  return (
                    <label
                      key={q.id}
                      className="flex items-start gap-2 rounded-lg p-1.5 hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedQuestionIds((prev) => [...prev, q.id])
                          } else {
                            setSelectedQuestionIds((prev) => prev.filter((id) => id !== q.id))
                          }
                        }}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-800">{q.body}</p>
                        <p className="text-[11px] text-slate-400">
                          {q.grade} · {q.marks} درجة
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          <div className="mt-5 flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={savingExam}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1d5ca8] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#164e93] disabled:opacity-50"
            >
              {savingExam && <Loader2 className="size-3.5 animate-spin" />}
              تأكيد ونشر الاختبار
            </button>
          </div>
        </form>
      </Modal>

      {/* QR Code Share Modal */}
      {activeShareExam && (
        <QRCodeModal
          isOpen={qrModalOpen}
          onClose={() => {
            setQrModalOpen(false)
            setActiveShareExam(null)
          }}
          title={activeShareExam.title}
          url={`${originUrl}/exam/${activeShareExam.public_token}`}
        />
      )}

      {/* Exam Results & Question Analysis Modal */}
      <Modal
        isOpen={resultsModalOpen}
        onClose={() => setResultsModalOpen(false)}
        title={`نتائج وتحليلات: ${selectedExamForResults?.title || ''}`}
        maxWidth="max-w-4xl"
      >
        <div className="space-y-6">
          {/* Summary Stats Bar */}
          <div className="grid grid-cols-3 gap-3 rounded-2xl bg-slate-50 p-4 text-center">
            <div>
              <p className="text-xs text-slate-400 font-bold">إجمالي التسليمات</p>
              <p className="mt-1 text-2xl font-black text-slate-800">{totalSubmissions}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold">متوسط درجات الطلاب</p>
              <p className="mt-1 text-2xl font-black text-[#1d5ca8]">{avgScore}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold">إعلان النتيجة للطلاب</p>
              <p className="mt-1 text-sm font-bold text-emerald-700">
                {selectedExamForResults?.results_released ? 'معلنة حالياً' : 'محجوبة'}
              </p>
            </div>
          </div>

          {loadingSubmissions ? (
            <div className="flex justify-center p-8 text-xs font-bold text-[#1d5ca8]">
              <Loader2 className="size-5 animate-spin" />
              جاري جلب إجابات الطلاب والتحليلات...
            </div>
          ) : (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-700">قائمة درجات الطلاب:</h4>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                    <tr>
                      <th className="p-3">اسم الطالب</th>
                      <th className="p-3">الدرجة</th>
                      <th className="p-3">النسبة</th>
                      <th className="p-3">وقت التسليم</th>
                      <th className="p-3 text-center">إجراءات والتصحيح</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {submissionsList.map((sub) => {
                      const perc = Math.round((sub.score / (sub.max_score || 1)) * 100)
                      return (
                        <tr key={sub.id} className="hover:bg-slate-50/80">
                          <td className="p-3 font-bold text-slate-800">{sub.student_name}</td>
                          <td className="p-3 font-bold">
                            {sub.score} / {sub.max_score}
                          </td>
                          <td className="p-3 font-semibold">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                perc >= 85
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : perc >= 60
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              {perc}%
                            </span>
                          </td>
                          <td className="p-3 text-slate-500">
                            {new Date(sub.submitted_at).toLocaleTimeString('ar-EG', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenGrading(sub)}
                                className="inline-flex items-center gap-1 rounded-xl bg-[#1d5ca8] px-2.5 py-1.5 text-xs font-bold text-white hover:bg-[#164e93] shadow-xs"
                              >
                                <Edit3 className="size-3.5" />
                                <span>مراجعة وتصحيح</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleSendResultWhatsApp(sub, selectedExamForResults?.title || '')
                                }
                                className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs"
                              >
                                <MessageCircle className="size-3.5" />
                                <span>واتساب</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}

                    {submissionsList.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-400">
                          لم يقم أي طالب بتسليم هذا الاختبار حتى الآن
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Print PDF Paper Exam Modal */}
      <Modal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        title="معاينة وطباعة ورقة الاختبار (تصدير PDF)"
        maxWidth="max-w-4xl"
      >
        {printExam && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-blue-50 p-4 border border-blue-200 text-xs text-[#153b68] print:hidden">
              <div>
                <p className="font-bold">
                  💡 يمكنك طباعة ورقة الاختبار أو حفظها كملف PDF قابل للطباعة والتوزيع على الطلاب.
                </p>
                <p className="mt-0.5 text-slate-500">
                  عند فتح نافذة الطباعة، اختر الوجهة <strong>"حفظ بتنسيق PDF (Save as PDF)"</strong> لتنزيل الورقة مباشرة.
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1d5ca8] px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#164e93] transition active:scale-95"
              >
                <Printer className="size-4" />
                <span>طباعة ورقة الاختبار (Print / PDF)</span>
              </button>
            </div>

            {/* Printable Paper Exam Container */}
            <div
              id="printable-exam-sheet"
              className="rounded-2xl border border-slate-300 bg-white p-6 sm:p-10 text-slate-900 shadow-sm print:m-0 print:border-none print:p-0 print:shadow-none"
            >
              {/* Official Exam Header */}
              <div className="border-b-2 border-slate-800 pb-4">
                <div className="flex items-start justify-between">
                  <div className="text-right text-xs font-bold space-y-1">
                    <p>جمهورية مصر العربية</p>
                    <p>إدارة التعليم الخاص والتفوق</p>
                    <p>المعلم: {teacherName}</p>
                  </div>

                  <div className="text-center">
                    <h2 className="text-lg sm:text-xl font-black text-slate-900">
                      {printExam.title}
                    </h2>
                    <p className="mt-1 text-xs font-bold text-slate-600">
                      {printExam.grade || 'المرحلة الدراسية'} • العام الدراسي ٢٠٢٥ / ٢٠٢٦
                    </p>
                  </div>

                  <div className="text-left text-xs font-bold space-y-1" dir="ltr">
                    <p>الزمن: {printExam.duration_min} دقيقة</p>
                    <p>الدرجة الكلية: {printExam.question_ids.length * 2} درجة</p>
                  </div>
                </div>

                {/* Student Details Box */}
                <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-slate-400 p-3 text-xs font-bold">
                  <div>
                    <span>اسم الطالب: </span>
                    <span className="text-slate-400 font-normal">....................................................................</span>
                  </div>
                  <div>
                    <span>المجموعة: </span>
                    <span className="text-slate-400 font-normal">....................................................</span>
                  </div>
                  <div>
                    <span>تاريخ الاختبار: </span>
                    <span className="text-slate-400 font-normal">...... / ...... / ٢٠٢...</span>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <span>الدرجة المستحقة: </span>
                    <span className="inline-block w-16 border-b border-black text-center">/</span>
                  </div>
                </div>
              </div>

              {/* Exam Questions */}
              <div className="mt-6 space-y-6">
                {questions
                  .filter((q) => printExam.question_ids.includes(q.id))
                  .map((q, idx) => (
                    <div key={q.id} className="break-inside-avoid border-b border-slate-100 pb-5">
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="text-sm font-bold text-slate-900 leading-relaxed">
                          <span className="ml-1.5 font-black text-slate-950">س {idx + 1}:</span>
                          {q.body}
                        </h4>
                        <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                          ({q.marks || 1} درجات)
                        </span>
                      </div>

                      {/* Optional Question Image */}
                      {q.image_path && (
                        <div className="mt-3 flex justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={q.image_path}
                            alt={`سؤال ${idx + 1}`}
                            className="max-h-48 w-auto rounded-lg border border-slate-200 object-contain"
                          />
                        </div>
                      )}

                      {/* Question Content: MCQ vs Essay */}
                      {q.type === 'essay' ? (
                        <div className="mt-4 space-y-3 pl-2">
                          <p className="text-[11px] font-bold text-slate-400">إجابة السؤال (أجب في المساحة المخصصة موضحاً خطوات الحل):</p>
                          <div className="space-y-3.5 border-r-2 border-slate-200 pr-3">
                            <div className="border-b border-dashed border-slate-300 h-5" />
                            <div className="border-b border-dashed border-slate-300 h-5" />
                            <div className="border-b border-dashed border-slate-300 h-5" />
                            <div className="border-b border-dashed border-slate-300 h-5" />
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {q.options?.map((opt, oIdx) => {
                            const letters = ['أ', 'ب', 'ج', 'د', 'هـ']
                            return (
                              <div
                                key={oIdx}
                                className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 font-medium"
                              >
                                <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-slate-400 text-[10px] font-bold">
                                  {letters[oIdx] || oIdx + 1}
                                </span>
                                <span>{opt}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}
              </div>

              {/* Paper Footer */}
              <div className="mt-8 border-t-2 border-slate-800 pt-4 text-center text-xs font-bold text-slate-700">
                <p>« مع أطيب التمنيات لجميع أبنائنا وبناتنا الطلاب بدوام التفوق والنجاح »</p>
                <p className="mt-1 text-[11px] text-slate-500">مع تحيات: {teacherName}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Manual Grading & Submission Review Modal */}
      <Modal
        isOpen={gradingModalOpen}
        onClose={() => {
          setGradingModalOpen(false)
          setGradingSubmission(null)
          setGradingData(null)
        }}
        title={`مراجعة وتصحيح إجابات الطالب: ${gradingSubmission?.student_name || ''}`}
        maxWidth="max-w-3xl"
      >
        {loadingGrading ? (
          <div className="flex flex-col items-center justify-center p-12 text-xs font-bold text-[#1d5ca8]">
            <Loader2 className="size-6 animate-spin" />
            <p className="mt-2">جاري تحميل إجابات وورقة الطالب...</p>
          </div>
        ) : gradingData ? (
          <div className="space-y-6">
            {/* Student Summary Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4 border border-slate-200 text-xs">
              <div>
                <p className="text-slate-400 font-bold">الطالب:</p>
                <h3 className="text-base font-black text-slate-900">
                  {gradingData.submission?.student?.full_name}
                </h3>
              </div>
              <div>
                <p className="text-slate-400 font-bold">المرحلة:</p>
                <p className="font-bold text-slate-700">
                  {gradingData.submission?.student?.grade || 'غير محدد'}
                </p>
              </div>
              <div>
                <p className="text-slate-400 font-bold">الدرجة الإجمالية الحالية:</p>
                <p className="text-lg font-black text-[#1d5ca8]">
                  {gradingData.submission?.score} / {gradingData.submission?.max_score}
                </p>
              </div>
            </div>

            {/* Questions List with Answers & Grading */}
            <div className="space-y-4">
              {gradingData.questions?.map((q: any, idx: number) => {
                const studentAns = q.student_answer
                const isEssay = q.type === 'essay'
                const paperPhotos: string[] = studentAns?.paper_photos || []

                return (
                  <div
                    key={q.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-black text-slate-700">
                          سؤال {idx + 1}
                        </span>
                        <span
                          className={`rounded-lg px-2 py-0.5 text-[11px] font-bold ${
                            isEssay ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-[#1d5ca8]'
                          }`}
                        >
                          {isEssay ? 'سؤال مقالي' : 'اختيار من متعدد'}
                        </span>
                      </div>

                      <span className="text-xs font-bold text-slate-500">
                        الدرجة القصوى: {q.marks}
                      </span>
                    </div>

                    {/* Question Body */}
                    <p className="text-sm font-bold text-slate-900 leading-relaxed">{q.body}</p>

                    {/* Question Image */}
                    {q.image_path && (
                      <div className="flex justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={q.image_path}
                          alt="سؤال"
                          className="max-h-36 rounded-lg border object-contain"
                        />
                      </div>
                    )}

                    {/* MCQ Case */}
                    {!isEssay && (
                      <div className="rounded-xl bg-slate-50 p-3 text-xs space-y-1.5">
                        <p className="font-bold text-slate-700">إجابة الطالب:</p>
                        <div className="flex items-center gap-2">
                          {q.is_correct ? (
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                              <CheckCircle2 className="size-4" />
                              <span>
                                صحيحة: {q.options?.[studentAns?.selected_index] || 'الخيار المحدد'}
                              </span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-bold text-rose-600">
                              <XCircle className="size-4" />
                              <span>
                                خاطئة: {q.options?.[studentAns?.selected_index] || 'إجابة غير صحيحة'} (الإجابة الصحيحة: {q.options?.[q.correct?.[0]]})
                              </span>
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400">
                          الدرجة المرصودة آلياً: {q.marks_awarded} من {q.marks}
                        </p>
                      </div>
                    )}

                    {/* Essay Case */}
                    {isEssay && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5 text-xs space-y-3">
                        {/* Written Text Answer */}
                        <div>
                          <p className="font-bold text-slate-800">إجابة الطالب المكتوبة (نصياً):</p>
                          <p className="mt-1 rounded-lg bg-white p-2.5 text-slate-900 border border-amber-200/80 whitespace-pre-wrap font-medium">
                            {studentAns?.text || studentAns?.essay || 'لم يكتب إجابة نصية'}
                          </p>
                        </div>

                        {/* Uploaded Handwritten Paper Photos */}
                        {paperPhotos.length > 0 && (
                          <div>
                            <p className="font-bold text-slate-800">صور ورقة الإجابة المرفوعة من الطالب ({paperPhotos.length} صورة):</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {paperPhotos.map((photoUrl, pIdx) => (
                                <div
                                  key={pIdx}
                                  onClick={() => setPreviewZoomImage(photoUrl)}
                                  className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-300 bg-black/5"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={photoUrl}
                                    alt={`ورقة ${pIdx + 1}`}
                                    className="h-24 w-24 object-cover transition group-hover:scale-105"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition">
                                    <ZoomIn className="size-4 text-white" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Teacher Grading Inputs */}
                        <div className="rounded-xl bg-white p-3 border border-amber-200 space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <label className="font-bold text-slate-800">
                              رصد درجة السؤال المقالي:
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                max={q.marks}
                                value={awardedMarksMap[q.id] ?? 0}
                                onChange={(e) =>
                                  setAwardedMarksMap((prev) => ({
                                    ...prev,
                                    [q.id]: Number(e.target.value),
                                  }))
                                }
                                className="w-16 rounded-lg border border-slate-300 p-1.5 text-center font-bold text-sm outline-hidden focus:border-[#1d5ca8]"
                              />
                              <span className="font-bold text-slate-600">من {q.marks} درجة</span>
                            </div>
                          </div>

                          <div>
                            <input
                              type="text"
                              placeholder="ملاحظات أو تعليق للطالب على الإجابة (اختياري)..."
                              value={feedbackMap[q.id] || ''}
                              onChange={(e) =>
                                setFeedbackMap((prev) => ({
                                  ...prev,
                                  [q.id]: e.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-slate-200 p-2 text-xs outline-hidden focus:border-[#1d5ca8]"
                            />
                          </div>

                          <div className="flex justify-end pt-1">
                            <button
                              type="button"
                              disabled={savingGradeId === q.id}
                              onClick={() => handleSaveQuestionGrade(q.id)}
                              className="inline-flex items-center gap-1 rounded-xl bg-[#1d5ca8] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#164e93] disabled:opacity-50"
                            >
                              {savingGradeId === q.id ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="size-3.5" />
                              )}
                              <span>اعتماد وحفظ درجة هذا السؤال</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Paper Zoom Preview Modal */}
      <Modal
        isOpen={Boolean(previewZoomImage)}
        onClose={() => setPreviewZoomImage(null)}
        title="معاينة ورقة إجابة الطالب بالحجم الكامل"
        maxWidth="max-w-4xl"
      >
        {previewZoomImage && (
          <div className="flex justify-center p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewZoomImage}
              alt="ورقة إجابة الطالب"
              className="max-h-[75vh] w-auto rounded-xl object-contain shadow-md"
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
