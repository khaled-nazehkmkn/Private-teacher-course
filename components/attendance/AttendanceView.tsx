'use client'

import React, { useState, useEffect, useMemo } from 'react'
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
  History,
  Play,
  ArrowRight,
  Check,
  AlertCircle,
  Edit3,
  Bell,
} from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { DatePicker } from '@/components/ui/date-picker'
import { TimePicker } from '@/components/ui/time-picker'
import { formatArabicDate, ARABIC_WEEKDAYS } from '@/lib/occurrences'
import { createClient } from '@/lib/supabase/browser'
import type { TeacherStatus } from '@/lib/teacher-status'
import type { AbsenceRecord } from '@/components/absence/AbsenceView'
import type { GroupItem } from '../groups/GroupsView'
import type { StudentItem } from '../students/StudentsView'
import type { ReminderItem } from '../reminders/RemindersView'

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
  absencesData?: Record<string, AbsenceRecord>
  reminders?: ReminderItem[]
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
  absencesData,
  reminders = [],
  onSaveAttendance,
  onToggleCancelOccurrence,
  onAddOccurrence,
  teacherStatus,
}: Props) {
  // Navigation View: 'today' (حصص اليوم) | 'sheet' (شيت رصد الحصة) | 'history' (سجل الحصص السابقة)
  const [activeTab, setActiveTab] = useState<'today' | 'history' | 'sheet'>('today')

  const [selectedGroupId, setSelectedGroupId] = useState<string>(groups[0]?.id || '')
  const [selectedOccurrenceId, setSelectedOccurrenceId] = useState<string>('')
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({})
  const [loadingExistingAttendance, setLoadingExistingAttendance] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Extra lesson modal state
  const [extraModalOpen, setExtraModalOpen] = useState(false)
  const [extraGroupId, setExtraGroupId] = useState(groups[0]?.id || '')
  const [extraStartTime, setExtraStartTime] = useState('17:00')
  const [extraEndTime, setExtraEndTime] = useState('18:30')
  const [launchingExtra, setLaunchingExtra] = useState(false)

  // Today helpers (Safe local Cairo calendar date)
  const today = useMemo(() => new Date(), [])
  const todayDateStr = useMemo(() => {
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [today])
  const todayWeekday = useMemo(() => today.getDay(), [today]) // 0 = Sunday, 6 = Saturday

  // Groups that have sessions scheduled for TODAY
  const todayScheduledGroups = useMemo(() => {
    return groups
      .map((g) => {
        const matchingSessions = (g.sessions || []).filter((s) => s.weekday === todayWeekday)
        const existingOcc = occurrences.find(
          (o) => o.group_id === g.id && o.session_date === todayDateStr
        )
        return {
          group: g,
          sessions: matchingSessions,
          existingOccurrence: existingOcc,
        }
      })
      .filter((item) => item.sessions.length > 0 || Boolean(item.existingOccurrence))
  }, [groups, occurrences, todayDateStr, todayWeekday])

  // Current Occurrence & Group
  const currentOccurrence = occurrences.find((o) => o.id === selectedOccurrenceId)
  const currentGroup = groups.find((g) => g.id === selectedGroupId)
  const groupStudents = students.filter((s) => s.group_id === selectedGroupId)

  // Load existing saved attendance whenever selectedOccurrenceId changes
  useEffect(() => {
    let isMounted = true
    async function loadAttendance() {
      if (!selectedOccurrenceId) return

      setLoadingExistingAttendance(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('attendance')
          .select('student_id, status')
          .eq('occurrence_id', selectedOccurrenceId)

        if (!isMounted) return

        const map: Record<string, AttendanceStatus> = {}
        // Default all to present initially
        groupStudents.forEach((st) => {
          map[st.id] = 'present'
        })

        // If records already saved in DB, restore them!
        if (data && data.length > 0) {
          data.forEach((row: any) => {
            map[row.student_id] = row.status as AttendanceStatus
          })
        }
        setAttendanceMap(map)
      } catch (err) {
        console.error('Error loading attendance for occurrence:', err)
      } finally {
        if (isMounted) setLoadingExistingAttendance(false)
      }
    }

    loadAttendance()
    return () => {
      isMounted = false
    }
  }, [selectedOccurrenceId, selectedGroupId])

  // Handle Starting or Editing a Today Session
  const handleStartTodaySession = async (
    groupId: string,
    existingOccurrence?: OccurrenceItem,
    sessionTiming?: { start_time: string; end_time: string }
  ) => {
    setSelectedGroupId(groupId)

    if (existingOccurrence) {
      setSelectedOccurrenceId(existingOccurrence.id)
      setActiveTab('sheet')
      return
    }

    // If occurrence not created in DB yet, create it on the fly!
    if (onAddOccurrence) {
      const startTime = sessionTiming ? sessionTiming.start_time.slice(0, 5) : '17:00'
      const endTime = sessionTiming ? sessionTiming.end_time.slice(0, 5) : '18:30'

      const newId = await onAddOccurrence({
        group_id: groupId,
        session_date: todayDateStr,
        start_time: startTime,
        end_time: endTime,
      })

      if (newId) {
        setSelectedOccurrenceId(newId)
        setActiveTab('sheet')
        return
      }
    }

    setActiveTab('sheet')
  }

  // Handle Launching an Extra Lesson for Today
  const handleLaunchExtraLesson = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!extraGroupId || !onAddOccurrence) return

    setLaunchingExtra(true)
    try {
      const newId = await onAddOccurrence({
        group_id: extraGroupId,
        session_date: todayDateStr,
        start_time: extraStartTime,
        end_time: extraEndTime,
      })

      if (newId) {
        setSelectedGroupId(extraGroupId)
        setSelectedOccurrenceId(newId)
        setExtraModalOpen(false)
        setActiveTab('sheet')
      }
    } catch (err) {
      console.error('Error launching extra lesson:', err)
      alert('حدث خطأ أثناء بدء الحصة الإضافية')
    } finally {
      setLaunchingExtra(false)
    }
  }

  // Set student status directly
  const setStudentStatus = (studentId: string, status: AttendanceStatus) => {
    if (!teacherStatus.isActive || currentOccurrence?.status === 'cancelled') return
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: status,
    }))
  }

  // Quick mark all as present
  const markAll = (status: AttendanceStatus) => {
    const updated: Record<string, AttendanceStatus> = {}
    groupStudents.forEach((st) => {
      updated[st.id] = status
    })
    setAttendanceMap(updated)
  }

  // Handle Save Attendance
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
      alert('حدث خطأ أثناء حفظ كشف الحضور، يرجى المحاولة مرة أخرى')
    } finally {
      setSaving(false)
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

  // Filter past occurrences for History tab
  const historyOccurrences = useMemo(() => {
    return occurrences
      .filter((o) => o.group_id === selectedGroupId && o.session_date <= todayDateStr)
      .sort((a, b) => b.session_date.localeCompare(a.session_date))
  }, [occurrences, selectedGroupId, todayDateStr])

  // Attendance stats for past history occurrences
  const [historyStats, setHistoryStats] = useState<
    Record<string, { present: number; absent: number; late: number; excused: number; total: number }>
  >({})

  useEffect(() => {
    let isMounted = true
    async function loadHistoryStats() {
      if (historyOccurrences.length === 0) return
      try {
        const supabase = createClient()
        const occIds = historyOccurrences.map((o) => o.id)
        const { data, error } = await supabase
          .from('attendance')
          .select('occurrence_id, status')
          .in('occurrence_id', occIds)

        if (!isMounted || !data) return

        const stats: Record<
          string,
          { present: number; absent: number; late: number; excused: number; total: number }
        > = {}

        occIds.forEach((id) => {
          stats[id] = { present: 0, absent: 0, late: 0, excused: 0, total: 0 }
        })

        data.forEach((row: any) => {
          if (!stats[row.occurrence_id]) {
            stats[row.occurrence_id] = { present: 0, absent: 0, late: 0, excused: 0, total: 0 }
          }
          const s = stats[row.occurrence_id]
          s.total += 1
          if (row.status === 'present') s.present += 1
          else if (row.status === 'absent') s.absent += 1
          else if (row.status === 'late') s.late += 1
          else if (row.status === 'excused') s.excused += 1
        })

        setHistoryStats(stats)
      } catch (err) {
        console.error('Error loading history stats:', err)
      }
    }

    loadHistoryStats()
    return () => {
      isMounted = false
    }
  }, [historyOccurrences, saveSuccess])

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Navigation Bar: Today's Lessons vs History */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-black text-[#153b68] sm:text-xl">كشف الحضور والغياب</h2>
          <p className="text-xs text-slate-500">
            {activeTab === 'today' && 'حصص اليوم فقط لتسجيل الحضور بسهولة وسرعة'}
            {activeTab === 'sheet' && 'تسجيل حضور وغياب الطلاب للحصة الجارية'}
            {activeTab === 'history' && 'سجل الحصص السابقة ومراجعة نسب الحضور والغياب'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'sheet' && (
            <button
              type="button"
              onClick={() => setActiveTab('today')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50"
            >
              <ArrowRight className="size-3.5" />
              <span>العودة لحصص اليوم</span>
            </button>
          )}

          {activeTab !== 'sheet' && (
            <div className="inline-flex rounded-xl bg-slate-200/80 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('today')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                  activeTab === 'today'
                    ? 'bg-white text-[#153b68] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarDays className="size-3.5 text-[#1d5ca8]" />
                <span>حصص اليوم ({todayScheduledGroups.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                  activeTab === 'history'
                    ? 'bg-white text-[#153b68] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <History className="size-3.5 text-slate-600" />
                <span>سجل الحصص (History)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: TODAY'S LESSONS (حصص اليوم مخصوص) */}
      {/* ========================================================================= */}
      {activeTab === 'today' && (
        <div className="space-y-4">
          {/* Today Date Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-[#eaf2ff] p-4 text-[#153b68]">
            <div className="flex items-center gap-3">
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#1d5ca8] text-white shadow-sm">
                <Calendar className="size-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#1d5ca8]">
                  يوم {ARABIC_WEEKDAYS[todayWeekday]}
                </p>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  {formatArabicDate(todayDateStr)}
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setExtraModalOpen(true)}
              disabled={!teacherStatus.isActive}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#1d5ca8]/30 bg-white px-3.5 py-2 text-xs font-bold text-[#1d5ca8] shadow-xs hover:bg-blue-50/80 disabled:opacity-50"
            >
              <Plus className="size-3.5" />
              <span>+ بدء حصة إضافية اليوم</span>
            </button>
          </div>

          {/* Today Scheduled Groups Cards */}
          <div className="grid gap-3 sm:grid-cols-2">
            {todayScheduledGroups.map(({ group, sessions, existingOccurrence }) => {
              const timing = sessions[0] || {
                start_time: existingOccurrence?.start_time || '17:00:00',
                end_time: existingOccurrence?.end_time || '18:30:00',
              }
              const isRecorded = Boolean(existingOccurrence)
              const studentCount = students.filter((s) => s.group_id === group.id).length

              return (
                <div
                  key={group.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-[#1d5ca8]/40"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-[#1d5ca8]">
                        {group.grade}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-bold text-slate-500">
                        <Users className="size-3.5" />
                        <span>{studentCount} طالب</span>
                      </span>
                    </div>

                    <h4 className="mt-2 text-base font-black text-slate-900">{group.name}</h4>

                    <div className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-600">
                      <Clock3 className="size-4 text-slate-400" />
                      <span>
                        من {timing.start_time.slice(0, 5)} إلى {timing.end_time.slice(0, 5)}
                      </span>
                    </div>

                    {/* Active Group / Today Reminders */}
                    {(() => {
                      const groupRems = reminders.filter(
                        (r) =>
                          !r.completed &&
                          (r.group_id === group.id || !r.group_id) &&
                          r.remind_date <= todayDateStr
                      )
                      if (groupRems.length === 0) return null
                      return (
                        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-2.5 text-xs text-amber-900">
                          <div className="flex items-center gap-1 font-bold text-amber-800">
                            <Bell className="size-3.5 text-amber-600" />
                            <span>تذكير لهذه الحصة:</span>
                          </div>
                          <ul className="mt-1 list-disc list-inside space-y-0.5 text-[11px] text-amber-800">
                            {groupRems.map((r) => (
                              <li key={r.id}>{r.title}</li>
                            ))}
                          </ul>
                        </div>
                      )
                    })()}
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-1.5">
                      {isRecorded ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                          <CheckCircle2 className="size-3" />
                          <span>تم تسجيل الحضور</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                          <Clock3 className="size-3" />
                          <span>الحصة لم تبدأ بعد</span>
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={!teacherStatus.isActive}
                      onClick={() =>
                        handleStartTodaySession(group.id, existingOccurrence, {
                          start_time: timing.start_time,
                          end_time: timing.end_time,
                        })
                      }
                      className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-xs transition active:scale-95 disabled:opacity-50 ${
                        isRecorded
                          ? 'bg-slate-800 hover:bg-slate-900'
                          : 'bg-[#1d5ca8] hover:bg-[#164e93]'
                      }`}
                    >
                      {isRecorded ? (
                        <>
                          <Edit3 className="size-3.5" />
                          <span>تعديل الكشف</span>
                        </>
                      ) : (
                        <>
                          <Play className="size-3.5 fill-current" />
                          <span>بدء الحصة ورصد الحضور</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )
            })}

            {todayScheduledGroups.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">
                <CalendarDays className="mx-auto size-12 text-slate-300" />
                <h4 className="mt-3 text-sm font-bold text-slate-700">
                  لا توجد حصص مجدولة ليوم {ARABIC_WEEKDAYS[todayWeekday]}
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                  جدولك الأسبوعي لا يحتوي على مجموعات في هذا اليوم. يمكنك بدء حصة إضافية لأي مجموعة الآن.
                </p>
                <button
                  type="button"
                  onClick={() => setExtraModalOpen(true)}
                  disabled={!teacherStatus.isActive}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#1d5ca8] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#164e93] disabled:opacity-50"
                >
                  <Plus className="size-3.5" />
                  <span>بدء حصة إضافية الآن</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: ACTIVE LESSON ATTENDANCE SHEET (شيت رصد الحصة) */}
      {/* ========================================================================= */}
      {activeTab === 'sheet' && (
        <div className="space-y-4">
          {/* Active Lesson Header Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-[#1d5ca8]">
                    {currentGroup?.grade}
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    {currentGroup?.name}
                  </h3>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {currentOccurrence?.session_date
                    ? formatArabicDate(currentOccurrence.session_date)
                    : formatArabicDate(todayDateStr)}{' '}
                  · من {currentOccurrence?.start_time.slice(0, 5) || '17:00'} إلى{' '}
                  {currentOccurrence?.end_time.slice(0, 5) || '18:30'}
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

            {/* Cancelled Alert Banner */}
            {currentOccurrence?.status === 'cancelled' && (
              <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">
                <Ban className="size-4 shrink-0 text-rose-600" />
                <span>هذه الحصة ملغاة (إجازة/ظرف طارئ). لن يُحسب أي غياب على الطلاب.</span>
              </div>
            )}

            {/* Quick Counters & Fast Actions Bar */}
            <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs font-bold">
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
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

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => markAll('present')}
                  disabled={!teacherStatus.isActive || currentOccurrence?.status === 'cancelled'}
                  className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-200"
                >
                  الكل حاضر
                </button>
                <button
                  type="button"
                  onClick={() => markAll('absent')}
                  disabled={!teacherStatus.isActive || currentOccurrence?.status === 'cancelled'}
                  className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-200"
                >
                  الكل غائب
                </button>
              </div>
            </div>
          </div>

          {/* Loading Indicator for Existing Records */}
          {loadingExistingAttendance && (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-50 p-4 text-xs font-bold text-slate-500">
              <Loader2 className="size-4 animate-spin text-[#1d5ca8]" />
              <span>جاري تحميل السجلات المحفوظة للحصة...</span>
            </div>
          )}

          {/* Student Attendance Cards */}
          <div className="space-y-2">
            {groupStudents.map((st, sIndex) => {
              const currentStatus = attendanceMap[st.id] || 'present'

              return (
                <div
                  key={st.id}
                  className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs transition sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500">
                      {sIndex + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-800">{st.full_name}</h4>
                        {(() => {
                          const absCount = absencesData?.[st.id]?.dates?.length || 0
                          if (absCount > 0) {
                            return (
                              <span className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                                🚨 غياب سابق: {absCount} حصة
                              </span>
                            )
                          }
                          return (
                            <span className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                              منتظم
                            </span>
                          )
                        })()}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        كود: <span className="font-mono text-slate-600">{st.access_code}</span> ·
                        هاتف: {st.parent_phone}
                      </p>
                    </div>
                  </div>

                  {/* 4 Direct Touch Buttons */}
                  <div className="grid grid-cols-4 gap-1 sm:flex sm:items-center">
                    {statuses.map(({ key, label, activeClass }) => {
                      const isSelected = currentStatus === key
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setStudentStatus(st.id, key)}
                          disabled={
                            !teacherStatus.isActive || currentOccurrence?.status === 'cancelled'
                          }
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: ATTENDANCE HISTORY (سجل الحصص السابقة لكل مجموعة) */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Select Group Filter */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              اختر المجموعة الدراسية لعرض سجل حصصها:
            </label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full sm:w-72 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-800 outline-hidden focus:bg-white"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.grade})
                </option>
              ))}
            </select>
          </div>

          {/* Past Sessions List */}
          <div className="space-y-2.5">
            {historyOccurrences.map((occ) => {
              const isToday = occ.session_date === todayDateStr
              const stat = historyStats[occ.id]
              const hasRecords = stat && stat.total > 0

              return (
                <div
                  key={occ.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-[#1d5ca8]/40 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-700">
                      <CalendarDays className="size-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-slate-900">
                          {formatArabicDate(occ.session_date)}
                        </h4>
                        {isToday && (
                          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            اليوم
                          </span>
                        )}
                        {occ.status === 'cancelled' && (
                          <span className="rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                            حصة ملغاة
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        التوقيت: من {occ.start_time.slice(0, 5)} إلى {occ.end_time.slice(0, 5)}
                      </p>

                      {/* Attendance Breakdown Pills */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                        {hasRecords ? (
                          <>
                            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-700">
                              حاضر: {stat.present}
                            </span>
                            {stat.absent > 0 && (
                              <span className="rounded-md bg-rose-50 px-2 py-0.5 text-rose-700">
                                غائب: {stat.absent}
                              </span>
                            )}
                            {stat.late > 0 && (
                              <span className="rounded-md bg-amber-50 px-2 py-0.5 text-amber-700">
                                متأخر: {stat.late}
                              </span>
                            )}
                            {stat.excused > 0 && (
                              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-blue-700">
                                معذور: {stat.excused}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-500">
                            لم يتم رصد الحضور بعد
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGroupId(occ.group_id)
                      setSelectedOccurrenceId(occ.id)
                      setActiveTab('sheet')
                    }}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1d5ca8] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#164e93]"
                  >
                    <Edit3 className="size-3.5" />
                    <span>عرض وتعديل كشف الحضور</span>
                  </button>
                </div>
              )
            })}

            {historyOccurrences.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
                <History className="mx-auto size-8 text-slate-300" />
                <p className="mt-2 text-xs font-bold text-slate-600">
                  لا توجد حصص سابقة مسجلة لهذه المجموعة بعد
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Extra Lesson Modal */}
      <Modal
        isOpen={extraModalOpen}
        onClose={() => setExtraModalOpen(false)}
        title="بدء حصة إضافية اليوم"
      >
        <form onSubmit={handleLaunchExtraLesson} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">المجموعة</label>
            <select
              value={extraGroupId}
              onChange={(e) => setExtraGroupId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-800 outline-hidden focus:bg-white"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.grade})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <TimePicker
                label="وقت البدء"
                value={extraStartTime}
                onChange={setExtraStartTime}
              />
            </div>
            <div>
              <TimePicker
                label="وقت الانتهاء"
                value={extraEndTime}
                onChange={setExtraEndTime}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setExtraModalOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={launchingExtra}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1d5ca8] px-4 py-2 text-xs font-bold text-white hover:bg-[#164e93] disabled:opacity-50"
            >
              {launchingExtra && <Loader2 className="size-3.5 animate-spin" />}
              <span>بدء الحصة الآن</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
