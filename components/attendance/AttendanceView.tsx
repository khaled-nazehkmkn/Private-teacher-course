'use client'

import React, { useState, useEffect } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  XCircle,
  HelpCircle,
  Save,
  Ban,
  Loader2,
  Users,
  Plus,
  Calendar,
} from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { DatePicker } from '@/components/ui/date-picker'
import { TimePicker } from '@/components/ui/time-picker'
import { formatArabicDate } from '@/lib/occurrences'
import type { TeacherStatus } from '@/lib/teacher-status'
import type { GroupItem } from '../groups/GroupsView'
import type { StudentItem } from '../students/StudentsView'

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused'

export interface OccurrenceItem {
  id: string
  group_id: string
  session_date: string
  start_time: string
  end_time: string
  status: 'held' | 'cancelled'
}

interface Props {
  groups: GroupItem[]
  students: StudentItem[]
  occurrences: OccurrenceItem[]
  onSaveAttendance: (
    occurrenceId: string,
    records: Array<{ student_id: string; status: AttendanceStatus; note?: string }>
  ) => Promise<void>
  onToggleCancelOccurrence: (occurrenceId: string, currentStatus: 'held' | 'cancelled') => Promise<void>
  onAddOccurrence?: (newOcc: {
    group_id: string
    session_date: string
    start_time: string
    end_time: string
  }) => Promise<string | undefined>
  teacherStatus: TeacherStatus
}

