'use client'

import React, { useState } from 'react'
import {
  BookOpen,
  Plus,
  FileSpreadsheet,
  FileCode,
  Image as ImageIcon,
  Trash2,
  CheckCircle2,
  Loader2,
  Search,
  Upload,
  Download,
  Copy,
  Check,
  ZoomIn,
  X,
  Sparkles,
  Users,
} from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { compressImage } from '@/lib/image-compress'
import { parseJsonQuestions, parseExcelQuestions, type ParsedQuestion } from '@/lib/question-parser'
import { downloadSampleQuestionExcel } from '@/lib/sample-excel'
import type { TeacherStatus } from '@/lib/teacher-status'
import type { GroupItem } from '../groups/GroupsView'

export const AI_PROMPT_TEMPLATE = `أنت معلم خبير ومصمم اختبارات محترف.
يرجى قراءة الدرس/المستند المرفق وتوليد مجموعة من أسئلة الاختيار من متعدد (MCQ) باللغة العربية بصيغة JSON حصراً، وفق الهيكل البرمجي التالي بدقة تامة ودون كتابة أي نصوص تمهيدية أو شروحات:

{
  "questions": [
    {
      "body": "اكتب نص السؤال هنا بدقة ووضوح؟",
      "options": [
        "الخيار الأول",
        "الخيار الثاني",
        "الخيار الثالث",
        "الخيار الرابع"
      ],
      "correct": [0],
      "marks": 1,
      "grade": "الصف الأول الثانوي",
      "topic": "اسم الدرس أو الوحدة",
      "difficulty": "medium"
    }
  ]
}

قواعد هامة:
1. "options": مصفوفة تحتوي على 4 خيارات منطقية ومتنوعة.
2. "correct": مصفوفة برقم مؤشر الإجابة الصحيحة (0 للخيار الأول، 1 للثاني، 2 للثالث، 3 للرابع).
3. "marks": درجة السؤال (رقم صحيح مثلاً 1 أو 2).
4. "difficulty": مستوى الصعوبة ("easy" أو "medium" أو "hard").
5. لا داعي لكتابة اسم المجموعة في الـ JSON، حيث يقوم التطبيق بتعيين المجموعة المحددة تلقائياً لكافة الأسئلة المستوردة.`

export interface QuestionBankItem {
  id: string
  body: string
  type?: 'mcq' | 'essay'
  image_path?: string | null
  options: string[]
  correct: number[]
  marks: number
  topic?: string | null
  grade?: string | null
  difficulty?: string | null
  model_answer?: string | null
}

interface Props {
  questions: QuestionBankItem[]
  groups?: GroupItem[]
  onAddQuestion: (q: Omit<QuestionBankItem, 'id'>) => Promise<void>
  onBatchAddQuestions: (qList: Omit<QuestionBankItem, 'id'>[]) => Promise<void>
  onDeleteQuestion: (id: string) => Promise<void>
  onUploadImage?: (file: Blob, fileName: string) => Promise<string>
  teacherStatus: TeacherStatus
}

