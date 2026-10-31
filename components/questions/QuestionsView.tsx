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
} from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { compressImage } from '@/lib/image-compress'
import { parseJsonQuestions, parseExcelQuestions, type ParsedQuestion } from '@/lib/question-parser'
import type { TeacherStatus } from '@/lib/teacher-status'

export interface QuestionBankItem {
  id: string
  body: string
  image_path?: string | null
  options: string[]
  correct: number[]
  marks: number
  topic?: string | null
  grade?: string | null
  difficulty?: string | null
}

interface Props {
  questions: QuestionBankItem[]
  onAddQuestion: (q: Omit<QuestionBankItem, 'id'>) => Promise<void>
  onBatchAddQuestions: (qList: Omit<QuestionBankItem, 'id'>[]) => Promise<void>
  onDeleteQuestion: (id: string) => Promise<void>
  onUploadImage?: (file: Blob, fileName: string) => Promise<string>
  teacherStatus: TeacherStatus
}

export function QuestionsView({
  questions,
  onAddQuestion,
  onBatchAddQuestions,
  onDeleteQuestion,
  onUploadImage,
  teacherStatus,
}: Props) {
  const [searchTerm, setSearchTerm] = useState('')
  const [gradeFilter, setGradeFilter] = useState('all')

  // Manual Question Modal
  const [manualModalOpen, setManualModalOpen] = useState(false)
  const [body, setBody] = useState('')
  const [options, setOptions] = useState<string[]>(['', '', '', ''])
  const [correctIdx, setCorrectIdx] = useState(0)
  const [marks, setMarks] = useState(1)
  const [grade, setGrade] = useState('الصف الأول الثانوي')
  const [topic, setTopic] = useState('')
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [loadingAdd, setLoadingAdd] = useState(false)

  // Import Modal (JSON or Excel)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importMode, setImportMode] = useState<'excel' | 'json'>('json')
  const [jsonText, setJsonText] = useState('')
  const [parsedPreview, setParsedPreview] = useState<ParsedQuestion[]>([])
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [importing, setImporting] = useState(false)

  // Filtered list
  const filteredQuestions = questions.filter((q) => {
    const matchesSearch =
      q.body.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.topic && q.topic.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesGrade = gradeFilter === 'all' || q.grade === gradeFilter
    return matchesSearch && matchesGrade
  })

  // Submit Single Question
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return

    const validOptions = options.map((o) => o.trim()).filter(Boolean)
    if (validOptions.length < 2) {
      alert('يجب كتابة خيارين على الأقل')
      return
    }

    setLoadingAdd(true)
    try {
      let uploadedImagePath: string | undefined = undefined

      if (imageFile && onUploadImage) {
        const compressed = await compressImage(imageFile)
        const fileName = `${Date.now()}-${imageFile.name.replace(/\s+/g, '_')}`
        uploadedImagePath = await onUploadImage(compressed, fileName)
      }

      await onAddQuestion({
        body: body.trim(),
        options: validOptions,
        correct: [correctIdx >= validOptions.length ? 0 : correctIdx],
        marks,
        grade,
        topic: topic.trim() || undefined,
        difficulty,
        image_path: uploadedImagePath,
      })

      // Reset form
      setBody('')
      setOptions(['', '', '', ''])
      setCorrectIdx(0)
      setImageFile(null)
      setManualModalOpen(false)
    } catch (err) {
      console.error(err)
      alert('فشل حفظ السؤال')
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

    setImporting(true)
    try {
      await onBatchAddQuestions(
        parsedPreview.map((p) => ({
          body: p.body,
          options: p.options,
          correct: p.correct,
          marks: p.marks,
          grade: p.grade || grade,
          topic: p.topic,
          difficulty: p.difficulty,
          image_path: p.image_path,
        }))
      )
      setImportModalOpen(false)
      setParsedPreview([])
      setJsonText('')
      alert(`تم استيراد ${parsedPreview.length} سؤال إلى بنك الأسئلة!`)
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

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400">المرحلة:</span>
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-hidden"
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

      {/* Questions List */}
      <div className="grid gap-3 sm:grid-cols-2">
        {filteredQuestions.map((q, qIndex) => (
          <div
            key={q.id}
            className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                    {q.grade || 'عام'}
                  </span>
                  {q.topic && (
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-[#1d5ca8]">
                      {q.topic}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-500">{q.marks} درجة</span>
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

              {/* Optional image preview */}
              {q.image_path && (
                <div className="mt-2.5 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={q.image_path} alt="سؤال" className="max-h-40 w-full object-contain" />
                </div>
              )}

              {/* Options */}
              <div className="mt-3.5 space-y-1.5">
                {q.options.map((opt, oIdx) => {
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

          {/* Options */}
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

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">المرحلة</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2 text-xs outline-hidden"
              >
                <option value="الصف الأول الإعدادي">الصف الأول الإعدادي</option>
                <option value="الصف الثاني الإعدادي">الصف الثاني الإعدادي</option>
                <option value="الصف الثالث الإعدادي">الصف الثالث الإعدادي</option>
                <option value="الصف الأول الثانوي">الصف الأول الثانوي</option>
                <option value="الصف الثاني الثانوي">الصف الثاني الثانوي</option>
                <option value="الصف الثالث الثانوي">الصف الثالث الثانوي</option>
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
                max="20"
                value={marks}
                onChange={(e) => setMarks(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 p-2 text-xs outline-hidden"
              />
            </div>
          </div>

          {/* Optional image attachment */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">صورة توضيحية (اختياري)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              className="text-xs text-slate-500"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              يتم ضغط الصورة تلقائياً لتوفير مساحة التخزين.
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
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">
                الصق كود JSON هنا (وفق المعيار المحدد):
              </label>
              <textarea
                rows={6}
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder='{ "questions": [ { "body": "...", "options": ["..."], "correct": [0], "marks": 2 } ] }'
                className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-xs outline-hidden focus:border-[#1d5ca8]"
                dir="ltr"
              />
              <button
                type="button"
                onClick={handleParseJson}
                className="mt-2 rounded-xl bg-slate-800 px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-900"
              >
                معاينة الأسئلة
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleExcelUpload}
                id="excelQuestionInput"
                className="hidden"
              />
              <label htmlFor="excelQuestionInput" className="cursor-pointer">
                <FileSpreadsheet className="mx-auto size-8 text-emerald-600" />
                <p className="mt-2 text-xs font-bold text-slate-700">اختر ملف Excel</p>
                <p className="text-[11px] text-slate-400">
                  يجب أن يحتوي على أعمدة: نص السؤال، الخيار 1، الخيار 2، الإجابة الصحيحة
                </p>
              </label>
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
              <p className="text-xs font-bold text-emerald-700">
                تم التحقق من صحة {parsedPreview.length} سؤال بنجاح!
              </p>
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
    </div>
  )
}