export function AttendanceView({
  groups,
  students,
  occurrences,
  onSaveAttendance,
  onToggleCancelOccurrence,
  onAddOccurrence,
  teacherStatus,
}: Props) {
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groups[0]?.id || '')
  const [selectedOccurrenceId, setSelectedOccurrenceId] = useState<string>('')
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({})
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Add custom occurrence modal state
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split('T')[0])
  const [newStartTime, setNewStartTime] = useState('17:00')
  const [newEndTime, setNewEndTime] = useState('18:30')
  const [addingOccurrence, setAddingOccurrence] = useState(false)

  // Filter occurrences by group
  const groupOccurrences = occurrences.filter((o) => o.group_id === selectedGroupId)
  const currentOccurrence = occurrences.find((o) => o.id === selectedOccurrenceId)

  // Filter students by group
  const groupStudents = students.filter((s) => s.group_id === selectedGroupId)

  // Auto select occurrence when group changes
  useEffect(() => {
    if (groupOccurrences.length > 0) {
      const today = new Date().toISOString().split('T')[0]
      const matchingToday = groupOccurrences.find((o) => o.session_date === today)
      setSelectedOccurrenceId(matchingToday?.id || groupOccurrences[0].id)
    } else {
      setSelectedOccurrenceId('')
    }
  }, [selectedGroupId, occurrences])

  // Initialize all group students as 'present' by default
  useEffect(() => {
    const initialMap: Record<string, AttendanceStatus> = {}
    groupStudents.forEach((st) => {
      initialMap[st.id] = 'present'
    })
    setAttendanceMap(initialMap)
  }, [selectedOccurrenceId, selectedGroupId])

  // Set student status directly
  const setStudentStatus = (studentId: string, status: AttendanceStatus) => {
    if (!teacherStatus.isActive || currentOccurrence?.status === 'cancelled') return
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: status,
    }))
  }

  // Quick mark all as present
  const markAllPresent = () => {
    const updated: Record<string, AttendanceStatus> = {}
    groupStudents.forEach((st) => {
      updated[st.id] = 'present'
    })
    setAttendanceMap(updated)
  }

  // Handle Save
  const handleSave = async () => {
    if (!selectedOccurrenceId) return

    setSaving(true)
    setSaveSuccess(false)
    try {
      const records = groupStudents.map((st) => ({
        student_id: st.id,
        status: attendanceMap[st.id] || 'present',
      }))
      await onSaveAttendance(selectedOccurrenceId, records)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      console.error(err)
      alert('حدث خطأ أثناء حفظ كشف الحضور')
    } finally {
      setSaving(false)
    }
  }

  // Handle adding custom occurrence
  const handleCreateOccurrence = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!onAddOccurrence || !selectedGroupId) return

    setAddingOccurrence(true)
    try {
      const newId = await onAddOccurrence({
        group_id: selectedGroupId,
        session_date: newDate,
        start_time: newStartTime,
        end_time: newEndTime,
      })
      if (newId) {
        setSelectedOccurrenceId(newId)
      }
      setAddModalOpen(false)
    } catch (err) {
      console.error('Error adding session occurrence:', err)
      alert('حدث خطأ أثناء إضافة موعد الحصة')
    } finally {
      setAddingOccurrence(false)
    }
  }

  // Quick add today session
  const handleQuickAddToday = async () => {
    if (!onAddOccurrence || !selectedGroupId) return
    const today = new Date().toISOString().split('T')[0]
    setAddingOccurrence(true)
    try {
      const newId = await onAddOccurrence({
        group_id: selectedGroupId,
        session_date: today,
        start_time: '17:00',
        end_time: '18:30',
      })
      if (newId) {
        setSelectedOccurrenceId(newId)
      }
    } catch (err) {
      console.error('Error quick adding today occurrence:', err)
      alert('حدث خطأ أثناء تسجيل حصة اليوم')
    } finally {
      setAddingOccurrence(false)
    }
  }

  const statuses: Array<{ key: AttendanceStatus; label: string; activeClass: string }> = [
    { key: 'present', label: 'حاضر', activeClass: 'bg-emerald-600 text-white shadow-xs' },
    { key: 'late', label: 'متأخر', activeClass: 'bg-amber-500 text-white shadow-xs' },
    { key: 'absent', label: 'غائب', activeClass: 'bg-rose-600 text-white shadow-xs' },
    { key: 'excused', label: 'معذور', activeClass: 'bg-blue-600 text-white shadow-xs' },
  ]

  // Count summaries
  const presentCount = Object.values(attendanceMap).filter((s) => s === 'present').length
  const lateCount = Object.values(attendanceMap).filter((s) => s === 'late').length
  const absentCount = Object.values(attendanceMap).filter((s) => s === 'absent').length
  const excusedCount = Object.values(attendanceMap).filter((s) => s === 'excused').length

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-black text-[#153b68] sm:text-xl">كشف الحضور والغياب</h2>
          <p className="text-xs text-slate-500">
            تسجيل الحضور بلمسة واحدة من هاتفك أثناء الحصة
          </p>
        </div>

        <div className="flex items-center gap-2">
          {currentOccurrence && (
            <button
              onClick={() =>
                onToggleCancelOccurrence(currentOccurrence.id, currentOccurrence.status)
              }
              disabled={!teacherStatus.isActive}
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition disabled:opacity-50 ${
                currentOccurrence.status === 'cancelled'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : 'border-rose-300 bg-rose-50 text-rose-700'
              }`}
            >
              <Ban className="size-3.5" />
              <span>
                {currentOccurrence.status === 'cancelled' ? 'تفعيل الحصة' : 'إلغاء (عطلة)'}
              </span>
            </button>
          )}

          <button
            onClick={handleSave}
            disabled={
              !teacherStatus.isActive ||
              !selectedOccurrenceId ||
              saving ||
              currentOccurrence?.status === 'cancelled'
            }
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-md transition disabled:opacity-50 ${
              saveSuccess ? 'bg-emerald-600' : 'bg-[#1d5ca8] hover:bg-[#164e93]'
            }`}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : saveSuccess ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <Save className="size-4" />
            )}
            <span>{saveSuccess ? 'تم الحفظ بنجاح!' : 'حفظ الكشف'}</span>
          </button>
        </div>
      </div>

      {/* Select Group & Occurrence Toolbar */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-bold text-slate-700">المجموعة</label>
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-800 outline-hidden focus:bg-white"
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.grade})
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700">تاريخ وموعد الحصة</label>
            {onAddOccurrence && (
              <button
                type="button"
                onClick={() => setAddModalOpen(true)}
                disabled={!teacherStatus.isActive || !selectedGroupId}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1d5ca8] hover:underline disabled:opacity-50"
              >
                <Plus className="size-3" />
                <span>+ إضافة موعد مخصص</span>
              </button>
            )}
          </div>
          <select
            value={selectedOccurrenceId}
            onChange={(e) => setSelectedOccurrenceId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-800 outline-hidden focus:bg-white"
          >
            {groupOccurrences.map((occ) => (
              <option key={occ.id} value={occ.id}>
                {formatArabicDate(occ.session_date)} ({occ.start_time.slice(0, 5)} - {occ.end_time.slice(0, 5)})
                {occ.status === 'cancelled' ? ' [ملغاة]' : ''}
              </option>
            ))}
            {groupOccurrences.length === 0 && <option value="">لا توجد حصص مجدولة لهذه المجموعة</option>}
          </select>
        </div>
      </div>

      {/* Empty State Help Banner if no occurrences */}
      {groupOccurrences.length === 0 && (
        <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-4 text-center">
          <p className="text-xs font-bold text-amber-900 mb-2">
            لا توجد مواعيد حصص مجدولة لهذه المجموعة حالياً لتسجيل الحضور.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={handleQuickAddToday}
              disabled={addingOccurrence || !teacherStatus.isActive}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1d5ca8] px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#164e93] disabled:opacity-50"
            >
              {addingOccurrence ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CalendarDays className="size-3.5" />
              )}
              <span>+ تسجيل حصة بتاريخ اليوم الآن</span>
            </button>
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              disabled={addingOccurrence || !teacherStatus.isActive}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Plus className="size-3.5" />
              <span>اختيار موعد مخصص</span>
            </button>
          </div>
        </div>
      )}

      {/* Cancelled Alert Banner */}
      {currentOccurrence?.status === 'cancelled' && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-bold text-rose-800">
          <Ban className="size-4 shrink-0 text-rose-600" />
          <span>هذه الحصة ملغاة (إجازة/ظرف طارئ). لن يُحسب أي غياب على الطلاب.</span>
        </div>
      )}

      {/* Quick Summary Pill Counters (Phone Optimized) */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white p-3 border border-slate-200 text-xs font-bold">
        <div className="flex items-center gap-2 overflow-x-auto py-0.5">
          <span className="rounded-lg bg-emerald-50 px-2 py-1 text-emerald-700">
            حاضر: {presentCount}
          </span>
          <span className="rounded-lg bg-amber-50 px-2 py-1 text-amber-700">
            متأخر: {lateCount}
          </span>
          <span className="rounded-lg bg-rose-50 px-2 py-1 text-rose-700">
            غائب: {absentCount}
          </span>
          <span className="rounded-lg bg-blue-50 px-2 py-1 text-blue-700">
            معذور: {excusedCount}
          </span>
        </div>

        <button
          onClick={markAllPresent}
          disabled={!teacherStatus.isActive || currentOccurrence?.status === 'cancelled'}
          className="text-xs font-bold text-[#1d5ca8] hover:underline disabled:opacity-50"
        >
          الكل حاضر
        </button>
      </div>

      {/* Mobile-First Student Cards */}
      <div className="space-y-2.5">
        {groupStudents.map((st) => {
          const currentStatus = attendanceMap[st.id] || 'present'

          return (
            <div
              key={st.id}
              className="flex flex-col gap-2.5 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-extrabold text-slate-800">{st.full_name}</p>
                <p className="text-[11px] text-slate-400 font-mono" dir="ltr">
                  {st.parent_phone}
                </p>
              </div>

              {/* 4 Direct One-Touch Buttons (Perfect for mobile phones) */}
              <div className="grid grid-cols-4 gap-1 sm:flex sm:items-center">
                {statuses.map(({ key, label, activeClass }) => {
                  const isSelected = currentStatus === key
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setStudentStatus(st.id, key)}
                      disabled={!teacherStatus.isActive || currentOccurrence?.status === 'cancelled'}
                      className={`h-9 min-w-14 rounded-xl text-xs font-bold transition active:scale-95 disabled:opacity-50 ${
                        isSelected
                          ? activeClass
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        {groupStudents.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
            <Users className="mx-auto size-8 text-slate-300" />
            <p className="mt-2 text-xs font-bold text-slate-600">لا يوجد طلاب في هذه المجموعة</p>
          </div>
        )}
      </div>

      {/* Modal for adding custom session occurrence */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="إضافة موعد حصة جديد للمجموعة"
      >
        <form onSubmit={handleCreateOccurrence} className="space-y-4">
          <div>
            <DatePicker
              label="تاريخ الحصة"
              value={newDate}
              onChange={setNewDate}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <TimePicker
                label="وقت البدء"
                value={newStartTime}
                onChange={setNewStartTime}
              />
            </div>
            <div>
              <TimePicker
                label="وقت الانتهاء"
                value={newEndTime}
                onChange={setNewEndTime}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAddModalOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={addingOccurrence}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1d5ca8] px-4 py-2 text-xs font-bold text-white hover:bg-[#164e93] disabled:opacity-50"
            >
              {addingOccurrence && <Loader2 className="size-3.5 animate-spin" />}
              <span>حفظ وتحديد الموعد</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
