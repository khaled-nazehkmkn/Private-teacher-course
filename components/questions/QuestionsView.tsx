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
  BookMarked,
  Edit3,
} from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { compressImage } from '@/lib/image-compress'
import { parseJsonQuestions, parseExcelQuestions, type ParsedQuestion } from '@/lib/question-parser'
import { downloadSampleQuestionExcel } from '@/lib/sample-excel'
import {
  MathRenderer,
  cleanGeminiArtifacts,
  cleanGeminiOption,
  extractLessonFromTopic,
  formatQuestionTopic,
} from '@/components/ui/math-renderer'
import type { TeacherStatus } from '@/lib/teacher-status'
import type { GroupItem } from '../groups/GroupsView'

export const AI_PROMPT_TEMPLATE = String.raw`أنت معلم ومصمم اختبارات خبير، ومتخصص في استخراج الأسئلة من الصور والمستندات (OCR) وتنسيقها برمجياً لعرضها عبر مكتبة KaTeX.
المطلوب: اقرأ الصورة المرفقة (أو النص/الملف المرفق) بدقة تامة، واستخرج جميع الأسئلة الواردة فيها بجميع أشكالها (اختيار من متعدد MCQ، صواب وخطأ True/False، أسئلة مقالية ومسائل بالخطوات Essay/Problem-solving) وحوّلها حصراً إلى كود JSON صالح 100% وفق الهيكل التالي دون كتابة أي نصوص تمهيدية أو شروحات أو Markdown خارج الـ JSON:

{
  "questions": [
    {
      "type": "mcq",
      "body": "أيٌّ من التعبيرات الآتية يمثل مفكوك المقدار $(X - 2)^2$؟",
      "options": [
        "$X^2 - 4X + 4$",
        "$X^2 - 4$",
        "$X^2 + 4X + 4$",
        "$X^2 - 2X + 4$"
      ],
      "correct": [0],
      "marks": 1,
      "grade": "الصف الثاني الثانوي",
      "lesson": "الدرس الأول: الدوال الحقيقية",
      "topic": "الجبر",
      "difficulty": "medium"
    },
    {
      "type": "true_false",
      "body": "مجموع قياسات الزوايا الداخلة لأي مثلث يساوي $180^\\circ$، وقيمة $\\sin(30^\\circ) = \\frac{1}{2}$.",
      "options": [
        "صواب",
        "خطأ"
      ],
      "correct": [0],
      "marks": 1,
      "grade": "الصف الأول الثانوي",
      "lesson": "الدرس الثاني: المثلثات",
      "topic": "الهندسة",
      "difficulty": "easy"
    },
    {
      "type": "essay",
      "body": "أوجد مجموعة حل المعادلة الآتية في $\\mathbb{R}$: $\\sqrt{X + 5} = X - 1$",
      "options": [],
      "correct": [],
      "model_answer": "خطوات الحل النموذجية:\n1) بتربيع الطرفين: $X + 5 = (X - 1)^2$\n2) $X + 5 = X^2 - 2X + 1$\n3) $X^2 - 3X - 4 = 0$\n4) $(X - 4)(X + 1) = 0$\n5) إذن $X = 4$ أو $X = -1$\nبالتحقق: $X = 4$ يحقق المعادلة، بينما $X = -1$ مرفوض.\nإذن مجموعة الحل هي: $\\{4\\}$",
      "marks": 3,
      "grade": "الصف الثاني الثانوي",
      "lesson": "الدرس الثالث: حل المعادلات الجذرية",
      "topic": "الجبر",
      "difficulty": "hard"
    }
  ]
}

قواعد وإرشادات إلزامية (مهم جداً للالتزام بها حرفياً):
1. قراءة الصور: اقرأ كافة الأسئلة الموجودة في الصورة بالترتيب. إذا كانت الصورة بالإنجليزية (Math / Science لغات) احتفظ باللغة الإنجليزية كما هي، وإذا كانت بالعربية احتفظ بالعربية.
2. أنواع الأسئلة المدعومة في "type":
   - "mcq": لأسئلة الاختيار من متعدد. "options" مصفوفة بجميع الخيارات، و "correct" مصفوفة برقم مؤشر الإجابة الصحيحة يبدأ من 0 (مثلاً [0] للخيار الأول، [1] للثاني).
   - "true_false": لأسئلة الصواب والخطأ. "options" تكون ["صواب", "خطأ"] (أو ["True", "False"] للإنجليزية)، و "correct" يكون [0] للصواب أو [1] للخطأ.
   - "essay": للأسئلة المقالية، مسائل الإثبات، أوجد الناتج، أو الأسئلة التي تتطلب خطوات حل. "options" مصفوفة فارغة []، و "correct" مصفوفة فارغة []، ويجب كتابة خطوات الحل والناتج النهائي بالتفصيل في حقل "model_answer".
3. قواعد تنسيق المعادلات الرياضية (KaTeX) داخل JSON — حرجة جداً:
   - يجب إحاطة **كل** تعبير أو رمز أو متغير أو أس أو جذر أو كسر أو متباينة أو معادلة رياضية بعلامتي دولار $...$ في "body" و "options" و "model_answer" (سواء كانت الأسئلة بالعربية أو بالإنجليزية Math / Science، وبشكل خاص في خطوات الإثبات والحل داخل "model_answer").
   - أمثلة صحيحة: "$X^2$"، "$x^2 + 5x + 6 = 0$"، "$x_1, x_2$"، "$\\frac{a}{b}$"، "$\\geq$"، "$\\leq$"، "$\\implies$"، "$\\sqrt{x}$"، "$\\sqrt{X + 5}$"، "$\\sqrt[3]{8}$"، "$10^{-3}$".
   - الكسور والمتباينات والخطوات الإنجليزية (مهم جداً): أي كسر "\\frac{...}{...}" أو متباينة "\\geq" / "\\leq" / "\\neq" أو أقواس "\\left(...\\right)" أو سهم استنتاج "\\implies" يجب أن يكون **دائماً داخل "$...$"**. ممنوع منعاً باتاً كتابة أوامر LaTeX مكشوفة بدون "$...$" مثل: "Since \\left(\\frac{a - b}{2}\\right)^2 \\geq 0" أو "a - b = 0 \\implies a = b"؛ الصحيح دائماً هو وضعها داخل "$...$" هكذا: "Since $\\left(\\frac{a - b}{2}\\right)^2 \\geq 0$ and $\\sqrt{\\frac{a^2 + b^2}{2}} \\geq \\frac{a + b}{2}$, equality holds when $a - b = 0 \\implies a = b$.".
   - الجذور التربيعية والتكعيبية (مهم جداً): اكتب كل جذر بصيغة "$\\sqrt{...}$" (وللجذر التكعيبي أو النوني "$\\sqrt[3]{...}$" أو "$\\sqrt[n]{...}$") باستخدام الشرطتين المائلتين \\ والأقواس المعقوفة {} وليس (). ممنوع منعاً باتاً كتابة كلمة sqrt بدون الشرطتين المائلتين \\ أو بدون علامتي $ (ممنوع "sqrt(x)" أو "$sqrt(x)$" أو "\\sqrt(x)" أو "√x"؛ الصحيح دائماً هو "$\\sqrt{x}$" أو "$\\sqrt{X + 5}$").
   - ممنوع منعاً باتاً ترك أي أس أو جذر أو كسر أو رمز رياضي بدون علامتي $ (ممنوع كتابة X^2 أو x^2 أو x_1 أو a/b أو \\frac{a}{b} أو \\geq أو \\implies أو sqrt(x) كنص عادي بدون $...$).
   - ممنوع استخدام رموز الأسس والجذور النصية مثل ² أو ³ أو √ أو ÷ أو × أو ≥ أو ≤؛ استبدلها دائماً بصيغة LaTeX داخل $...$ (مثل "$X^2$" و "$x^3$" و "$\\sqrt{x}$" و "$\\div$" و "$\\times$" و "$\\geq$" و "$\\leq$").
   - افصل النص عن المعادلة: اكتب الكلمات العربية أو الإنجليزية الشارحة خارج $...$ وضع التعبيرات والرموز الرياضية فقط داخل $...$ (مثال عربي صحيح: "إذا كانت $\\sqrt{X^2 + 9} = 5$، فإن $X = \\pm 4$"، ومثال إنجليزي صحيح: "If $a > 0$ and $b > 0$, prove that $\\sqrt{2(a^2 + b^2)} \\geq a + b$").
   - قاعدة الهروب في JSON (Double Backslash): داخل نصوص JSON يجب كتابة شرطتين مائلتين \\ قبل كل أمر LaTeX حتى يظل كود JSON صالحاً ولا تتلف أوامر مثل \\frac و \\geq و \\leq و \\implies و \\left و \\right و \\sqrt و \\times و \\theta و \\neq (مثال صحيح: "$\\frac{1}{2}$" و "$\\geq 0$" و "$\\sqrt{x}$" و "$180^\\circ$"، وللمصفوفات "$\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}$"، وممنوع كتابة شرطة واحدة مثل "\frac" أو "\geq" أو "\sqrt" أو "\times").
   - استخدم \n للانتقال لسطر جديد داخل "model_answer" بدلاً من كسر السطر الفعلي داخل نص JSON، وممنوع وضع علامات (backticks) حول المعادلات.
4. منع وسوم البحث تماماً:
   - ممنوع منعاً باتاً تضمين أي علامات توثيق بحثية مثل [span_x] أو (start_span) أو (end_span).
5. بيانات الدرس والصف:
   - "lesson": اسم أو رقم الدرس المكتوب في رأس الورقة أو المستنتج من محتوى السؤال (مثال: "الدرس الأول: نظرية ذات الحدين").
   - "topic": اسم الفرع أو الوحدة (مثال: "الجبر"، "التفاضل والتكامل"، "الهندسة"، "الفيزياء").
   - "grade": الصف الدراسي إذا كان مذكوراً في رأس الورقة (مثال: "الصف الأول الثانوي"، "الصف الثاني الثانوي"، "الصف الثالث الثانوي").
   - "difficulty": مستوى الصعوبة التقديري ("easy" أو "medium" أو "hard").
   - "marks": درجة السؤال (رقم صحيح مثلاً 1 للاختياري، و 2 أو 3 أو 4 للمقالي).
6. صيغة الإخراج: أخرج فقط كود JSON صالح يبدأ بـ { وينتهي بـ } بدون أي مقدمات أو نصوص خارج الكود.`

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
  lesson?: string | null
  difficulty?: string | null
  model_answer?: string | null
}

