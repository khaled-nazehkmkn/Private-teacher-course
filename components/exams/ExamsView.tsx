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
  BookMarked,
  Layers,
  Minus,
  RotateCcw,
  Search,
  Check,
  Sparkles,
} from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { DateTimePicker } from '@/components/ui/datetime-picker'
import { QRCodeModal } from '@/components/QRCodeModal'
import { buildWhatsAppLink, formatExamResultMessage } from '@/lib/whatsapp'
import { MathRenderer, cleanGeminiArtifacts, extractLessonFromTopic } from '@/components/ui/math-renderer'
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
  started_at?: string
  submitted_at: string | null
  termination_reason?: string | null
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
  onDeleteSubmission?: (submissionId: string) => Promise<void>
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
  onDeleteSubmission,
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
  const [deletingSubmissionId, setDeletingSubmissionId] = useState<string | null>(null)

  // AI Auto-Grading & Report State
  const [isAiGrading, setIsAiGrading] = useState(false)
  const [aiGradeSuccess, setAiGradeSuccess] = useState<string | null>(null)
  const [aiTeacherReport, setAiTeacherReport] = useState<any | null>(null)
  const [reportModalOpen, setReportModalOpen] = useState(false)

  // Create Form State
  const [title, setTitle] = useState('')
  const [targetGroupId, setTargetGroupId] = useState<string>('')
  const [durationMin, setDurationMin] = useState(30)
  const [opensAt, setOpensAt] = useState('')
  const [closesAt, setClosesAt] = useState('')
  const [shuffle, setShuffle] = useState(true)
  const [selectionMode, setSelectionMode] = useState<'pick' | 'random'>('random')
  const [randomStrategy, setRandomStrategy] = useState<'by_lesson' | 'all'>('by_lesson')
  const [randomCount, setRandomCount] = useState(10)
  const [lessonCounts, setLessonCounts] = useState<Record<string, number>>({})
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([])
  const [manualPickLessonFilter, setManualPickLessonFilter] = useState('all')
  const [savingExam, setSavingExam] = useState(false)

  // Compute matching questions for currently selected group or grade
  const targetGroup = groups.find((g) => g.id === targetGroupId)
  const matchingQuestions = React.useMemo(() => {
    if (!targetGroup) return questions
    return questions.filter((q) => {
      const matchesGroup = q.topic && q.topic.includes(targetGroup.name)
      const matchesGrade =
        q.grade === targetGroup.grade ||
        q.grade === targetGroup.name ||
        (q.grade && targetGroup.grade && q.grade.trim() === targetGroup.grade.trim())
      return matchesGroup || matchesGrade
    })
  }, [questions, targetGroup])

  // Group matching questions by lesson
  const availableLessonGroups = React.useMemo(() => {
    const pool = matchingQuestions.length > 0 ? matchingQuestions : questions
    const map: Record<string, QuestionBankItem[]> = {}

    pool.forEach((q) => {
      const lessonName = q.lesson || extractLessonFromTopic(q.topic) || 'عام / بدون درس محدد'
      if (!map[lessonName]) {
        map[lessonName] = []
      }
      map[lessonName].push(q)
    })

    return map
  }, [matchingQuestions, questions])

  // New states for smart random by lesson & question type breakdown
  const [selectedLessons, setSelectedLessons] = useState<string[]>([])
  const [totalQuestionsCount, setTotalQuestionsCount] = useState(15)
  const [choiceCount, setChoiceCount] = useState(10)
  const [essayCount, setEssayCount] = useState(5)
  const [showAdvancedLessonStepper, setShowAdvancedLessonStepper] = useState(false)
  const [manualPickTypeFilter, setManualPickTypeFilter] = useState<'all' | 'mcq' | 'essay'>('all')
  const [manualPickSearch, setManualPickSearch] = useState('')

  const availableLessonNames = React.useMemo(() => {
    return Object.keys(availableLessonGroups)
  }, [availableLessonGroups])

  // Auto-select all available lessons and set sensible defaults on modal open or group change
  React.useEffect(() => {
    if (createModalOpen) {
      setSelectedLessons(availableLessonNames)
      const pool = matchingQuestions.length > 0 ? matchingQuestions : questions
      const maxTotal = pool.length
      const defTotal = Math.min(15, Math.max(1, maxTotal))
      setTotalQuestionsCount(defTotal)
      const mcqs = pool.filter((q) => q.type !== 'essay').length
      const essays = pool.filter((q) => q.type === 'essay').length
      if (essays === 0) {
        setChoiceCount(defTotal)
        setEssayCount(0)
      } else {
        const targetChoice = Math.min(mcqs, Math.max(0, defTotal - Math.min(essays, 5)))
        setChoiceCount(targetChoice)
        setEssayCount(Math.max(0, defTotal - targetChoice))
      }
    }
  }, [createModalOpen, targetGroupId, availableLessonNames])

  // Selected lessons question pools
  const selectedLessonsPool = React.useMemo(() => {
    const pool = matchingQuestions.length > 0 ? matchingQuestions : questions
    if (selectedLessons.length === 0) return []
    return pool.filter((q) => {
      const l = q.lesson || extractLessonFromTopic(q.topic) || 'عام / بدون درس محدد'
      return selectedLessons.includes(l)
    })
  }, [matchingQuestions, questions, selectedLessons])

  const availableMcqsInSelectedLessons = React.useMemo(() => {
    return selectedLessonsPool.filter((q) => q.type !== 'essay')
  }, [selectedLessonsPool])

  const availableEssaysInSelectedLessons = React.useMemo(() => {
    return selectedLessonsPool.filter((q) => q.type === 'essay')
  }, [selectedLessonsPool])

  const handleTotalQuestionsChange = (val: number) => {
    const newTotal = Math.max(1, val)
    setTotalQuestionsCount(newTotal)
    if (choiceCount > newTotal) {
      setChoiceCount(newTotal)
      setEssayCount(0)
    } else {
      setEssayCount(newTotal - choiceCount)
    }
  }

  const handleChoiceCountChange = (val: number) => {
    const newChoice = Math.max(0, val)
    setChoiceCount(newChoice)
    if (newChoice <= totalQuestionsCount) {
      setEssayCount(totalQuestionsCount - newChoice)
    }
  }

  const handleEssayCountChange = (val: number) => {
    const newEssay = Math.max(0, val)
    setEssayCount(newEssay)
    if (newEssay <= totalQuestionsCount) {
      setChoiceCount(totalQuestionsCount - newEssay)
    }
  }

  const handleSetPreset = (preset: 'all_mcq' | 'all_essay' | 'balanced') => {
    if (preset === 'all_mcq') {
      setChoiceCount(totalQuestionsCount)
      setEssayCount(0)
    } else if (preset === 'all_essay') {
      setChoiceCount(0)
      setEssayCount(totalQuestionsCount)
    } else if (preset === 'balanced') {
      const halfChoice = Math.ceil(totalQuestionsCount / 2)
      setChoiceCount(halfChoice)
      setEssayCount(totalQuestionsCount - halfChoice)
    }
  }

  const handleToggleLesson = (lessonName: string) => {
    setSelectedLessons((prev) =>
      prev.includes(lessonName) ? prev.filter((l) => l !== lessonName) : [...prev, lessonName]
    )
  }

  const handleSelectAllLessons = () => {
    setSelectedLessons(availableLessonNames)
  }

  const handleDeselectAllLessons = () => {
    setSelectedLessons([])
  }

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

  const handleDeleteStudentSubmission = async (sub: ExamSubmissionDetail) => {
    if (!onDeleteSubmission) return
    const confirmed = confirm(
      `هل أنت متأكد من حذف سجل الطالب "${sub.student_name}" في هذا الاختبار؟\nسيتم مسح إجاباته ودرجته الحالية وسيتمكن من دخول الاختبار مرة أخرى بكوده.`
    )
    if (!confirmed) return

    setDeletingSubmissionId(sub.id)
    try {
      await onDeleteSubmission(sub.id)
      setSubmissionsList((prev) => prev.filter((item) => item.id !== sub.id))
    } catch (err: any) {
      console.error('Error deleting submission:', err)
      alert(err?.message || 'فشل حذف سجل الطالب')
    } finally {
      setDeletingSubmissionId(null)
    }
  }

  // Handle AI Auto-Grading & Report Generation
  const handleAiGradeExam = async () => {
    if (!selectedExamForResults) return
    if (!teacherStatus.isActive) {
      alert('حسابك غير نشط حالياً أو في وضع القراءة فقط.')
      return
    }

    setIsAiGrading(true)
    setAiGradeSuccess(null)
    try {
      const res = await fetch('/api/exam/ai-grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exam_id: selectedExamForResults.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'فشل إجراء التصحيح الذكي')
      }

      // Refresh submissions list
      const updatedSubs = await onFetchExamSubmissions(selectedExamForResults.id)
      setSubmissionsList(updatedSubs)

      if (data.report) {
        setAiTeacherReport(data.report)
        setReportModalOpen(true)
      }

      setAiGradeSuccess(
        `تم التصحيح الذكي بنجاح لـ ${data.graded_count || updatedSubs.length} من الطلاب وتحديث الدرجات! ✨`
      )
      setTimeout(() => setAiGradeSuccess(null), 6000)
    } catch (err: any) {
      console.error('Error in AI grading:', err)
      alert(err.message || 'حدث خطأ أثناء التصحيح الذكي')
    } finally {
      setIsAiGrading(false)
    }
  }

  // Handle Create Exam
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    let finalQuestionIds = [...selectedQuestionIds]

    if (selectionMode === 'random') {
      if (showAdvancedLessonStepper && randomStrategy === 'by_lesson') {
        const pickedIds: string[] = []
        Object.entries(availableLessonGroups).forEach(([lessonName, qList]) => {
          const count = lessonCounts[lessonName] || 0
          if (count > 0) {
            const shuffled = [...qList].sort(() => Math.random() - 0.5)
            const chosen = shuffled.slice(0, Math.min(count, qList.length)).map((q) => q.id)
            pickedIds.push(...chosen)
          }
        })

        if (pickedIds.length === 0) {
          alert('يرجى تحديد عدد الأسئلة المطلوبة من درس واحد على الأقل.')
          return
        }

        finalQuestionIds = pickedIds
      } else {
        // Smart Selection by Lessons and Types Breakdown
        if (selectedLessons.length === 0) {
          alert('يرجى تحديد درس واحد على الأقل من قائمة الدروس المتاحة.')
          return
        }

        if (totalQuestionsCount <= 0) {
          alert('يرجى إدخال إجمالي عدد أسئلة صحيح (أكبر من صفر).')
          return
        }

        const currentSum = choiceCount + essayCount
        if (currentSum !== totalQuestionsCount) {
          alert(
            `مجموع أسئلة الاختيار (${choiceCount}) والأسئلة المقالية (${essayCount}) يساوي ${currentSum} سؤال، ولا يطابق إجمالي عدد الأسئلة المطلوب (${totalQuestionsCount} سؤال).\nيرجى تعديل الأعداد لتتطابق مع الإجمالي.`
          )
          return
        }

        const availMcq = availableMcqsInSelectedLessons.length
        const availEssay = availableEssaysInSelectedLessons.length

        if (choiceCount > availMcq || essayCount > availEssay) {
          const proceed = confirm(
            `تنبيه حول توفر الأسئلة في الدروس المحددة:\n` +
            (choiceCount > availMcq ? `- أسئلة الاختيار من متعدد: مطلوب ${choiceCount} بينما المتوفر ${availMcq} فقط.\n` : '') +
            (essayCount > availEssay ? `- الأسئلة المقالية: مطلوب ${essayCount} بينما المتوفر ${availEssay} فقط.\n` : '') +
            `\nهل تريد المتابعة وسحب أقصى عدد متاح (${Math.min(choiceCount, availMcq) + Math.min(essayCount, availEssay)} سؤال)؟`
          )
          if (!proceed) return
        }

        // Balanced round-robin sampling across selected lessons
        const pickBalanced = (pool: QuestionBankItem[], count: number): string[] => {
          if (count <= 0 || pool.length === 0) return []
          if (count >= pool.length) return pool.map((q) => q.id)

          const byLesson: Record<string, QuestionBankItem[]> = {}
          pool.forEach((q) => {
            const l = q.lesson || extractLessonFromTopic(q.topic) || 'عام'
            if (!byLesson[l]) byLesson[l] = []
            byLesson[l].push(q)
          })

          Object.keys(byLesson).forEach((l) => {
            byLesson[l].sort(() => Math.random() - 0.5)
          })

          const lessonKeys = Object.keys(byLesson).sort(() => Math.random() - 0.5)
          const picked: QuestionBankItem[] = []

          while (picked.length < count) {
            let added = false
            for (const key of lessonKeys) {
              if (byLesson[key].length > 0 && picked.length < count) {
                picked.push(byLesson[key].pop()!)
                added = true
              }
            }
            if (!added) break
          }

          return picked.map((q) => q.id)
        }

        const pickedMcqIds = pickBalanced(availableMcqsInSelectedLessons, choiceCount)
        const pickedEssayIds = pickBalanced(availableEssaysInSelectedLessons, essayCount)

        finalQuestionIds = [...pickedMcqIds, ...pickedEssayIds]
      }

      if (shuffle) {
        finalQuestionIds = [...finalQuestionIds].sort(() => Math.random() - 0.5)
      }
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
      setLessonCounts({})
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
    <div className="min-w-0 space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h2 className="text-xl font-extrabold text-[#153b68]">الاختبارات والتقييمات</h2>
          <p className="text-xs text-slate-500">
            إنشاء الاختبارات، توليد روابط ورموز QR للطلاب، وتصحيح الإجابات تلقائياً
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          disabled={!teacherStatus.isActive}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1d5ca8] px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#164e93] disabled:opacity-50"
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
              className="flex min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs transition hover:border-[#1d5ca8]/40"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="max-w-full break-words rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                    {grp?.name || exam.grade || 'عام'}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
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

                <h3 className="mt-3 break-words text-base font-extrabold text-slate-800">{exam.title}</h3>

                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
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
              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <button
                  onClick={() => handleOpenResults(exam)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1d5ca8] hover:underline"
                >
                  <BarChart3 className="size-4" />
                  <span>سجل الطلاب والنتائج (History)</span>
                </button>

                <div className="flex flex-wrap items-center gap-2">
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
        maxWidth="max-w-3xl"
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
              <div className="space-y-4 pt-1">
                {/* Step 1: Select Lessons */}
                <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-3.5 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-blue-100">
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#153b68] text-xs font-bold text-white">
                        1
                      </span>
                      <div>
                        <p className="text-xs font-extrabold text-[#153b68]">
                          اختر الدروس المطلوب سحب الأسئلة منها:
                        </p>
                        <p className="text-[11px] text-blue-700">
                          حدد درساً واحداً أو عدة دروس لتشملها أسئلة الاختبار عشوائياً.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto text-xs">
                      <button
                        type="button"
                        onClick={handleSelectAllLessons}
                        className="font-bold text-[#1d5ca8] hover:underline"
                      >
                        تحديد كل الدروس ({availableLessonNames.length})
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={handleDeselectAllLessons}
                        className="font-bold text-rose-600 hover:underline"
                      >
                        إلغاء التحديد
                      </button>
                    </div>
                  </div>

                  {availableLessonNames.length === 0 ? (
                    <p className="text-center py-4 text-xs font-bold text-slate-400">
                      لا توجد أسئلة مسجلة لهذه المرحلة في بنك الأسئلة حالياً.
                    </p>
                  ) : (
                    <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                      {availableLessonNames.map((lessonName) => {
                        const qList = availableLessonGroups[lessonName] || []
                        const mcqCount = qList.filter((q) => q.type !== 'essay').length
                        const essayCount = qList.filter((q) => q.type === 'essay').length
                        const isSelected = selectedLessons.includes(lessonName)

                        return (
                          <div
                            key={lessonName}
                            onClick={() => handleToggleLesson(lessonName)}
                            className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 transition cursor-pointer select-none ${
                              isSelected
                                ? 'border-[#1d5ca8] bg-white shadow-xs ring-1 ring-[#1d5ca8]/20'
                                : 'border-slate-200/80 bg-white/60 hover:bg-white text-slate-500'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="size-4 rounded text-[#1d5ca8]"
                              />
                              <div className="min-w-0">
                                <span className={`text-xs font-bold truncate block ${isSelected ? 'text-slate-800' : 'text-slate-600'}`}>
                                  {lessonName}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-semibold">
                              <span className="rounded bg-blue-50 text-[#1d5ca8] px-1.5 py-0.5 border border-blue-100">
                                {mcqCount} اختيار
                              </span>
                              <span className="rounded bg-amber-50 text-amber-800 px-1.5 py-0.5 border border-amber-100">
                                {essayCount} مقالي
                              </span>
                              <span className="rounded bg-slate-100 text-slate-600 px-1.5 py-0.5">
                                إجمالي {qList.length}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Pool summary badge */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-xl bg-blue-100/70 px-3 py-2 text-xs font-bold text-[#153b68]">
                    <span>إجمالي المتوفر في الدروس المحددة ({selectedLessons.length} دروس):</span>
                    <span className="rounded-lg bg-[#1d5ca8] px-2.5 py-0.5 text-white">
                      {availableMcqsInSelectedLessons.length} اختيار + {availableEssaysInSelectedLessons.length} مقالي = {selectedLessonsPool.length} سؤال متاح
                    </span>
                  </div>
                </div>

                {/* Step 2: Total Amount of Questions */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#153b68] text-xs font-bold text-white">
                      2
                    </span>
                    <div>
                      <label className="text-xs font-extrabold text-[#153b68]">
                        إجمالي عدد الأسئلة المطلوب للاختبار:
                      </label>
                      <p className="text-[11px] text-slate-500">
                        العدد الكلي للأسئلة التي سيحتويها الاختبار للطالب.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <input
                      type="number"
                      min="1"
                      max={Math.max(100, selectedLessonsPool.length)}
                      value={totalQuestionsCount}
                      onChange={(e) => handleTotalQuestionsChange(Number(e.target.value))}
                      className="w-28 rounded-xl border border-slate-200 bg-white p-2.5 text-center text-sm font-black text-[#153b68] shadow-xs outline-hidden focus:border-[#1d5ca8]"
                    />
                    <span className="text-xs font-bold text-slate-700">سؤال</span>
                    <span className="text-[11px] text-slate-400">
                      (الحد الأقصى المتاح في الدروس المحددة: {selectedLessonsPool.length} سؤال)
                    </span>
                  </div>
                </div>

                {/* Step 3: Breakdown by Question Type */}
                <div className="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-3 shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#153b68] text-xs font-bold text-white">
                      3
                    </span>
                    <div>
                      <p className="text-xs font-extrabold text-[#153b68]">
                        تحديد أنواع الأسئلة (اختيار من متعدد vs مقالي):
                      </p>
                      <p className="text-[11px] text-slate-500">
                        حدد كم سؤال اختيار وكم سؤال مقالي بحيث يكون المجموع مساوياً لإجمالي الأسئلة المحدد أعلاه ({totalQuestionsCount} سؤال).
                      </p>
                    </div>
                  </div>

                  {/* Choice vs Essay Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* MCQ / Choice */}
                    <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-blue-950">
                          أسئلة الاختيار من متعدد:
                        </label>
                        <span className="rounded bg-blue-100 text-[#1d5ca8] px-2 py-0.5 text-[10px] font-bold">
                          تصحيح تلقائي
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max={totalQuestionsCount}
                          value={choiceCount}
                          onChange={(e) => handleChoiceCountChange(Number(e.target.value))}
                          className="w-24 rounded-lg border border-blue-300 bg-white p-2 text-center text-sm font-black text-slate-800 outline-hidden focus:border-[#1d5ca8]"
                        />
                        <span className="text-xs font-semibold text-slate-600">سؤال اختيار</span>
                      </div>
                      <p className="text-[11px] text-blue-700">
                        المتوفر في الدروس المحددة: {availableMcqsInSelectedLessons.length} سؤال
                      </p>
                      {choiceCount > availableMcqsInSelectedLessons.length && (
                        <p className="text-[10px] font-bold text-rose-600">
                          ⚠️ العدد المطلوب ({choiceCount}) يتجاوز المتوفر ({availableMcqsInSelectedLessons.length}).
                        </p>
                      )}
                    </div>

                    {/* Essay */}
                    <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-amber-950">
                          الأسئلة المقالية والمسائل:
                        </label>
                        <span className="rounded bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-bold">
                          تصحيح يدوي / ورقي
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max={totalQuestionsCount}
                          value={essayCount}
                          onChange={(e) => handleEssayCountChange(Number(e.target.value))}
                          className="w-24 rounded-lg border border-amber-300 bg-white p-2 text-center text-sm font-black text-slate-800 outline-hidden focus:border-amber-500"
                        />
                        <span className="text-xs font-semibold text-slate-600">سؤال مقالي</span>
                      </div>
                      <p className="text-[11px] text-amber-700">
                        المتوفر في الدروس المحددة: {availableEssaysInSelectedLessons.length} سؤال
                      </p>
                      {essayCount > availableEssaysInSelectedLessons.length && (
                        <p className="text-[10px] font-bold text-rose-600">
                          ⚠️ العدد المطلوب ({essayCount}) يتجاوز المتوفر ({availableEssaysInSelectedLessons.length}).
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Quick Presets */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                    <span className="text-[11px] font-bold text-slate-400">توزيعات سريعة:</span>
                    <button
                      type="button"
                      onClick={() => handleSetPreset('all_mcq')}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                    >
                      كلها اختيار من متعدد ({totalQuestionsCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetPreset('all_essay')}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                    >
                      كلها مقالي ({totalQuestionsCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetPreset('balanced')}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                    >
                      مناصفة متوازنة ({Math.ceil(totalQuestionsCount / 2)} اختيار + {Math.floor(totalQuestionsCount / 2)} مقالي)
                    </button>
                  </div>

                  {/* Validation Indicator Bar */}
                  {choiceCount + essayCount === totalQuestionsCount ? (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
                      <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                      <span>
                        المجموع مطابق تماماً لإجمالي الأسئلة: {choiceCount} اختيار من متعدد + {essayCount} مقالي = {totalQuestionsCount} سؤال إجمالي ✓
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="size-4 text-amber-600 shrink-0" />
                        <span>
                          المجموع الحالي ({choiceCount} اختيار + {essayCount} مقالي = {choiceCount + essayCount}) لا يطابق الإجمالي المطلوب ({totalQuestionsCount})
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setEssayCount(Math.max(0, totalQuestionsCount - choiceCount))}
                          className="rounded-lg bg-amber-600 px-2 py-1 text-[11px] text-white hover:bg-amber-700"
                        >
                          تعديل المقالي ليصبح {Math.max(0, totalQuestionsCount - choiceCount)}
                        </button>
                        <button
                          type="button"
                          onClick={() => setTotalQuestionsCount(choiceCount + essayCount)}
                          className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-[11px] text-amber-900 hover:bg-amber-100"
                        >
                          تعديل الإجمالي ليصبح {choiceCount + essayCount}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Optional toggle for legacy granular per-lesson count stepper */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedLessonStepper((prev) => !prev)}
                    className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                  >
                    <span>{showAdvancedLessonStepper ? '▲ إخفاء التوزيع المخصص لكل درس على حدة' : '⚙️ أو تحديد عدد مخصص لكل درس على حدة (خيارات متقدمة)'}</span>
                  </button>

                  {showAdvancedLessonStepper && (
                    <div className="mt-2 space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-bold text-slate-700">
                        تحديد عدد الأسئلة من كل درس بشكل يدوي منفصل:
                      </p>
                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                        {availableLessonNames.map((lessonName) => {
                          const qList = availableLessonGroups[lessonName] || []
                          const count = lessonCounts[lessonName] || 0
                          const max = qList.length
                          return (
                            <div
                              key={lessonName}
                              className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2 text-xs"
                            >
                              <span className="font-bold text-slate-800 truncate flex-1">{lessonName}</span>
                              <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setLessonCounts((prev) => ({
                                      ...prev,
                                      [lessonName]: Math.max(0, (prev[lessonName] || 0) - 1),
                                    }))
                                  }
                                  className="px-2 py-0.5 text-xs font-bold hover:bg-slate-200"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  max={max}
                                  value={count}
                                  onChange={(e) => {
                                    const val = Math.max(0, Math.min(max, Number(e.target.value) || 0))
                                    setLessonCounts((prev) => ({ ...prev, [lessonName]: val }))
                                  }}
                                  className="w-10 text-center font-bold outline-hidden bg-white py-0.5"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setLessonCounts((prev) => ({
                                      ...prev,
                                      [lessonName]: Math.min(max, (prev[lessonName] || 0) + 1),
                                    }))
                                  }
                                  className="px-2 py-0.5 text-xs font-bold hover:bg-slate-200"
                                >
                                  +
                                </button>
                              </div>
                              <span className="text-[10px] text-slate-400 font-semibold w-12 text-left">
                                من {max}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {/* Manual Pick Controls: Filters & Search */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Lesson Filter */}
                    <select
                      value={manualPickLessonFilter}
                      onChange={(e) => setManualPickLessonFilter(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-hidden"
                    >
                      <option value="all">كل الدروس ({availableLessonNames.length})</option>
                      {availableLessonNames.map((l) => (
                        <option key={l} value={l}>
                          {l} ({availableLessonGroups[l]?.length})
                        </option>
                      ))}
                    </select>

                    {/* Question Type Filter */}
                    <div className="flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => setManualPickTypeFilter('all')}
                        className={`rounded-md px-2 py-0.5 transition ${
                          manualPickTypeFilter === 'all'
                            ? 'bg-white text-[#1d5ca8] shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        الكل
                      </button>
                      <button
                        type="button"
                        onClick={() => setManualPickTypeFilter('mcq')}
                        className={`rounded-md px-2 py-0.5 transition ${
                          manualPickTypeFilter === 'mcq'
                            ? 'bg-white text-[#1d5ca8] shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        اختيار
                      </button>
                      <button
                        type="button"
                        onClick={() => setManualPickTypeFilter('essay')}
                        className={`rounded-md px-2 py-0.5 transition ${
                          manualPickTypeFilter === 'essay'
                            ? 'bg-white text-amber-800 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        مقالي
                      </button>
                    </div>
                  </div>

                  {/* Search by question text */}
                  <div className="relative">
                    <Search className="size-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="بحث في الأسئلة..."
                      value={manualPickSearch}
                      onChange={(e) => setManualPickSearch(e.target.value)}
                      className="w-full sm:w-40 rounded-lg border border-slate-200 bg-white pr-7 pl-2 py-1 text-xs outline-hidden focus:border-[#1d5ca8]"
                    />
                  </div>
                </div>

                {/* Selected Questions Counter Badge */}
                {(() => {
                  const pool = matchingQuestions.length > 0 ? matchingQuestions : questions
                  const selectedQuestionsList = pool.filter((q) => selectedQuestionIds.includes(q.id))
                  const selectedMcqCount = selectedQuestionsList.filter((q) => q.type !== 'essay').length
                  const selectedEssayCount = selectedQuestionsList.filter((q) => q.type === 'essay').length

                  return (
                    <div className="flex items-center justify-between rounded-xl bg-blue-50/70 px-3 py-1.5 text-xs font-bold text-[#153b68]">
                      <span>
                        تم تحديد: {selectedMcqCount} اختيار من متعدد + {selectedEssayCount} مقالي = {selectedQuestionIds.length} سؤال
                      </span>
                      {selectedQuestionIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedQuestionIds([])}
                          className="text-[11px] text-rose-600 hover:underline"
                        >
                          إلغاء التحديد
                        </button>
                      )}
                    </div>
                  )
                })()}

                {/* Questions List */}
                <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 p-2 text-xs space-y-1.5">
                  {(() => {
                    const pool = matchingQuestions.length > 0 ? matchingQuestions : questions
                    const listToRender = pool.filter((q) => {
                      if (manualPickLessonFilter !== 'all') {
                        const l = q.lesson || extractLessonFromTopic(q.topic) || 'عام / بدون درس محدد'
                        if (l !== manualPickLessonFilter) return false
                      }
                      if (manualPickTypeFilter === 'mcq' && q.type === 'essay') return false
                      if (manualPickTypeFilter === 'essay' && q.type !== 'essay') return false
                      if (manualPickSearch.trim()) {
                        const cleanBody = q.body.toLowerCase()
                        const term = manualPickSearch.trim().toLowerCase()
                        if (!cleanBody.includes(term)) return false
                      }
                      return true
                    })

                    if (listToRender.length === 0) {
                      return (
                        <p className="text-center py-6 text-xs font-bold text-slate-400">
                          لا توجد أسئلة تطابق معايير التصفية والبحث الحالية.
                        </p>
                      )
                    }

                    return listToRender.map((q) => {
                      const isChecked = selectedQuestionIds.includes(q.id)
                      const qLesson = q.lesson || extractLessonFromTopic(q.topic)
                      const isEssay = q.type === 'essay'

                      return (
                        <label
                          key={q.id}
                          className={`flex items-start gap-2.5 rounded-xl p-2.5 transition cursor-pointer border ${
                            isChecked
                              ? 'border-[#1d5ca8]/60 bg-blue-50/40 shadow-xs'
                              : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                          }`}
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
                            className="mt-1 size-4 rounded text-[#1d5ca8]"
                          />
                          <div className="min-w-0 flex-1">
                            <MathRenderer text={q.body} as="p" className="font-semibold text-slate-800 text-xs" />
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold">
                              <span
                                className={`rounded px-1.5 py-0.5 border ${
                                  isEssay
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-blue-50 text-[#1d5ca8] border-blue-200'
                                }`}
                              >
                                {isEssay ? 'سؤال مقالي' : 'اختيار من متعدد'}
                              </span>
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">{q.grade}</span>
                              {qLesson && (
                                <span className="rounded bg-emerald-50 text-emerald-800 px-1.5 py-0.5 border border-emerald-200/60">
                                  📖 {qLesson}
                                </span>
                              )}
                              <span className="rounded bg-slate-100 text-slate-700 px-1.5 py-0.5">
                                {q.marks} {q.marks === 1 ? 'درجة' : 'درجات'}
                              </span>
                            </div>
                          </div>
                        </label>
                      )
                    })
                  })()}
                </div>
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

          {/* AI Auto-Grading & Analytics Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-slate-50 border border-blue-200/70 p-4 shadow-2xs">
            <div className="flex items-start sm:items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#153b68] to-[#1d5ca8] text-amber-300 shadow-xs">
                <Sparkles className="size-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800">التصحيح التلقائي الذكي والتحليلات التربوية (AI)</h4>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  تصحيح الأسئلة المقالية تلقائياً بالذكاء الاصطناعي مع تقرير شامل بنقاط القوة والضعف وتوصيات للمعلم.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {aiTeacherReport && (
                <button
                  type="button"
                  onClick={() => setReportModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3.5 py-2 text-xs font-bold text-indigo-700 shadow-xs hover:bg-indigo-50 transition active:scale-95"
                >
                  <BarChart3 className="size-3.5" />
                  <span>عرض تقرير المعلم</span>
                </button>
              )}

              <button
                type="button"
                disabled={isAiGrading || !teacherStatus.isActive || totalSubmissions === 0}
                onClick={handleAiGradeExam}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#153b68] to-[#1d5ca8] px-4 py-2 text-xs font-bold text-white shadow-sm hover:from-[#112f54] hover:to-[#174984] disabled:opacity-50 transition active:scale-95"
              >
                {isAiGrading ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin text-amber-300" />
                    <span>جاري التصحيح الذكي والتحليل...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3.5 text-amber-300" />
                    <span>تصحيح ذكي بالذكاء الاصطناعي ✨</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {aiGradeSuccess && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-bold text-emerald-800 animate-in fade-in">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
              <span>{aiGradeSuccess}</span>
            </div>
          )}

          {loadingSubmissions ? (
            <div className="flex justify-center p-8 text-xs font-bold text-[#1d5ca8]">
              <Loader2 className="size-5 animate-spin" />
              جاري جلب إجابات الطلاب والتحليلات...
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-slate-700">قائمة سجلات ودرجات الطلاب:</h4>
                <p className="text-[11px] text-slate-400">
                  يمكنك حذف سجل أي طالب للسماح له بإعادة دخول الاختبار بكوده.
                </p>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                    <tr>
                      <th className="p-3">اسم الطالب</th>
                      <th className="p-3">الحالة</th>
                      <th className="p-3">الدرجة</th>
                      <th className="p-3">النسبة</th>
                      <th className="p-3">الوقت</th>
                      <th className="p-3 text-center">إجراءات والتصحيح</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {submissionsList.map((sub) => {
                      const perc = Math.round((sub.score / (sub.max_score || 1)) * 100)
                      const isLeftSession = sub.termination_reason === 'left_session'
                      const isIncomplete = !sub.submitted_at
                      const timeLabel = sub.submitted_at
                        ? new Date(sub.submitted_at).toLocaleTimeString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : sub.started_at
                        ? `بدأ ${new Date(sub.started_at).toLocaleTimeString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}`
                        : '—'
                      return (
                        <tr key={sub.id} className="hover:bg-slate-50/80">
                          <td className="p-3 font-bold text-slate-800">{sub.student_name}</td>
                          <td className="p-3">
                            {isLeftSession ? (
                              <span className="inline-flex items-center rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                                انتهى لمغادرة الجلسة
                              </span>
                            ) : isIncomplete ? (
                              <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                جلسة مفتوحة / لم تكتمل
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                تم التسليم
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-bold">
                            {isIncomplete ? '—' : `${sub.score} / ${sub.max_score}`}
                          </td>
                          <td className="p-3 font-semibold">
                            {isIncomplete ? (
                              <span className="text-slate-400">—</span>
                            ) : (
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
                            )}
                          </td>
                          <td className="p-3 text-slate-500">{timeLabel}</td>
                          <td className="p-3 text-center">
                            <div className="flex flex-wrap items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenGrading(sub)}
                                className="inline-flex items-center gap-1 rounded-xl bg-[#1d5ca8] px-2.5 py-1.5 text-xs font-bold text-white hover:bg-[#164e93] shadow-xs"
                              >
                                <Edit3 className="size-3.5" />
                                <span>مراجعة وتصحيح</span>
                              </button>
                              {!isIncomplete && (
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
                              )}
                              {onDeleteSubmission && (
                                <button
                                  type="button"
                                  disabled={!teacherStatus.isActive || deletingSubmissionId === sub.id}
                                  onClick={() => handleDeleteStudentSubmission(sub)}
                                  className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-40 shadow-xs"
                                  title="حذف سجل الطالب للسماح له بإعادة دخول الاختبار"
                                >
                                  {deletingSubmissionId === sub.id ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                  ) : (
                                    <RotateCcw className="size-3.5" />
                                  )}
                                  <span>حذف السجل</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}

                    {submissionsList.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-400">
                          لا توجد سجلات طلاب لهذا الاختبار حتى الآن
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

      {/* AI Teacher Report & Pedagogical Recommendations Modal */}
      <Modal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        title={`تقرير المعلم والتحليل التربوي: ${aiTeacherReport?.exam_title || selectedExamForResults?.title || ''}`}
        maxWidth="max-w-3xl"
      >
        {aiTeacherReport ? (
          <div className="space-y-6 text-right">
            {/* Top Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/50 p-4 border border-blue-100 text-center">
              <div>
                <p className="text-xs text-slate-400 font-bold">الطلاب المصححون</p>
                <p className="mt-1 text-xl font-black text-slate-800">{aiTeacherReport.total_students}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold">متوسط الدرجات</p>
                <p className="mt-1 text-xl font-black text-[#1d5ca8]">{aiTeacherReport.average_score}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold">متوسط النسبة</p>
                <p className="mt-1 text-xl font-black text-emerald-600">{aiTeacherReport.average_percentage}%</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold">أعلى / أقل درجة</p>
                <p className="mt-1 text-xl font-black text-slate-800">
                  {aiTeacherReport.highest_score} / {aiTeacherReport.lowest_score}
                </p>
              </div>
            </div>

            {/* Strengths */}
            {aiTeacherReport.strengths && aiTeacherReport.strengths.length > 0 && (
              <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4">
                <h4 className="flex items-center gap-2 text-xs font-bold text-emerald-800 mb-2">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <span>نقاط القوة وإتقان الطلاب:</span>
                </h4>
                <ul className="list-disc list-inside space-y-1 text-xs text-slate-700">
                  {aiTeacherReport.strengths.map((str: string, i: number) => (
                    <li key={i}>{str}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Problematic Questions */}
            {aiTeacherReport.problematic_questions && aiTeacherReport.problematic_questions.length > 0 && (
              <div className="space-y-3">
                <h4 className="flex items-center gap-2 text-xs font-bold text-amber-800">
                  <AlertCircle className="size-4 text-amber-600" />
                  <span>الأسئلة الأكثر صعوبة ونقاط التعثر:</span>
                </h4>
                <div className="space-y-2">
                  {aiTeacherReport.problematic_questions.map((pq: any, i: number) => (
                    <div key={i} className="rounded-xl border border-amber-200/70 bg-amber-50/30 p-3 text-xs">
                      <div className="flex items-center justify-between font-bold text-slate-800 mb-1">
                        <span>سؤال: {pq.body_snippet}</span>
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800 font-bold">
                          نسبة النجاح: {pq.success_rate}%
                        </span>
                      </div>
                      <p className="text-slate-600 mt-1">
                        <strong className="text-amber-900">الأخطاء الشائعة:</strong> {pq.common_mistakes}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pedagogical Recommendations */}
            {aiTeacherReport.recommendations_for_teacher && aiTeacherReport.recommendations_for_teacher.length > 0 && (
              <div className="rounded-2xl border border-blue-200/80 bg-blue-50/40 p-4">
                <h4 className="flex items-center gap-2 text-xs font-bold text-[#153b68] mb-2">
                  <Sparkles className="size-4 text-blue-600" />
                  <span>توصيات تربوية مقترحة للمعلم لعلاج نقاط القصور:</span>
                </h4>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-700">
                  {aiTeacherReport.recommendations_for_teacher.map((rec: string, i: number) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-400">
                تاريخ التقرير: {new Date(aiTeacherReport.generated_at).toLocaleString('ar-EG')}
              </span>
              <button
                type="button"
                onClick={() => setReportModalOpen(false)}
                className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 transition"
              >
                إغلاق التقرير
              </button>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-slate-400">
            لم يتم توليد تقرير بعد. اضغط على "تصحيح ذكي بالذكاء الاصطناعي" لتوليد التقرير.
          </div>
        )}
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
              {/* Exam Header */}
              <div className="border-b-2 border-slate-800 pb-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900">
                      المعلم: <span className="text-[#1d5ca8]">{teacherName || 'الأستاذ'}</span>
                    </p>
                  </div>

                  <div className="text-center flex-1">
                    <h2 className="text-lg sm:text-2xl font-black text-slate-900">
                      {printExam.title}
                    </h2>
                  </div>

                  <div className="text-left text-xs font-bold text-slate-500 shrink-0" dir="ltr">
                    <p>{printExam.duration_min} دقيقة</p>
                  </div>
                </div>

                {/* Student Details Box */}
                <div className="mt-4 rounded-xl border border-slate-400 p-3 text-xs sm:text-sm font-bold flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <span>اسم الطالب: </span>
                    <span className="text-slate-400 font-normal">........................................................................................................</span>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5 pr-4 border-r border-slate-300">
                    <span>الدرجة: </span>
                    <span className="inline-block w-14 border-b border-black text-center font-normal">/</span>
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
                          <MathRenderer text={q.body} as="span" />
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
                                <MathRenderer text={opt} as="span" />
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
                    <MathRenderer text={q.body} as="p" className="text-sm font-bold text-slate-900 leading-relaxed" />

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
                              <span>صحيحة: </span>
                              <MathRenderer text={q.options?.[studentAns?.selected_index] || 'الخيار المحدد'} as="span" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-bold text-rose-600">
                              <XCircle className="size-4" />
                              <span>خاطئة: </span>
                              <MathRenderer text={q.options?.[studentAns?.selected_index] || 'إجابة غير صحيحة'} as="span" />
                              <span> (الإجابة الصحيحة: </span>
                              <MathRenderer text={q.options?.[q.correct?.[0]]} as="span" />
                              <span>)</span>
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
                        {/* Model Answer (if provided by teacher) */}
                        {(q.model_answer || (Array.isArray(q.correct) && q.correct.length > 0 && typeof q.correct[0] === 'string')) && (
                          <div className="rounded-lg bg-emerald-50/70 p-2.5 border border-emerald-200 text-xs">
                            <span className="font-bold text-emerald-900">💡 نموذج الإجابة للمقارنة: </span>
                            <MathRenderer
                              text={q.model_answer || q.correct[0]}
                              as="span"
                              className="text-emerald-800 font-medium"
                            />
                          </div>
                        )}

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
