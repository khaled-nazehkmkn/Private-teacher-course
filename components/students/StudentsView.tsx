'use client'

import React, { useState } from 'react'
import {
  Plus,
  FileSpreadsheet,
  Search,
  MoveRight,
  Trash2,
  Phone,
  Copy,
  Check,
  Key,
  GraduationCap,
  Loader2,
  AlertCircle,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
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
  onFinalizeNewYear?: () => Promise<void>
  isNewYearPrep?: boolean
}

export function StudentsView({
  students,
  groups,
  onAddStudent,
  onBatchImport,
  onMoveStudent,
  onDeleteStudent,
  teacherStatus,
  onFinalizeNewYear,
  isNewYearPrep = false,
}: Props) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterGroup, setFilterGroup] = useState<string>('all')
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null)

  // Unassigned students count
  const unassignedCount = students.filter((s) => !s.group_id).length

  // Finalize New Year modal state
  const [finalizeModalOpen, setFinalizeModalOpen] = useState(false)
  const [loadingFinalize, setLoadingFinalize] = useState(false)

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
    const matchesGroup =
      filterGroup === 'all'
        ? true
        : filterGroup === 'unassigned'
        ? !s.group_id
        : s.group_id === filterGroup
    return matchesSearch && matchesGroup
  })

  // Copy code helper
  const handleCopyCode = async (stId: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCodeId(stId)
      setTimeout(() => setCopiedCodeId(null), 1800)
    } catch (e) {
      console.error(e)
    }
  }

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

  // Execute Move / Assign Student
  const handleMoveSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStudentForMove || !targetGroupId) return

    setMoveError(null)
    const targetGroup = groups.find((g) => g.id === targetGroupId)
    if (!targetGroup) return

    // Capacity check
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
      setMoveError('فشل نقل / تسكين الطالب')
    } finally {
      setLoadingMove(false)
    }
  }

  const handleConfirmFinalize = async () => {
    if (!onFinalizeNewYear) return
    setLoadingFinalize(true)
    try {
      await onFinalizeNewYear()
      setFinalizeModalOpen(false)
    } catch (err: any) {
      console.error(err)
      alert(err?.message || 'فشل بدء العام الجديد وحذف الطلاب')
    } finally {
      setLoadingFinalize(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* New Year Preparation Banner */}
      {(isNewYearPrep || unassignedCount > 0) && (
        <div className="rounded-2xl border-2 border-amber-300 bg-linear-to-r from-amber-50 to-orange-50 p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-amber-500/15 p-2.5 text-amber-700 shrink-0">
                <GraduationCap className="size-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-black text-amber-950">
                    مرحلة إعداد العام الدراسي الجديد
                  </h3>
                  <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-black text-amber-800">
                    {unassignedCount} طالب بانتظار التسكين
                  </span>
                </div>
                <p className="mt-1 text-xs text-amber-900/80 leading-relaxed">
                  لديك <strong>{unassignedCount}</strong> طالب بدون مجموعة. قم بتسكين الطلاب المستمرين بالضغط على "تسكين في مجموعة".
                  وعندما تنتهي وتصبح جاهزاً، اضغط على زر <strong>بدء العام وحذف غير المسجلين</strong>.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-end sm:self-center shrink-0">
              <button
                type="button"
                onClick={() => setFilterGroup('unassigned')}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                  filterGroup === 'unassigned'
                    ? 'border-amber-500 bg-amber-500 text-white shadow-xs'
                    : 'border-amber-300 bg-white text-amber-900 hover:bg-amber-100 shadow-2xs'
                }`}
              >
                <span>عرض الطلاب غير المسكنين ({unassignedCount})</span>
              </button>

              {onFinalizeNewYear && (
                <button
                  type="button"
                  onClick={() => setFinalizeModalOpen(true)}
                  disabled={!teacherStatus.isActive}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-amber-700 transition disabled:opacity-50"
                >
                  <CheckCircle2 className="size-3.5" />
                  <span>بدء العام وحذف غير المسجلين ({unassignedCount})</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-black text-[#153b68] sm:text-xl">قائمة الطلاب</h2>
          <p className="text-xs text-slate-500">
            إدارة بيانات الطلاب، أكواد الدخول للاختبارات، والنقل بين المجموعات
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportModalOpen(true)}
            disabled={!teacherStatus.isActive}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50"
          >
            <FileSpreadsheet className="size-3.5 text-emerald-600" />
            <span>استيراد Excel</span>
          </button>

          <button
            onClick={() => {
              setAccessCode(generateAccessCode(5))
              setAddModalOpen(true)
            }}
            disabled={!teacherStatus.isActive}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1d5ca8] px-3.5 py-2 text-xs font-bold text-white shadow-md hover:bg-[#164e93] disabled:opacity-50"
          >
            <Plus className="size-3.5" />
            <span>إضافة طالب</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-2.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs sm:flex-row sm:items-center">
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
          <span className="text-xs font-bold text-slate-400 shrink-0">المجموعة:</span>
          <select
            value={filterGroup}
            onChange={(e) => setFilterGroup(e.target.value)}
            className="w-full sm:w-auto rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-hidden"
          >
            <option value="all">كل الطلاب ({students.length})</option>
            {unassignedCount > 0 && (
              <option value="unassigned">⚠️ طلاب بدون مجموعة ({unassignedCount})</option>
            )}
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.grade})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* MOBILE-FIRST CARD VIEW (Visible on phones < 768px) */}
      <div className="grid gap-2.5 sm:hidden">
        {filteredStudents.map((st) => (
          <div
            key={st.id}
            className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">{st.full_name}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                    {st.grade}
                  </span>
                  {st.group_name ? (
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-[#1d5ca8]">
                      {st.group_name}
                    </span>
                  ) : (
                    <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                      بدون مجموعة
                    </span>
                  )}
                </div>
              </div>

              {/* Access Code Pill with One-Tap Copy */}
              <button
                onClick={() => handleCopyCode(st.id, st.access_code)}
                className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-mono font-bold text-slate-800 active:scale-95"
                title="نسخ كود الاختبار"
              >
                <Key className="size-3 text-[#1d5ca8]" />
                <span>{st.access_code}</span>
                {copiedCodeId === st.id ? (
                  <Check className="size-3 text-emerald-600" />
                ) : (
                  <Copy className="size-3 text-slate-400" />
                )}
              </button>
            </div>

              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                <a
                  href={`tel:${st.parent_phone}`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-[#1d5ca8]"
                  dir="ltr"
                >
                  <Phone className="size-3 text-emerald-600" />
                  <span>{st.parent_phone}</span>
                </a>

                <div className="flex items-center gap-1">
                  {!st.group_id && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStudentForMove(st)
                        setTargetGroupId(groups[0]?.id || '')
                        setMoveModalOpen(true)
                      }}
                      disabled={!teacherStatus.isActive || groups.length === 0}
                      className="rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-bold text-[#1d5ca8] hover:bg-blue-100 disabled:opacity-30"
                    >
                      تسكين
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSelectedStudentForMove(st)
                      setTargetGroupId(groups.find((g) => g.id !== st.group_id)?.id || '')
                      setMoveModalOpen(true)
                    }}
                    disabled={!teacherStatus.isActive}
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-blue-50 hover:text-[#1d5ca8] disabled:opacity-30"
                    aria-label="نقل"
                    title={st.group_id ? "نقل لمجموعة أخرى" : "تسكين في مجموعة"}
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
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                  aria-label="حذف"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredStudents.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-400">
            لا يوجد طلاب يطابقون شروط البحث
          </div>
        )}
      </div>

      {/* DESKTOP TABLE VIEW (Visible on tablets and desktop >= 768px) */}
      <div className="hidden sm:block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
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
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                          بدون مجموعة
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStudentForMove(st)
                            setTargetGroupId(groups[0]?.id || '')
                            setMoveModalOpen(true)
                          }}
                          disabled={!teacherStatus.isActive || groups.length === 0}
                          className="rounded-lg border border-[#1d5ca8]/30 bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-[#1d5ca8] hover:bg-[#1d5ca8] hover:text-white transition disabled:opacity-40"
                        >
                          تسكين الآن
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="p-3.5 text-slate-600" dir="ltr">
                    {st.parent_phone}
                  </td>
                  <td className="p-3.5">
                    <button
                      onClick={() => handleCopyCode(st.id, st.access_code)}
                      className="inline-flex items-center gap-1 font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md hover:bg-slate-200 active:scale-95"
                      title="انقر لنسخ الكود"
                    >
                      <span>{st.access_code}</span>
                      {copiedCodeId === st.id ? (
                        <Check className="size-3 text-emerald-600" />
                      ) : (
                        <Copy className="size-3 text-slate-400" />
                      )}
                    </button>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        title={
          selectedStudentForMove?.group_id
            ? `نقل الطالب: ${selectedStudentForMove?.full_name || ''}`
            : `تسكين الطالب: ${selectedStudentForMove?.full_name || ''} في مجموعة جديدة`
        }
      >
        <form onSubmit={handleMoveSubmit} className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-3 text-xs space-y-1">
            <p>
              المرحلة الحالية: <span className="font-bold">{selectedStudentForMove?.grade}</span>
            </p>
            <p className="text-slate-400">
              * سيتم تحديث مرحلة الطالب تلقائياً لتطابق المرحلة الدراسية للمجموعة المختارة.
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
              {selectedStudentForMove?.group_id ? 'تأكيد نقل الطالب' : 'تسكين الطالب في المجموعة'}
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
            يمكنك رفع ملف إكسيل يحتوي على أعمدة (اسم الطالب، هاتف ولي الأمر، الصف).
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

      {/* Finalize New Year & Purge Unassigned Students Modal */}
      <Modal
        isOpen={finalizeModalOpen}
        onClose={() => setFinalizeModalOpen(false)}
        title="تأكيد بدء العام الدراسي وحذف الطلاب غير المسجلين"
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <div className="rounded-2xl bg-amber-50 p-4 border border-amber-200 text-xs space-y-3">
            <div className="flex items-center gap-2 font-bold text-amber-950 text-sm">
              <CheckCircle2 className="size-5 text-emerald-600" />
              <span>جاهز لبدء العام الدراسي الجديد؟</span>
            </div>
            <p className="text-slate-700 leading-relaxed">
              سيقوم النظام الآن بتأكيد العام الدراسي رسمياً، وتنظيف قاعدة البيانات:
            </p>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-white p-3 border border-emerald-200">
                <span className="block text-lg font-black text-emerald-700">
                  {students.length - unassignedCount}
                </span>
                <span className="text-[11px] font-bold text-slate-600">طالب مسكن بمجموعات (سيتم الاحتفاظ بهم)</span>
              </div>
              <div className="rounded-xl bg-white p-3 border border-rose-200">
                <span className="block text-lg font-black text-rose-600">
                  {unassignedCount}
                </span>
                <span className="text-[11px] font-bold text-slate-600">طالب بدون مجموعة (سيتم حذفهم نهائياً)</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-rose-50 p-3 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
            <AlertTriangle className="size-4 shrink-0 text-rose-600 mt-0.5" />
            <span>
              تحذير: سيتم حذف جميع الطلاب غير المسجلين في أي مجموعة بشكل نهائي لتفريغ المساحة. هذا الإجراء لا يمكن التراجع عنه.
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setFinalizeModalOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              مراجعة وتسكين أولاً
            </button>
            <button
              type="button"
              onClick={handleConfirmFinalize}
              disabled={loadingFinalize}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-700 disabled:opacity-50"
            >
              {loadingFinalize && <Loader2 className="size-3.5 animate-spin" />}
              تأكيد بدء العام وحذف غير المسجلين
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
