'use client'

import React from 'react'
import {
  Users,
  GraduationCap,
  CalendarDays,
  ClipboardCheck,
  AlertTriangle,
  Clock,
  ArrowLeft,
  CalendarClock,
  BarChart3,
  MessageCircle,
  Plus,
} from 'lucide-react'
import { formatArabicDate } from '@/lib/occurrences'
import type { GroupItem } from '../groups/GroupsView'
import type { StudentItem } from '../students/StudentsView'
import type { OccurrenceItem } from '../attendance/AttendanceView'
import type { AbsenceRecord } from '../absence/AbsenceView'
import type { MakeupRequestItem } from '../makeup/MakeupView'
import type { ExamItem } from '../exams/ExamsView'

interface Props {
  teacherName: string
  subject: string
  groups: GroupItem[]
  students: StudentItem[]
  occurrences: OccurrenceItem[]
  absencesData: Record<string, AbsenceRecord>
  makeupRequests: MakeupRequestItem[]
  exams: ExamItem[]
  onNavigateTab: (tab: string) => void
}

export function DashboardView({
  teacherName,
  subject,
  groups,
  students,
  occurrences,
  absencesData,
  makeupRequests,
  exams,
  onNavigateTab,
}: Props) {
  const todayStr = new Date().toISOString().split('T')[0]
  const todaySessions = occurrences.filter((o) => o.session_date === todayStr)

  // Students with absence alerts (>= 3 absences or >= 2 consecutive)
  const studentsWithAlerts = students
    .map((st) => {
      const rec = absencesData[st.id] || { dates: [], consecutive: 0 }
      return {
        student: st,
        absentCount: rec.dates.length,
        consecutive: rec.consecutive,
      }
    })
    .filter((s) => s.absentCount >= 3 || s.consecutive >= 2)

  // Pending makeup requests
  const pendingMakeups = makeupRequests.filter((r) => r.status === 'pending')

  return (
    <div className="space-y-4 sm:space-y-7">
      {/* Welcome Banner */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl sm:rounded-3xl bg-linear-to-r from-[#153b68] to-[#1d5ca8] p-4 sm:p-6 text-white shadow-lg sm:flex-row sm:items-center">
        <div>
          <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold text-white backdrop-blur-xs">
            مرحباً بك مجدداً
          </span>
          <h2 className="mt-1.5 text-xl sm:text-2xl font-black">{teacherName || 'أستاذ المادة'}</h2>
          <p className="mt-0.5 text-xs text-blue-100">
            مدرّس مادة {subject || 'الدروس الخصوصية'} · نظرة عامة على نشاط اليوم
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onNavigateTab('المجموعات')}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-[#153b68] shadow-sm transition active:scale-95 hover:bg-blue-50"
          >
            <Plus className="size-3.5" />
            <span>مجموعة جديدة</span>
          </button>
          <button
            onClick={() => onNavigateTab('الاختبارات')}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-500/30 px-3.5 py-2 text-xs font-bold text-white transition active:scale-95 hover:bg-blue-500/40"
          >
            <BarChart3 className="size-3.5" />
            <span>إنشاء اختبار</span>
          </button>
        </div>
      </div>

      {/* Quick Metrics 2x2 on Mobile, 4x1 on Desktop */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] sm:text-xs font-bold text-slate-400">إجمالي الطلاب</p>
              <p className="mt-1 text-2xl sm:text-3xl font-black text-slate-800">{students.length}</p>
            </div>
            <div className="grid size-9 sm:size-12 place-items-center rounded-2xl bg-blue-50 text-[#1d5ca8]">
              <Users className="size-4 sm:size-6" />
            </div>
          </div>
          <p className="mt-2 text-[10px] sm:text-xs text-slate-400">{groups.length} مجموعات</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] sm:text-xs font-bold text-slate-400">حصص اليوم</p>
              <p className="mt-1 text-2xl sm:text-3xl font-black text-slate-800">{todaySessions.length}</p>
            </div>
            <div className="grid size-9 sm:size-12 place-items-center rounded-2xl bg-amber-50 text-amber-600">
              <CalendarDays className="size-4 sm:size-6" />
            </div>
          </div>
          <p className="mt-2 text-[10px] sm:text-xs text-slate-400">
            {todaySessions.length > 0 ? 'مجدولة اليوم' : 'لا حصص اليوم'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] sm:text-xs font-bold text-slate-400">تنبيهات الغياب</p>
              <p className="mt-1 text-2xl sm:text-3xl font-black text-rose-600">{studentsWithAlerts.length}</p>
            </div>
            <div className="grid size-9 sm:size-12 place-items-center rounded-2xl bg-rose-50 text-rose-600">
              <AlertTriangle className="size-4 sm:size-6" />
            </div>
          </div>
          <p className="mt-2 text-[10px] sm:text-xs text-slate-400">تجاوزوا حد الغياب</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] sm:text-xs font-bold text-slate-400">طلبات التعويض</p>
              <p className="mt-1 text-2xl sm:text-3xl font-black text-emerald-600">{pendingMakeups.length}</p>
            </div>
            <div className="grid size-9 sm:size-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
              <CalendarClock className="size-4 sm:size-6" />
            </div>
          </div>
          <p className="mt-2 text-[10px] sm:text-xs text-slate-400">قيد الانتظار</p>
        </div>
      </div>

      {/* Main 2-Column Split: Today's Schedule & Absence Alerts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's Schedule */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-5 text-[#1d5ca8]" />
              <h3 className="text-sm font-extrabold text-slate-800">حصص اليوم</h3>
            </div>
            <button
              onClick={() => onNavigateTab('الحضور والغياب')}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#1d5ca8] hover:underline"
            >
              <span>تسجيل الحضور</span>
              <ArrowLeft className="size-3.5" />
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {todaySessions.map((occ) => {
              const grp = groups.find((g) => g.id === occ.group_id)
              return (
                <div
                  key={occ.id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-3.5"
                >
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">{grp?.name}</h4>
                    <p className="text-[11px] text-slate-400">
                      {grp?.grade} · سعة: {grp?.studentCount || 0} طالب
                    </p>
                  </div>
                  <div className="flex items-center gap-1 font-mono text-xs font-bold text-slate-600" dir="ltr">
                    <Clock className="size-3 text-slate-400" />
                    <span>
                      {occ.start_time} - {occ.end_time}
                    </span>
                  </div>
                </div>
              )
            })}

            {todaySessions.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-400">
                لا توجد حصص مجدولة لهذا اليوم
              </div>
            )}
          </div>
        </div>

        {/* Absence Alerts Preview */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-rose-600" />
              <h3 className="text-sm font-extrabold text-slate-800">تنبيهات الغياب الحرجة</h3>
            </div>
            <button
              onClick={() => onNavigateTab('الغياب والتنبيهات')}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#1d5ca8] hover:underline"
            >
              <span>عرض كل التنبيهات</span>
              <ArrowLeft className="size-3.5" />
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {studentsWithAlerts.slice(0, 4).map(({ student, absentCount, consecutive }) => (
              <div
                key={student.id}
                className="flex items-center justify-between rounded-xl border border-rose-100 bg-rose-50/40 p-3"
              >
                <div>
                  <h4 className="text-xs font-bold text-slate-800">{student.full_name}</h4>
                  <p className="text-[11px] text-slate-500">
                    {student.group_name || 'بدون مجموعة'} · هاتف: {student.parent_phone}
                  </p>
                </div>
                <div className="text-left">
                  <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700">
                    {absentCount} غياب
                  </span>
                  {consecutive >= 2 && (
                    <p className="mt-0.5 text-[10px] font-bold text-rose-600">
                      ({consecutive} متتالي)
                    </p>
                  )}
                </div>
              </div>
            ))}

            {studentsWithAlerts.length === 0 && (
              <div className="py-8 text-center text-xs text-emerald-600 font-bold">
                لا توجد تنبيهات غياب حرجة حالياً، جميع الطلاب ملتزمون!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Exams Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-5 text-[#1d5ca8]" />
            <h3 className="text-sm font-extrabold text-slate-800">أحدث الاختبارات المنشأة</h3>
          </div>
          <button
            onClick={() => onNavigateTab('الاختبارات')}
            className="inline-flex items-center gap-1 text-xs font-bold text-[#1d5ca8] hover:underline"
          >
            <span>إدارة الاختبارات</span>
            <ArrowLeft className="size-3.5" />
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {exams.slice(0, 3).map((ex) => (
            <div key={ex.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
              <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-bold text-slate-600 shadow-xs">
                {ex.grade || 'عام'}
              </span>
              <h4 className="mt-2 text-xs font-bold text-slate-800">{ex.title}</h4>
              <p className="mt-1 text-[11px] text-slate-400">
                المدة: {ex.duration_min} دقيقة ·{' '}
                <span className={ex.results_released ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                  {ex.results_released ? 'معلن' : 'محجوب'}
                </span>
              </p>
            </div>
          ))}

          {exams.length === 0 && (
            <div className="col-span-full py-6 text-center text-xs text-slate-400">
              لم يتم إنشاء أي اختبار بعد
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
