'use client'

import React, { useState, useTransition } from 'react'
import {
  Plus,
  FileSpreadsheet,
  Search,
  MoveRight,
  Trash2,
  Phone,
  Key,
  GraduationCap,
  Loader2,
  AlertCircle,
  Check,
} from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { generateAccessCode } from '@/lib/access-code'
import { parseExcelStudents } from '@/lib/student-parser'
import type { GroupItem } from '../groups/GroupsView'
import type { TeacherStatus } from '@/lib/teacher-status'

export interface StudentItem {
  id: string
  full_name: string
  parent_phone: string
  grade: string
  group_id: string | null
  group_name?: string
  access_code: string
}

interface Props {
  students: StudentItem[]
  groups: GroupItem[]
  onAddStudent: (student: Omit<StudentItem, 'id'>) => Promise<void>
  onBatchImport: (studentsList: Omit<StudentItem, 'id'>[]) => Promise<void>
  onMoveStudent: (studentId: string, newGroupId: string) => Promise<void>
  onDeleteStudent: (studentId: string) => Promise<void>
  teacherStatus: TeacherStatus
}

export function StudentsView({
  students,
  groups,
  onAddStudent,
  onBatchImport,
  onMoveStudent,
  onDeleteStudent,
  teacherStatus,
}: Props) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterGroup, setFilterGroup] = useState<string>('all')

  // Add modal state
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [fullName, setFullName] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [grade, setGrade] = useState(groups[0]?.grade || 'الصف الأول الثانوي')
  const [groupId, setGroupId] = useState(groups[0]?.id || '')
  const [accessCode, setAccessCode] = useState(generateAccessCode(5))
  const [loadingAdd, setLoadingAdd] = useState(false)

  // Move modal state
  const [moveModalOpen, setMoveModalOpen] = useState(false)
  const [selectedStudentForMove, setSelectedStudentForMove] = useState<StudentItem | null>(null)
  const [targetGroupId, setTargetGroupId] = useState('')
  const [loadingMove, setLoadingMove] = useState(false)
  const [moveError, setMoveError] = useState<string | null>(null)

  // Excel import modal state
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [importedPreview, setImportedPreview] = useState<Omit<StudentItem, 'id'>[]>([])

  // Filter students
  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.parent_phone.includes(searchTerm) ||
      s.access_code.includes(searchTerm)
    const matchesGroup = filterGroup === 'all' || s.group_id === filterGroup
    return matchesSearch && matchesGroup
  })

  // Submit Single Student
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim() || !parentPhone.trim()) return

    setLoadingAdd(true)
    try {
      await onAddStudent({
        full_name: fullName.trim(),
        parent_phone: parentPhone.trim(),
        grade,
        group_id: groupId || null,
        access_code: accessCode,
      })
      setFullName('')
      setParentPhone('')
      setAccessCode(generateAccessCode(5))
      setAddModalOpen(false)
    } catch (err) {
      console.error(err)
      alert('فشل إضافة الطالب')
    } finally {
      setLoadingAdd(false)
    }
  }

  // Handle Excel File Selected
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    setImportErrors([])
    try {
      const buffer = await file.arrayBuffer()
      const defaultGrade = groups.find((g) => g.id === groupId)?.grade
      const result = await parseExcelStudents(buffer, defaultGrade)

      if (result.errors.length > 0) {
        setImportErrors(result.errors)
      }

      const previewList = result.students.map((s) => ({
        ...s,
        group_id: groupId || null,
      }))
      setImportedPreview(previewList)
    } catch (err) {
      console.error(err)
      setImportErrors(['فشل قراءة ملف Excel'])
    } finally {
      setImporting(false)
    }
  }

  // Save imported students
  const handleConfirmImport = async () => {
    if (!importedPreview.length) return
    setImporting(true)
    try {
      await onBatchImport(importedPreview)
      setImportModalOpen(false)
      setImportedPreview([])
      alert(`تم استيراد ${importedPreview.length} طالب بنجاح!`)
    } catch (err) {
      console.error(err)
      alert('حدث خطأ أثناء حفظ الطلاب المستوردين')
    } finally {
      setImporting(false)
    }
  }

  // Execute Move Student
  const handleMoveSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStudentForMove || !targetGroupId) return

    setMoveError(null)
    const targetGroup = groups.find((g) => g.id === targetGroupId)
    if (!targetGroup) return

    // 1. Same grade rule check
    if (targetGroup.grade !== selectedStudentForMove.grade) {
      setMoveError(`لا يمكن النقل: مجموعة الهدف من (${targetGroup.grade}) بينما الطالب (${selectedStudentForMove.grade})`)
      return
    }

    // 2. Capacity check
    const currentOccupancy = targetGroup.studentCount || 0
    if (currentOccupancy >= targetGroup.capacity) {
      setMoveError(`لا يمكن النقل: مجموعة الهدف مكتملة السعة (${currentOccupancy} من ${targetGroup.capacity})`)
      return
    }

    setLoadingMove(true)
    try {
      await onMoveStudent(selectedStudentForMove.id, targetGroupId)
      setMoveModalOpen(false)
      setSelectedStudentForMove(null)
    } catch (err) {
      console.error(err)
      setMoveError('فشل نقل الطالب')
    } finally {
      setLoadingMove(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-extrabold text-[#153b68]">قائمة الطلاب</h2>
          <p className="text-xs text-slate-500">
            إدارة بيانات الطلاب، أكواد الدخول للاختبارات، والنقل بين المجموعات
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportModalOpen(true)}
            disabled={!teacherStatus.isActive}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50"
          >
            <FileSpreadsheet className="size-4 text-emerald-600" />
            <span>استيراد Excel</span>
          </button>

          <button
            onClick={() => {
              setAccessCode(generateAccessCode(5))
              setAddModalOpen(true)
            }}
            disabled={!teacherStatus.isActive}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1d5ca8] px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#164e93] disabled:opacity-50"
          >
            <Plus className="size-4" />
            <span>إضافة طالب</span>
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
            placeholder="بحث بالاسم، رقم ولي الأمر، أو كود الطالب..."
            className="w-full rounded-xl bg-slate-50 py-2 pr-9 pl-3 text-xs outline-hidden focus:bg-white focus:ring-1 focus:ring-[#1d5ca8]"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400">تصفية:</span>
          <select
            value={filterGroup}
            onChange={(e) => setFilterGroup(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-hidden"
          >
            <option value="all">كل المجموعات</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.grade})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Students Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold">
              <tr>
                <th className="p-3.5">اسم الطالب</th>
                <th className="p-3.5">المرحلة الدراسية</th>
                <th className="p-3.5">المجموعة</th>
                <th className="p-3.5">هاتف ولي الأمر</th>
                <th className="p-3.5">كود الاختبار</th>
                <th className="p-3.5 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.map((st) => (
                <tr key={st.id} className="hover:bg-slate-50/80 transition">
                  <td className="p-3.5 font-bold text-slate-800">{st.full_name}</td>
                  <td className="p-3.5 text-slate-600">{st.grade}</td>
                  <td className="p-3.5">
                    {st.group_name ? (
                      <span className="rounded-lg bg-blue-50 px-2 py-1 font-bold text-[#1d5ca8]">
                        {st.group_name}
                      </span>
                    ) : (
                      <span className="text-slate-400">بدون مجموعة</span>
                    )}
                  </td>
                  <td className="p-3.5 text-slate-600" dir="ltr">
                    {st.parent_phone}
                  </td>
                  <td className="p-3.5">
                    <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                      {st.access_code}
                    </span>
                  </td>
                  <td className="p-3.5">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => {
                          setSelectedStudentForMove(st)
                          setTargetGroupId(groups.find((g) => g.id !== st.group_id)?.id || '')
                          setMoveModalOpen(true)
                        }}
                        disabled={!teacherStatus.isActive}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-blue-50 hover:text-[#1d5ca8] transition disabled:opacity-30"
                        title="نقل الطالب لمجموعة أخرى"
                      >
                        <MoveRight className="size-4" />
                      </button>

                      <button
                        onClick={() => {
                          if (confirm(`هل أنت متأكد من حذف الطالب "${st.full_name}"؟`)) {
                            onDeleteStudent(st.id)
                          }
                        }}
                        disabled={!teacherStatus.isActive}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition disabled:opacity-30"
                        title="حذف الطالب"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    لا يوجد طلاب يطابقون شروط البحث
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Student Modal */}
      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="إضافة طالب جديد">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">اسم الطالب رباعي</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="مثال: يوسف أحمد محمد علي"
              className="w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-hidden focus:border-[#1d5ca8]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">هاتف ولي الأمر</label>
              <input
                type="tel"
                required
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                placeholder="01012345678"
                className="w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-hidden focus:border-[#1d5ca8]"
                dir="ltr"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">كود الدخول للاختبار</label>
              <input
                type="text"
                required
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-mono text-sm font-bold text-center outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">المجموعة الدراسية</label>
            <select
              value={groupId}
              onChange={(e) => {
                const gId = e.target.value
                setGroupId(gId)
                const selected = groups.find((g) => g.id === gId)
                if (selected) setGrade(selected.grade)
              }}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-hidden focus:border-[#1d5ca8]"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.grade}) - {g.studentCount || 0}/{g.capacity} طالب
                </option>
              ))}
            </select>
          </div>

          <div className="mt-5 flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAddModalOpen(false)}
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
              حفظ الطالب
            </button>
          </div>
        </form>
      </Modal>

      {/* Move Student Modal */}
      <Modal
        isOpen={moveModalOpen}
        onClose={() => setMoveModalOpen(false)}
        title={`نقل الطالب: ${selectedStudentForMove?.full_name || ''}`}
      >
        <form onSubmit={handleMoveSubmit} className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-3 text-xs space-y-1">
            <p>
              المرحلة الحالية: <span className="font-bold">{selectedStudentForMove?.grade}</span>
            </p>
            <p className="text-slate-400">
              * قاعدة النقل: يجب أن تكون المجموعة المستهدفة من نفس المرحلة الدراسية وتتسع للطالب.
            </p>
          </div>

          {moveError && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
              <AlertCircle className="size-4 shrink-0" />
              <span>{moveError}</span>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">اختر المجموعة المستهدفة</label>
            <select
              value={targetGroupId}
              onChange={(e) => setTargetGroupId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-hidden focus:border-[#1d5ca8]"
            >
              <option value="">-- حدد المجموعة --</option>
              {groups
                .filter((g) => g.id !== selectedStudentForMove?.group_id)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.grade}) - سعة: {g.studentCount || 0}/{g.capacity}
                  </option>
                ))}
            </select>
          </div>

          <div className="mt-5 flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setMoveModalOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loadingMove || !targetGroupId}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1d5ca8] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#164e93] disabled:opacity-50"
            >
              {loadingMove && <Loader2 className="size-3.5 animate-spin" />}
              تأكيد نقل الطالب
            </button>
          </div>
        </form>
      </Modal>

      {/* Excel Import Modal */}
      <Modal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="استيراد قائمة الطلاب من ملف Excel"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            يمكنك رفع ملف إكسيل يحتوي على أعمدة (اسم الطالب، هاتف ولي الأمر، الصف). سيقوم النظام تلقائياً
            بتوليد أكواد دخول شخصية لكل طالب.
          </p>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              إضافة الطلاب إلى مجموعة:
            </label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2 text-xs outline-hidden"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.grade})
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center hover:border-[#1d5ca8]">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
              id="studentExcelFileInput"
            />
            <label htmlFor="studentExcelFileInput" className="cursor-pointer">
              <FileSpreadsheet className="mx-auto size-8 text-emerald-600" />
              <p className="mt-2 text-xs font-bold text-slate-700">انقر هنا لاختيار ملف Excel</p>
              <p className="text-[11px] text-slate-400">يدعم صيغ .xlsx و .xls و .csv</p>
            </label>
          </div>

          {importing && (
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-[#1d5ca8]">
              <Loader2 className="size-4 animate-spin" />
              جاري معالجة الملف...
            </div>
          )}

          {importErrors.length > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 space-y-1">
              <p className="font-bold">تنبيهات أثناء قراءة الملف:</p>
              {importErrors.map((err, i) => (
                <p key={i}>• {err}</p>
              ))}
            </div>
          )}

          {importedPreview.length > 0 && (
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>معاينة البيانات ({importedPreview.length} طالب):</span>
              </div>
              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 p-2">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b">
                      <th className="p-1">الاسم</th>
                      <th className="p-1">الهاتف</th>
                      <th className="p-1">كود مقترح</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importedPreview.map((p, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="p-1 font-semibold">{p.full_name}</td>
                        <td className="p-1" dir="ltr">
                          {p.parent_phone}
                        </td>
                        <td className="p-1 font-mono font-bold text-[#1d5ca8]">
                          {p.access_code}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setImportModalOpen(false)
                    setImportedPreview([])
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  className="rounded-xl bg-[#1d5ca8] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#164e93]"
                >
                  حفظ وإضافة الطلاب للدفعة
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
