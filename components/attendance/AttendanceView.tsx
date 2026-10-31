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
  RotateCcw,
  Loader2,
  Users,
} from 'lucide-react'
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
  teacherStatus: TeacherStatus
}

export function AttendanceView({
  groups,
  students,
  occurrences,
  onSaveAttendance,
  onToggleCancelOccurrence,
  teacherStatus,
}: Props) {
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groups[0]?.id || '')
  const [selectedOccurrenceId, setSelectedOccurrenceId] = useState<string>('')
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({})
  const [saving, setSaving] = useState(false)

  // Filter occurrences by group
  const groupOccurrences = occurrences.filter((o) => o.group_id === selectedGroupId)
  const currentOccurrence = occurrences.find((o) => o.id === selectedOccurrenceId)

  // Filter students by group
  const groupStudents = students.filter((s) => s.group_id === selectedGroupId)

  // Auto select occurrence when group changes
  useEffect(() => {
    if (groupOccurrences.length > 0) {
      // Find today or closest upcoming occurrence
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

  // Cycle status on tap: present -> late -> absent -> excused -> present
  const cycleStatus = (studentId: string) => {
    if (!teacherStatus.isActive || currentOccurrence?.status === 'cancelled') return

    setAttendanceMap((prev) => {
      const current = prev[studentId] || 'present'
      let next: AttendanceStatus = 'present'
      if (current === 'present') next = 'late'
      else if (current === 'late') next = 'absent'
      else if (current === 'absent') next = 'excused'
      else if (current === 'excused') next = 'present'
      return { ...prev, [studentId]: next }
    })
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
    try {
      const records = groupStudents.map((st) => ({
        student_id: st.id,
        status: attendanceMap[st.id] || 'present',
      }))
      await onSaveAttendance(selectedOccurrenceId, records)
      alert('تم حفظ كشف الحضور بنجاح!')
    } catch (err) {
      console.error(err)
      alert('حدث خطأ أثناء حفظ كشف الحضور')
    } finally {
      setSaving(false)
    }
  }

  // Status visual styles
  const getStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case 'present':
        return {
          label: 'حاضر',
          icon: CheckCircle2,
          color: 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40',
        }
      case 'late':
        return {
          label: 'متأخر',
          icon: Clock3,
          color: 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40',
        }
      case 'absent':
        return {
          label: 'غائب',
          icon: XCircle,
          color: 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40',
        }
      case 'excused':
        return {
          label: 'معذور',
          icon: HelpCircle,
          color: 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40',
        }
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-extrabold text-[#153b68]">كشف الحضور والغياب</h2>
          <p className="text-xs text-slate-500">
            تسجيل الحضور السريع لكل حصة، إلغاء الحصص، ورصد الغياب
          </p>
        </div>

        <div className="flex items-center gap-2">
          {currentOccurrence && (
            <button
              onClick={() =>
                onToggleCancelOccurrence(currentOccurrence.id, currentOccurrence.status)
              }
              disabled={!teacherStatus.isActive}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition disabled:opacity-50 ${
                currentOccurrence.status === 'cancelled'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              <Ban className="size-4" />
              <span>
                {currentOccurrence.status === 'cancelled' ? 'إعادة تفعيل الحصة' : 'إلغاء الحصة (عطلة)'}
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
            className="inline-flex items-center gap-2 rounded-xl bg-[#1d5ca8] px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#164e93] disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            <span>حفظ الحضور</span>
          </button>
        </div>
      </div>

      {/* Select Group & Occurrence Toolbar */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-bold text-slate-700">المجموعة</label>
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-semibold outline-hidden focus:bg-white"
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.grade})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-slate-700">تاريخ الحصة</label>
          <select
            value={selectedOccurrenceId}
            onChange={(e) => setSelectedOccurrenceId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-semibold outline-hidden focus:bg-white"
          >
            {groupOccurrences.map((occ) => (
              <option key={occ.id} value={occ.id}>
                {formatArabicDate(occ.session_date)} ({occ.start_time} - {occ.end_time})
                {occ.status === 'cancelled' ? ' [ملغاة]' : ''}
              </option>
            ))}
            {groupOccurrences.length === 0 && <option value="">لا توجد حصص مجدولة</option>}
          </select>
        </div>
      </div>

      {/* Cancelled Banner */}
      {currentOccurrence?.status === 'cancelled' && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-800">
          <Ban className="size-5 shrink-0 text-rose-600" />
          <span>
            هذه الحصة معلّمة كحصة ملغاة (إجازة رسمية أو ظرف طارئ). لن يُحسب أي غياب على الطلاب في هذا
            اليوم.
          </span>
        </div>
      )}

      {/* Quick Mark All Present */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          إجمالي طلاب المجموعة: <span className="font-bold text-slate-800">{groupStudents.length}</span>
          {' · '}انقر على حالة الطالب لتغييرها بسرعة (حاضر / متأخر / غائب / معذور)
        </p>
        <button
          onClick={markAllPresent}
          disabled={!teacherStatus.isActive || currentOccurrence?.status === 'cancelled'}
          className="text-xs font-bold text-[#1d5ca8] hover:underline disabled:opacity-50"
        >
          تحديد الكل كـ "حاضر"
        </button>
      </div>

      {/* Attendance List */}
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {groupStudents.map((st) => {
          const status = attendanceMap[st.id] || 'present'
          const meta = getStatusBadge(status)
          const Icon = meta.icon

          return (
            <div
              key={st.id}
              onClick={() => cycleStatus(st.id)}
              className="flex cursor-pointer items-center justify-between rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs transition hover:border-[#1d5ca8] hover:shadow-sm select-none"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-slate-800">{st.full_name}</p>
                <p className="text-[11px] text-slate-400" dir="ltr">
                  {st.parent_phone}
                </p>
              </div>

              <div
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${meta.color}`}
              >
                <Icon className="size-4" />
                <span>{meta.label}</span>
              </div>
            </div>
          )
        })}

        {groupStudents.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
            <Users className="mx-auto size-8 text-slate-300" />
            <p className="mt-2 text-xs font-bold text-slate-600">لا يوجد طلاب في هذه المجموعة</p>
          </div>
        )}
      </div>
    </div>
  )
}