export function QuestionsView({
  questions,
  groups = [],
  onAddQuestion,
  onBatchAddQuestions,
  onDeleteQuestion,
  onUploadImage,
  teacherStatus,
}: Props) {
  const [searchTerm, setSearchTerm] = useState('')
  const [gradeFilter, setGradeFilter] = useState('all')
  const [groupFilter, setGroupFilter] = useState('all')

  // Group selection states
  const [importTargetGroup, setImportTargetGroup] = useState<string>(groups[0]?.id || '')
  const [manualTargetGroup, setManualTargetGroup] = useState<string>(groups[0]?.id || '')

  // Manual Question Modal
  const [manualModalOpen, setManualModalOpen] = useState(false)
  const [questionType, setQuestionType] = useState<'mcq' | 'essay'>('mcq')
  const [body, setBody] = useState('')
  const [modelAnswer, setModelAnswer] = useState('')
  const [options, setOptions] = useState<string[]>(['', '', '', ''])
  const [correctIdx, setCorrectIdx] = useState(0)
  const [marks, setMarks] = useState(1)
  const [grade, setGrade] = useState('الصف الأول الثانوي')
  const [topic, setTopic] = useState('')
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [loadingAdd, setLoadingAdd] = useState(false)

  // Import Modal (JSON or Excel)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importMode, setImportMode] = useState<'excel' | 'json'>('json')
  const [jsonText, setJsonText] = useState('')
  const [parsedPreview, setParsedPreview] = useState<ParsedQuestion[]>([])
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [copyPromptSuccess, setCopyPromptSuccess] = useState(false)
  const [downloadingSample, setDownloadingSample] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // Filtered list
  const filteredQuestions = questions.filter((q) => {
    const matchesSearch =
      q.body.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.topic && q.topic.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesGrade = gradeFilter === 'all' || q.grade === gradeFilter
    const matchesGroup =
      groupFilter === 'all' ||
      (q.topic && q.topic.includes(groupFilter)) ||
      q.grade === groupFilter
    return matchesSearch && matchesGrade && matchesGroup
  })

  // Submit Single Question
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return

    const validOptions = options.map((o) => o.trim()).filter(Boolean)
    if (questionType === 'mcq' && validOptions.length < 2) {
      alert('يجب كتابة خيارين على الأقل لأسئلة الاختيار من متعدد')
      return
    }

    setLoadingAdd(true)
    try {
      let uploadedImagePath: string | undefined = undefined

      if (imageFile) {
        try {
          const compressed = await compressImage(imageFile)
          const fileName = `${Date.now()}-${imageFile.name.replace(/\s+/g, '_')}`
          if (onUploadImage) {
            uploadedImagePath = await onUploadImage(compressed, fileName)
          }
        } catch (uploadErr) {
          console.warn('[Question Image] Fallback to base64 Data URL:', uploadErr)
          // Fallback directly to Data URL so it NEVER fails
          uploadedImagePath = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.readAsDataURL(imageFile)
          })
        }
      }

      const selectedGrp = groups.find((g) => g.id === manualTargetGroup)
      const finalGrade = selectedGrp
        ? selectedGrp.grade
        : manualTargetGroup.startsWith('grade:')
        ? manualTargetGroup.replace('grade:', '')
        : grade
      const groupPrefix = selectedGrp ? `${selectedGrp.name}` : ''
      let finalTopic = topic.trim()
      if (groupPrefix && !finalTopic.includes(groupPrefix)) {
        finalTopic = finalTopic ? `${groupPrefix} | ${finalTopic}` : groupPrefix
      }

      await onAddQuestion({
        body: body.trim(),
        type: questionType,
        options: questionType === 'mcq' ? validOptions : [],
        correct: questionType === 'mcq' ? [correctIdx >= validOptions.length ? 0 : correctIdx] : [],
        marks,
        grade: finalGrade,
        topic: finalTopic || undefined,
        difficulty,
        image_path: uploadedImagePath,
        model_answer: questionType === 'essay' && modelAnswer.trim() ? modelAnswer.trim() : undefined,
      })

      // Reset form
      setBody('')
      setModelAnswer('')
      setOptions(['', '', '', ''])
      setCorrectIdx(0)
      setImageFile(null)
      setImagePreviewUrl(null)
      setManualModalOpen(false)
    } catch (err) {
      console.error(err)
      alert('حدث خطأ أثناء حفظ السؤال، يرجى المحاولة مرة أخرى')
    } finally {
      setLoadingAdd(false)
    }
  }

  // Handle JSON Parse
  const handleParseJson = () => {
    if (!jsonText.trim()) return
    const res = parseJsonQuestions(jsonText)
    setParsedPreview(res.questions)
    setImportErrors(res.errors)
  }

  // Handle JSON File Upload
  const handleJsonFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = (event.target?.result as string) || ''
      setJsonText(text)
      const res = parseJsonQuestions(text)
      setParsedPreview(res.questions)
      setImportErrors(res.errors)
    }
    reader.readAsText(file)
  }

  // Copy AI Prompt
  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(AI_PROMPT_TEMPLATE)
      setCopyPromptSuccess(true)
      setTimeout(() => setCopyPromptSuccess(false), 3000)
    } catch {
      alert('تعذر النسخ التلقائي للحافظة')
    }
  }

  // Download Sample Excel
  const handleDownloadSampleExcel = async () => {
    setDownloadingSample(true)
    try {
      await downloadSampleQuestionExcel()
    } catch (err) {
      console.error('Error downloading excel sample:', err)
      alert('حدث خطأ أثناء تحميل ملف النموذج')
    } finally {
      setDownloadingSample(false)
    }
  }

  // Handle Excel File
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    try {
      const buffer = await file.arrayBuffer()
      const res = await parseExcelQuestions(buffer)
      setParsedPreview(res.questions)
      setImportErrors(res.errors)
    } catch (err) {
      console.error(err)
      setImportErrors(['فشل قراءة ملف Excel'])
    } finally {
      setImporting(false)
    }
  }

  // Confirm Batch Import
  const handleConfirmBatch = async () => {
    if (!parsedPreview.length) return

    const selectedGrp = groups.find((g) => g.id === importTargetGroup)
    const finalGrade = selectedGrp
      ? selectedGrp.grade
      : importTargetGroup.startsWith('grade:')
      ? importTargetGroup.replace('grade:', '')
      : (groups[0]?.grade || grade)
    const groupPrefix = selectedGrp ? `${selectedGrp.name}` : ''

    setImporting(true)
    try {
      await onBatchAddQuestions(
        parsedPreview.map((p) => {
          let questionTopic = p.topic || ''
          if (groupPrefix && !questionTopic.includes(groupPrefix)) {
            questionTopic = questionTopic ? `${groupPrefix} | ${questionTopic}` : groupPrefix
          }
          return {
            body: p.body,
            type: 'mcq' as const,
            options: p.options,
            correct: p.correct,
            marks: p.marks,
            grade: finalGrade || p.grade || 'الصف الأول الثانوي',
            topic: questionTopic || undefined,
            difficulty: p.difficulty,
            image_path: p.image_path,
          }
        })
      )
      setImportModalOpen(false)
      setParsedPreview([])
      setJsonText('')
      alert(`تم استيراد ${parsedPreview.length} سؤال بنجاح وتعيينها لـ "${selectedGrp?.name || finalGrade}"!`)
    } catch (err) {
      console.error(err)
      alert('فشل استيراد الأسئلة')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-extrabold text-[#153b68]">بنك الأسئلة</h2>
          <p className="text-xs text-slate-500">
            مستودع الأسئلة والاختيارات المتعددة (MCQ) مع إمكانية إعادة استخدامها وتوليد الاختبارات
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportModalOpen(true)}
            disabled={!teacherStatus.isActive}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50"
          >
            <Upload className="size-4 text-[#1d5ca8]" />
            <span>استيراد (JSON / Excel)</span>
          </button>

          <button
            onClick={() => setManualModalOpen(true)}
            disabled={!teacherStatus.isActive}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1d5ca8] px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#164e93] disabled:opacity-50"
          >
            <Plus className="size-4" />
            <span>إضافة سؤال يدوي</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-2.5 size-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث في نص الأسئلة أو الموضوعات..."
            className="w-full rounded-xl bg-slate-50 py-2 pr-9 pl-3 text-xs outline-hidden focus:bg-white focus:ring-1 focus:ring-[#1d5ca8]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {groups.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-400">المجموعة:</span>
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-hidden"
              >
                <option value="all">كل المجموعات</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.name}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-400">المرحلة:</span>
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-hidden"
            >
              <option value="all">كل المراحل</option>
              <option value="الصف الأول الإعدادي">الصف الأول الإعدادي</option>
              <option value="الصف الثاني الإعدادي">الصف الثاني الإعدادي</option>
              <option value="الصف الثالث الإعدادي">الصف الثالث الإعدادي</option>
              <option value="الصف الأول الثانوي">الصف الأول الثانوي</option>
              <option value="الصف الثاني الثانوي">الصف الثاني الثانوي</option>
              <option value="الصف الثالث الثانوي">الصف الثالث الثانوي</option>
            </select>
          </div>
        </div>
      </div>

      {/* Questions List */}
      <div className="grid gap-3 sm:grid-cols-2">
        {filteredQuestions.map((q, qIndex) => (
          <div
            key={q.id}
            className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                    q.type === 'essay' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {q.type === 'essay' ? 'سؤال مقالي' : 'اختيار من متعدد'}
                  </span>
                  <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-[#1d5ca8]">
                    {q.grade || 'عام'}
                  </span>
                  {q.topic && q.topic.includes('|') ? (
                    <>
                      <span className="rounded-md bg-purple-50 px-2 py-0.5 text-xs font-bold text-purple-700">
                        👥 {q.topic.split('|')[0].trim()}
                      </span>
                      {q.topic.split('|')[1]?.trim() && (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                          {q.topic.split('|')[1].trim()}
                        </span>
                      )}
                    </>
                  ) : q.topic ? (
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                      {q.topic}
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-500">{q.marks || 1} درجة</span>
                  <button
                    onClick={() => {
                      if (confirm('هل أنت متأكد من حذف هذا السؤال من البنك؟')) {
                        onDeleteQuestion(q.id)
                      }
                    }}
                    disabled={!teacherStatus.isActive}
                    className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>

              {/* Question Text */}
              <p className="mt-3 text-sm font-bold text-slate-800 leading-relaxed">{q.body}</p>

              {/* Optional image preview (Compact, centered, click to zoom) */}
              {q.image_path && (
                <div className="mt-2.5 flex justify-center">
                  <div
                    onClick={() => setPreviewImage(q.image_path || null)}
                    className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-50/80 p-1.5 shadow-2xs hover:border-[#1d5ca8]/40"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={q.image_path}
                      alt="سؤال"
                      className="max-h-32 sm:max-h-36 w-auto max-w-full rounded-lg object-contain"
                    />
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-slate-900/70 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-xs opacity-0 group-hover:opacity-100 transition">
                      <ZoomIn className="size-2.5" />
                      <span>تكبير</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Options or Essay Indicator */}
              {q.type === 'essay' ? (
                <div className="mt-3.5 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800">
                    <span>✍️ سؤال مقالي (تصحيح يدوي من المعلم)</span>
                  </div>
                  {q.model_answer && (
                    <div className="mt-2 text-slate-700">
                      <span className="font-bold text-slate-900">نموذج الإجابة: </span>
                      {q.model_answer}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-3.5 space-y-1.5">
                  {(q.options || []).map((opt, oIdx) => {
                    const isCorrect = q.correct?.includes(oIdx)
                    return (
                      <div
                        key={oIdx}
                        className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold ${
                          isCorrect
                            ? 'border border-emerald-300 bg-emerald-50 text-emerald-800'
                            : 'bg-slate-50 text-slate-600'
                        }`}
                      >
                        <span>{opt}</span>
                        {isCorrect && (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                            <CheckCircle2 className="size-3.5" />
                            إجابة صحيحة
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ))}

        {filteredQuestions.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">
            <BookOpen className="mx-auto size-10 text-slate-300" />
            <p className="mt-3 text-sm font-bold text-slate-600">لا توجد أسئلة تطابق البحث</p>
            <p className="mt-1 text-xs text-slate-400">
              أضف أسئلة يدوياً أو استورد دفعة أسئلة من ملف JSON أو Excel
            </p>
          </div>
        )}
      </div>

      {/* Manual Add Question Modal */}
      <Modal
        isOpen={manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        title="إضافة سؤال جديد لبنك الأسئلة"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleManualSubmit} className="space-y-4">
          {/* Question Type Switcher */}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">نوع السؤال</label>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setQuestionType('mcq')}
                className={`rounded-lg py-2 text-xs font-bold transition ${
                  questionType === 'mcq'
                    ? 'bg-white text-[#1d5ca8] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                اختيار من متعدد (تصحيح تلقائي)
              </button>
              <button
                type="button"
                onClick={() => setQuestionType('essay')}
                className={`rounded-lg py-2 text-xs font-bold transition ${
                  questionType === 'essay'
                    ? 'bg-white text-amber-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                سؤال مقالي (تصحيح يدوي ورقي/كتابي)
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">نص السؤال</label>
            <textarea
              required
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="اكتب نص السؤال هنا..."
              className="w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-hidden focus:border-[#1d5ca8]"
            />
          </div>

          {/* Conditional: MCQ Options vs Essay Model Answer */}
          {questionType === 'mcq' ? (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                خيارات الإجابة (حدد الإجابة الصحيحة):
              </label>
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correctOption"
                    checked={correctIdx === idx}
                    onChange={() => setCorrectIdx(idx)}
                    className="size-4 text-[#1d5ca8]"
                  />
                  <input
                    type="text"
                    required={idx < 2}
                    value={opt}
                    onChange={(e) => {
                      const val = e.target.value
                      setOptions((prev) => prev.map((o, i) => (i === idx ? val : o)))
                    }}
                    placeholder={`الخيار ${idx + 1}`}
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs outline-hidden focus:border-[#1d5ca8]"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
              <label className="block text-xs font-bold text-amber-900">
                نموذج الإجابة الاسترشادي (اختياري للمعلم أثناء التصحيح)
              </label>
              <textarea
                rows={2}
                value={modelAnswer}
                onChange={(e) => setModelAnswer(e.target.value)}
                placeholder="اكتب النقاط الرئيسية للإجابة الصحيحة أو معايير التقييم..."
                className="w-full rounded-xl border border-amber-200 bg-white p-2.5 text-xs outline-hidden focus:border-amber-500"
              />
              <p className="text-[11px] text-amber-700">
                💡 في الامتحان، يمكن للطالب كتابة الإجابة المقالية في خانة النص أو رفع صور لإجابته الورقية.
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">المجموعة المستهدفة / المرحلة</label>
              <select
                value={manualTargetGroup}
                onChange={(e) => {
                  const val = e.target.value
                  setManualTargetGroup(val)
                  const grp = groups.find((g) => g.id === val)
                  if (grp) {
                    setGrade(grp.grade)
                  } else if (val.startsWith('grade:')) {
                    setGrade(val.replace('grade:', ''))
                  }
                }}
                className="w-full rounded-xl border border-slate-200 p-2 text-xs font-semibold outline-hidden focus:border-[#1d5ca8]"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    مجموعة: {g.name} ({g.grade})
                  </option>
                ))}
                <optgroup label="المراحل العامة">
                  <option value="grade:الصف الأول الإعدادي">الصف الأول الإعدادي</option>
                  <option value="grade:الصف الثاني الإعدادي">الصف الثاني الإعدادي</option>
                  <option value="grade:الصف الثالث الإعدادي">الصف الثالث الإعدادي</option>
                  <option value="grade:الصف الأول الثانوي">الصف الأول الثانوي</option>
                  <option value="grade:الصف الثاني الثانوي">الصف الثاني الثانوي</option>
                  <option value="grade:الصف الثالث الثانوي">الصف الثالث الثانوي</option>
                </optgroup>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">الموضوع / الوحدة</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="مثال: الجبر - الدرس الثاني"
                className="w-full rounded-xl border border-slate-200 p-2 text-xs outline-hidden"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">الدرجة</label>
              <input
                type="number"
                min="1"
                max="50"
                value={marks}
                onChange={(e) => setMarks(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 p-2 text-xs outline-hidden"
              />
            </div>
          </div>

          {/* Optional image attachment */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">صورة توضيحية / مسألة (اختياري)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0] || null
                setImageFile(f)
                if (f) {
                  setImagePreviewUrl(URL.createObjectURL(f))
                } else {
                  setImagePreviewUrl(null)
                }
              }}
              className="text-xs text-slate-500"
            />
            {imagePreviewUrl && (
              <div className="mt-2 flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreviewUrl} alt="معاينة" className="h-16 w-auto rounded-lg border object-contain" />
                <button
                  type="button"
                  onClick={() => {
                    setImageFile(null)
                    setImagePreviewUrl(null)
                  }}
                  className="rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-100"
                >
                  إزالة الصورة
                </button>
              </div>
            )}
            <p className="mt-1 text-[11px] text-slate-400">
              يتم ضغط الصورة تلقائياً لتوفير مساحة التخزين وتكون بحجم مناسب ومقروء للطالب.
            </p>
          </div>

          <div className="mt-5 flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setManualModalOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loadingAdd}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1d5ca8] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#164e93] disabled:opacity-50"
            >
              {loadingAdd && <Loader2 className="size-3.5 animate-spin" />}
              حفظ في البنك
            </button>
          </div>
        </form>
      </Modal>

      {/* Batch Import Modal */}
      <Modal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="استيراد دفعة أسئلة (JSON / Excel)"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          {/* Target Group Selector (Ensures questions go to the exact group without name discrepancies) */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-3.5 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#153b68]">
              <Users className="size-4 text-[#1d5ca8]" />
              <span>المجموعة المستهدفة لهذه الأسئلة (سيتم تعيينها لجميع الأسئلة المستوردة):</span>
            </div>
            <select
              value={importTargetGroup}
              onChange={(e) => setImportTargetGroup(e.target.value)}
              className="w-full rounded-xl border border-blue-300 bg-white p-2.5 text-xs font-bold text-slate-800 outline-hidden focus:border-[#1d5ca8]"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  مجموعة: {g.name} ({g.grade})
                </option>
              ))}
              <optgroup label="أو تحديد مرحلة دراسية عامة (لكل المجموعات)">
                <option value="grade:الصف الأول الإعدادي">عام - الصف الأول الإعدادي</option>
                <option value="grade:الصف الثاني الإعدادي">عام - الصف الثاني الإعدادي</option>
                <option value="grade:الصف الثالث الإعدادي">عام - الصف الثالث الإعدادي</option>
                <option value="grade:الصف الأول الثانوي">عام - الصف الأول الثانوي</option>
                <option value="grade:الصف الثاني الثانوي">عام - الصف الثاني الثانوي</option>
                <option value="grade:الصف الثالث الثانوي">عام - الصف الثالث الثانوي</option>
              </optgroup>
            </select>
            <p className="text-[11px] text-blue-700">
              💡 لا داعي لكتابة اسم المجموعة في ملف الـ JSON أو الـ Excel؛ سيتولى النظام توجيه وتعيين الأسئلة المستوردة للمجموعة المحددة هنا مباشرة لتفادي أي أخطاء في الأسماء.
            </p>
          </div>

          <div className="flex gap-2 border-b border-slate-200 pb-2">
            <button
              type="button"
              onClick={() => {
                setImportMode('json')
                setParsedPreview([])
              }}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold ${
                importMode === 'json'
                  ? 'bg-[#153b68] text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileCode className="size-4" />
              لصق كود JSON
            </button>
            <button
              type="button"
              onClick={() => {
                setImportMode('excel')
                setParsedPreview([])
              }}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold ${
                importMode === 'excel'
                  ? 'bg-[#153b68] text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileSpreadsheet className="size-4 text-emerald-600" />
              رفع ملف Excel
            </button>
          </div>

          {importMode === 'json' ? (
            <div className="space-y-3">
              {/* AI Prompt Generator Card */}
              <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 shrink-0 text-[#1d5ca8]" />
                    <p className="text-xs font-bold text-blue-950">
                      توليد الأسئلة عبر الذكاء الاصطناعي (ChatGPT / Gemini):
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyPrompt}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#1d5ca8] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#164e93] active:scale-95"
                  >
                    {copyPromptSuccess ? (
                      <Check className="size-3.5 text-emerald-300" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    <span>{copyPromptSuccess ? 'تم نسخ البرومبت بنجاح!' : 'نسخ برومبت الذكاء الاصطناعي'}</span>
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-blue-800 leading-relaxed">
                  اضغط على الزر لنسخ البرومبت الجاهز، ثم الصقه في ChatGPT أو Gemini مع درسك أو ملزمتك، وسيقوم الذكاء الاصطناعي بإنشاء الأسئلة بتنسيق JSON المطلوب فوراً لتلصقه هنا.
                </p>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    الصق كود JSON هنا:
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-1 text-xs font-bold text-[#1d5ca8] hover:underline">
                    <Upload className="size-3" />
                    <span>أو اختر ملف .json من جهازك</span>
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={handleJsonFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                <textarea
                  rows={6}
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  placeholder='{ "questions": [ { "body": "سؤال...", "options": ["أ", "ب", "ج", "د"], "correct": [0], "marks": 1 } ] }'
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-xs outline-hidden focus:border-[#1d5ca8]"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={handleParseJson}
                  className="mt-2 rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-900 active:scale-95"
                >
                  معاينة والتحقق من الأسئلة
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Excel Sample Download Banner */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-950">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="size-5 shrink-0 text-emerald-600" />
                  <div>
                    <p className="font-bold">هل تحتاج إلى نموذج جاهز لتعبئة الأسئلة؟</p>
                    <p className="text-[11px] text-emerald-700">حمّل النموذج الجاهز واملأ أسئلتك ثم أعد رفعه هنا</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={downloadingSample}
                  onClick={handleDownloadSampleExcel}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 active:scale-95"
                >
                  {downloadingSample ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Download className="size-3.5" />
                  )}
                  <span>تحميل نموذج Excel التجريبي</span>
                </button>
              </div>

              <div className="rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center hover:bg-slate-50 transition">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleExcelUpload}
                  id="excelQuestionInput"
                  className="hidden"
                />
                <label htmlFor="excelQuestionInput" className="cursor-pointer">
                  <FileSpreadsheet className="mx-auto size-9 text-emerald-600" />
                  <p className="mt-2 text-xs font-bold text-slate-700">اختر ملف Excel من جهازك</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    يدعم ملفات (.xlsx, .xls) المحتوية على أعمدة: نص السؤال، الخيارات، والإجابة الصحيحة
                  </p>
                </label>
              </div>
            </div>
          )}

          {importErrors.length > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 space-y-1">
              <p className="font-bold">أخطاء التنسيق:</p>
              {importErrors.map((err, i) => (
                <p key={i}>• {err}</p>
              ))}
            </div>
          )}

          {parsedPreview.length > 0 && (
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-emerald-700">
                  تم التحقق من صحة {parsedPreview.length} سؤال بنجاح!
                </p>
                {importTargetGroup && (
                  <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-[#1d5ca8]">
                    المجموعة المستهدفة: {groups.find(g => g.id === importTargetGroup)?.name || importTargetGroup.replace('grade:', '')}
                  </span>
                )}
              </div>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 p-2 text-xs space-y-2">
                {parsedPreview.map((p, i) => (
                  <div key={i} className="border-b pb-1 last:border-0">
                    <p className="font-bold text-slate-800">
                      {i + 1}. {p.body}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      الخيارات ({p.options.length}) · الدرجة: {p.marks}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setImportModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={importing}
                  onClick={handleConfirmBatch}
                  className="rounded-xl bg-[#1d5ca8] px-5 py-2 text-xs font-bold text-white hover:bg-[#164e93]"
                >
                  {importing ? 'جاري الحفظ...' : 'حفظ الأسئلة في بنك الأسئلة'}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Full-Screen Preview Modal for Question Images */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[92vh] max-w-3xl overflow-hidden rounded-2xl bg-white p-2.5 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 left-4 z-10 grid size-8 place-items-center rounded-full bg-slate-900/80 text-white shadow-md hover:bg-slate-900"
            >
              <X className="size-4" />
            </button>
            <div className="max-h-[82vh] overflow-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewImage}
                alt="معاينة الصورة"
                className="mx-auto h-auto max-h-[80vh] w-auto max-w-full rounded-xl object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