interface Props {
  questions: QuestionBankItem[]
  groups?: GroupItem[]
  onAddQuestion: (q: Omit<QuestionBankItem, 'id'>) => Promise<void>
  onBatchAddQuestions: (qList: Omit<QuestionBankItem, 'id'>[]) => Promise<void>
  onDeleteQuestion: (id: string) => Promise<void>
  onUpdateQuestion?: (id: string, q: Partial<QuestionBankItem>) => Promise<void>
  onUploadImage?: (file: Blob, fileName: string) => Promise<string>
  teacherStatus: TeacherStatus
}

export function QuestionsView({
  questions,
  groups = [],
  onAddQuestion,
  onBatchAddQuestions,
  onDeleteQuestion,
  onUpdateQuestion,
  onUploadImage,
  teacherStatus,
}: Props) {
  const [searchTerm, setSearchTerm] = useState('')
  const [gradeFilter, setGradeFilter] = useState('all')
  const [groupFilter, setGroupFilter] = useState('all')
  const [lessonFilter, setLessonFilter] = useState('all')

  // Group selection states
  const [importTargetGroup, setImportTargetGroup] = useState<string>(groups[0]?.id || '')
  const [manualTargetGroup, setManualTargetGroup] = useState<string>(groups[0]?.id || '')

  // Manual / Edit Question Modal State
  const [manualModalOpen, setManualModalOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<QuestionBankItem | null>(null)
  const [questionType, setQuestionType] = useState<'mcq' | 'essay'>('mcq')
  const [body, setBody] = useState('')
  const [modelAnswer, setModelAnswer] = useState('')
  const [options, setOptions] = useState<string[]>(['', '', '', ''])
  const [correctIdx, setCorrectIdx] = useState(0)
  const [marks, setMarks] = useState(1)
  const [grade, setGrade] = useState('الصف الأول الثانوي')
  const [topic, setTopic] = useState('')
  const [lesson, setLesson] = useState('')
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [existingImagePath, setExistingImagePath] = useState<string | null>(null)
  const [loadingAdd, setLoadingAdd] = useState(false)

  // Open modal for adding new question
  const handleOpenAdd = () => {
    setEditingQuestion(null)
    setQuestionType('mcq')
    setBody('')
    setModelAnswer('')
    setOptions(['', '', '', ''])
    setCorrectIdx(0)
    setMarks(1)
    setGrade(groups[0]?.grade || 'الصف الأول الثانوي')
    setManualTargetGroup(groups[0]?.id || '')
    setLesson('')
    setTopic('')
    setDifficulty('medium')
    setImageFile(null)
    setImagePreviewUrl(null)
    setExistingImagePath(null)
    setManualModalOpen(true)
  }

  // Open modal for editing existing question
  const handleOpenEdit = (q: QuestionBankItem) => {
    setEditingQuestion(q)
    setQuestionType(q.type || 'mcq')
    setBody(q.body)
    setModelAnswer(
      q.model_answer ||
        (Array.isArray(q.correct) && typeof q.correct[0] === 'string' ? q.correct[0] : '')
    )
    setOptions(q.options && q.options.length >= 2 ? [...q.options] : ['', '', '', ''])
    setCorrectIdx(
      q.correct && q.correct.length > 0 && typeof q.correct[0] === 'number' ? q.correct[0] : 0
    )
    setMarks(q.marks || 1)
    setGrade(q.grade || 'الصف الأول الثانوي')

    const matchedGroup = groups.find(
      (g) => (q.topic && q.topic.includes(g.name)) || g.grade === q.grade
    )
    if (matchedGroup) {
      setManualTargetGroup(matchedGroup.id)
    } else if (q.grade) {
      setManualTargetGroup(`grade:${q.grade}`)
    }

    const qLesson = q.lesson || extractLessonFromTopic(q.topic) || ''
    setLesson(qLesson)

    const topicParts = (q.topic || '').split('|').map((p) => p.trim())
    const cleanTopic =
      topicParts.find(
        (p) =>
          p !== qLesson &&
          !p.startsWith('الدرس') &&
          !groups.some((g) => g.name === p)
      ) || ''
    setTopic(cleanTopic)

    setDifficulty((q.difficulty as any) || 'medium')
    setImageFile(null)
    setImagePreviewUrl(null)
    setExistingImagePath(q.image_path || null)
    setManualModalOpen(true)
  }

  // Close manual modal and reset edit state
  const handleCloseManualModal = () => {
    setManualModalOpen(false)
    setEditingQuestion(null)
    setExistingImagePath(null)
    setImageFile(null)
    setImagePreviewUrl(null)
  }

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

  // Compute unique lessons for the currently filtered grade / group
  const availableLessons = React.useMemo(() => {
    const set = new Set<string>()
    questions.forEach((q) => {
      const matchesGrade = gradeFilter === 'all' || q.grade === gradeFilter
      const matchesGroup =
        groupFilter === 'all' ||
        (q.topic && q.topic.includes(groupFilter)) ||
        q.grade === groupFilter

      if (matchesGrade && matchesGroup) {
        const l = q.lesson || extractLessonFromTopic(q.topic)
        if (l && l.trim()) {
          set.add(l.trim())
        }
      }
    })
    return Array.from(set).sort()
  }, [questions, gradeFilter, groupFilter])

  // Filtered list
  const filteredQuestions = questions.filter((q) => {
    const qLesson = q.lesson || extractLessonFromTopic(q.topic)
    const matchesSearch =
      q.body.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.topic && q.topic.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (qLesson && qLesson.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesGrade = gradeFilter === 'all' || q.grade === gradeFilter
    const matchesGroup =
      groupFilter === 'all' ||
      (q.topic && q.topic.includes(groupFilter)) ||
      q.grade === groupFilter
    const matchesLesson = lessonFilter === 'all' || qLesson === lessonFilter
    return matchesSearch && matchesGrade && matchesGroup && matchesLesson
  })

  // Submit Single Question (Add or Update)
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
      let uploadedImagePath: string | null | undefined = existingImagePath

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
      const finalTopic = formatQuestionTopic(groupPrefix, topic.trim(), lesson.trim())

      const questionPayload = {
        body: cleanGeminiArtifacts(body.trim()),
        type: questionType,
        options: questionType === 'mcq' ? validOptions.map(cleanGeminiOption) : [],
        correct: questionType === 'mcq' ? [correctIdx >= validOptions.length ? 0 : correctIdx] : [],
        marks,
        grade: finalGrade,
        lesson: lesson.trim() || undefined,
        topic: finalTopic || undefined,
        difficulty,
        image_path: uploadedImagePath,
        model_answer: questionType === 'essay' && modelAnswer.trim() ? cleanGeminiArtifacts(modelAnswer.trim()) : undefined,
      }

      if (editingQuestion && onUpdateQuestion) {
        await onUpdateQuestion(editingQuestion.id, questionPayload)
      } else {
        await onAddQuestion(questionPayload)
      }

      // Reset form
      setBody('')
      setModelAnswer('')
      setOptions(['', '', '', ''])
      setCorrectIdx(0)
      setLesson('')
      setTopic('')
      setImageFile(null)
      setImagePreviewUrl(null)
      setExistingImagePath(null)
      setEditingQuestion(null)
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
          const qLesson = p.lesson || extractLessonFromTopic(p.topic)
          const finalTopic = formatQuestionTopic(groupPrefix, p.topic, qLesson)
          return {
            body: cleanGeminiArtifacts(p.body),
            type: p.type === 'essay' ? ('essay' as const) : ('mcq' as const),
            options: p.type === 'essay' ? [] : p.options.map(cleanGeminiOption),
            correct: p.type === 'essay' ? [] : p.correct,
            marks: p.marks,
            grade: finalGrade || p.grade || 'الصف الأول الثانوي',
            lesson: qLesson || undefined,
            topic: finalTopic || undefined,
            difficulty: p.difficulty,
            image_path: p.image_path,
            model_answer: p.model_answer ? cleanGeminiArtifacts(p.model_answer) : undefined,
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
    <div className="min-w-0 space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h2 className="text-xl font-extrabold text-[#153b68]">بنك الأسئلة</h2>
          <p className="text-xs text-slate-500">
            مستودع الأسئلة والاختيارات المتعددة (MCQ) مع إمكانية إعادة استخدامها وتوليد الاختبارات
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setImportModalOpen(true)}
            disabled={!teacherStatus.isActive}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50"
          >
            <Upload className="size-4 text-[#1d5ca8]" />
            <span>استيراد (JSON / Excel)</span>
          </button>

          <button
            onClick={handleOpenAdd}
            disabled={!teacherStatus.isActive}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1d5ca8] px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#164e93] disabled:opacity-50"
          >
            <Plus className="size-4" />
            <span>إضافة سؤال يدوي</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute right-3 top-2.5 size-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث في نص الأسئلة أو الموضوعات..."
            className="w-full rounded-xl bg-slate-50 py-2 pr-9 pl-3 text-xs outline-hidden focus:bg-white focus:ring-1 focus:ring-[#1d5ca8]"
          />
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {groups.length > 0 && (
            <div className="flex max-w-full items-center gap-1.5">
              <span className="shrink-0 text-xs font-bold text-slate-400">المجموعة:</span>
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="max-w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-hidden"
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

          <div className="flex max-w-full items-center gap-1.5">
            <span className="shrink-0 text-xs font-bold text-slate-400">المرحلة:</span>
            <select
              value={gradeFilter}
              onChange={(e) => {
                setGradeFilter(e.target.value)
                setLessonFilter('all')
              }}
              className="max-w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-hidden"
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

          {availableLessons.length > 0 && (
            <div className="flex w-full max-w-full items-center gap-1.5 sm:w-auto">
              <span className="shrink-0 text-xs font-bold text-slate-400">الدرس:</span>
              <select
                value={lessonFilter}
                onChange={(e) => setLessonFilter(e.target.value)}
                className="min-w-0 flex-1 truncate rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-hidden sm:max-w-[200px]"
              >
                <option value="all">كل الدروس ({availableLessons.length})</option>
                {availableLessons.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Questions List */}
      <div className="grid gap-3 sm:grid-cols-2">
        {filteredQuestions.map((q, qIndex) => {
          const qLesson = q.lesson || extractLessonFromTopic(q.topic)
          return (
            <div
              key={q.id}
              className="flex min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                    <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                      q.type === 'essay' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {q.type === 'essay' ? 'سؤال مقالي' : 'اختيار من متعدد'}
                    </span>
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-[#1d5ca8]">
                      {q.grade || 'عام'}
                    </span>
                    {qLesson && (
                      <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-emerald-200/70 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-800 break-words">
                        <BookMarked className="size-3 shrink-0 text-emerald-600" />
                        <span className="min-w-0 break-words">{qLesson}</span>
                      </span>
                    )}
                    {q.topic && q.topic.includes('|') ? (
                      <>
                        <span className="max-w-full break-words rounded-md bg-purple-50 px-2 py-0.5 text-xs font-bold text-purple-700">
                          👥 {q.topic.split('|')[0].trim()}
                        </span>
                        {q.topic.split('|')[1]?.trim() && q.topic.split('|')[1]?.trim() !== qLesson && (
                          <span className="max-w-full break-words rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                            {q.topic.split('|')[1].trim()}
                          </span>
                        )}
                      </>
                    ) : q.topic && q.topic !== qLesson ? (
                      <span className="max-w-full break-words rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                        {q.topic}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <span className="text-xs font-bold text-slate-500 ml-1">{q.marks || 1} درجة</span>
                    <button
                      onClick={() => handleOpenEdit(q)}
                      disabled={!teacherStatus.isActive}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-[#1d5ca8] transition disabled:opacity-30"
                      title="تعديل السؤال وإضافة أو تعديل الصورة"
                    >
                      <Edit3 className="size-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('هل أنت متأكد من حذف هذا السؤال من البنك؟')) {
                          onDeleteQuestion(q.id)
                        }
                      }}
                      disabled={!teacherStatus.isActive}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition disabled:opacity-30"
                      title="حذف السؤال"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>

                {/* Question Text (rendered with MathRenderer for math formulas & span cleaning) */}
                <MathRenderer
                  text={q.body}
                  as="p"
                  className="mt-3 text-sm font-bold text-slate-800 leading-relaxed"
                />

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
                  <div className="mt-3.5 min-w-0 max-w-full overflow-hidden rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-amber-800">
                      <span>✍️ سؤال مقالي (تصحيح يدوي من المعلم)</span>
                    </div>
                    {q.model_answer && (
                      <div className="mt-2 min-w-0 text-slate-700 leading-relaxed">
                        <span className="font-bold text-slate-900">نموذج الإجابة: </span>
                        <MathRenderer text={q.model_answer} as="span" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-3.5 min-w-0 space-y-1.5">
                    {(q.options || []).map((opt, oIdx) => {
                      const isCorrect = q.correct?.includes(oIdx)
                      return (
                        <div
                          key={oIdx}
                          className={`flex min-w-0 items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
                            isCorrect
                              ? 'border border-emerald-300 bg-emerald-50 text-emerald-800'
                              : 'bg-slate-50 text-slate-600'
                          }`}
                        >
                          <MathRenderer text={opt} as="span" className="min-w-0 flex-1" />
                          {isCorrect && (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 shrink-0 mr-2">
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
          )
        })}

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

      {/* Manual Add / Edit Question Modal */}
      <Modal
        isOpen={manualModalOpen}
        onClose={handleCloseManualModal}
        title={editingQuestion ? 'تعديل بيانات السؤال' : 'إضافة سؤال جديد لبنك الأسئلة'}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <label className="mb-1 block text-xs font-bold text-slate-700">
                اسم أو رقم الدرس <span className="text-[#1d5ca8] font-normal">(للتوزيع العشوائي في الاختبارات)</span>
              </label>
              <input
                type="text"
                value={lesson}
                onChange={(e) => setLesson(e.target.value)}
                placeholder="مثال: الدرس الأول: نظرية ذات الحدين أو 1"
                className="w-full rounded-xl border border-slate-200 p-2 text-xs outline-hidden focus:border-[#1d5ca8]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">الوحدة / الفرع (اختياري)</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="مثال: الجبر أو الهندسة"
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

          {/* Image attachment / modification */}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              صورة توضيحية / مسألة (اختياري)
            </label>

            {/* Current saved image if editing */}
            {existingImagePath && !imagePreviewUrl && (
              <div className="mb-2.5 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                <div className="flex items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={existingImagePath}
                    alt="صورة السؤال الحالية"
                    className="h-14 w-14 rounded-lg border border-slate-200 bg-white object-contain p-1 shadow-2xs"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-700">الصورة الحالية للسؤال</p>
                    <p className="text-[11px] text-slate-400">يمكنك الإبقاء عليها أو استبدالها بصورة جديدة أدناه</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setExistingImagePath(null)}
                  className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100 transition"
                >
                  حذف الصورة
                </button>
              </div>
            )}

            {/* New chosen image preview */}
            {imagePreviewUrl && (
              <div className="mb-2.5 flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/60 p-2.5">
                <div className="flex items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreviewUrl}
                    alt="معاينة الصورة الجديدة"
                    className="h-14 w-14 rounded-lg border border-blue-200 bg-white object-contain p-1 shadow-2xs"
                  />
                  <div>
                    <p className="text-xs font-bold text-[#153b68]">تم اختيار صورة جديدة</p>
                    <p className="text-[11px] text-slate-500">سيتم ضغطها ورفعها مع حفظ السؤال</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setImageFile(null)
                    setImagePreviewUrl(null)
                  }}
                  className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100 transition"
                >
                  إلغاء الصورة الجديدة
                </button>
              </div>
            )}

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
              className="w-full text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#1d5ca8] hover:file:bg-slate-200"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              يتم ضغط الصورة تلقائياً لتوفير مساحة التخزين وتكون بحجم مناسب ومقروء للطالب في الامتحانات.
            </p>
          </div>

          <div className="mt-5 flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleCloseManualModal}
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
              {editingQuestion ? 'حفظ التعديلات' : 'حفظ في البنك'}
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
                  انسخ البرومبت والصقه في Gemini أو ChatGPT مع <strong>صورة لورقة الامتحان/المذكرة أو نص الدرس</strong>، وسيقوم بقراءة كافة الأسئلة (اختيار من متعدد، صواب وخطأ، أسئلة مقالية ومسائل بالخطوات) وتوليدها بصيغة JSON فوراً لتلصقها هنا.
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
              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 p-2 text-xs space-y-2">
                {parsedPreview.map((p, i) => {
                  const pLesson = p.lesson || extractLessonFromTopic(p.topic)
                  const isEssay = p.type === 'essay'
                  const isTrueFalse = !isEssay && p.options.length === 2 && (p.options.includes('صواب') || p.options.includes('True') || p.options.includes('صح'))
                  return (
                    <div key={i} className="border-b pb-2 last:border-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-slate-800 flex-1 min-w-0">
                          <span className="ml-1 text-slate-500">{i + 1}.</span>
                          <span className={`ml-1.5 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                            isEssay
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : isTrueFalse
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : 'bg-blue-100 text-[#1d5ca8] border border-blue-200'
                          }`}>
                            {isEssay ? 'مقالي' : isTrueFalse ? 'صواب وخطأ' : 'اختيار من متعدد'}
                          </span>
                          <MathRenderer text={p.body} as="span" />
                        </div>
                        {pLesson && (
                          <span className="shrink-0 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200/60">
                            📖 {pLesson}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        {isEssay ? (
                          <p className="text-amber-800 line-clamp-1">
                            {p.model_answer ? (
                              <>
                                الإجابة النموذجية: <MathRenderer text={p.model_answer} as="span" />
                              </>
                            ) : (
                              'بدون إجابة نموذجية'
                            )}
                          </p>
                        ) : (
                          <p>
                            الخيارات ({p.options.length}) · الدرجة: {p.marks}
                            {p.grade && <span> · {p.grade}</span>}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
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
