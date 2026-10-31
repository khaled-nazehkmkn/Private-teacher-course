'use client'

import React, { useState } from 'react'
import {
  Printer,
  FileText,
  Users,
  GraduationCap,
  Award,
  CheckCircle2,
  XCircle,
  Calendar,
} from 'lucide-react'
import type { GroupItem } from '../groups/GroupsView'
import type { StudentItem } from '../students/StudentsView'
import type { AbsenceRecord } from '../absence/AbsenceView'

interface Props {
  groups: GroupItem[]
  students: StudentItem[]
  absencesData: Record<string, AbsenceRecord>
  teacherName: string
  subject: string
}

export function ReportsView({ groups, students, absencesData, teacherName, subject }: Props) {
  const [reportType, setReportType] = useState<'student' | 'group'>('student')
  const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.id || '')
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groups[0]?.id || '')

  const currentStudent = students.find((s) => s.id === selectedStudentId)
  const currentGroup = groups.find((g) => g.id === selectedGroupId)

  const studentAbsence = currentStudent ? absencesData[currentStudent.id] : null
  const absentDates = studentAbsence?.dates || []

  const groupStudents = students.filter((s) => s.group_id === selectedGroupId)

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* Header and Print Control (hidden during print) */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center print:hidden">
        <div>
          <h2 className="text-xl font-extrabold text-[#153b68]">التقارير وسجلات المتابعة</h2>
          <p className="text-xs text-slate-500">
            طباعة وتصدير تقارير المجموعات والطلاب بصيغة PDF قابلة للطباعة
          </p>
        </div>

        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 rounded-xl bg-[#1d5ca8] px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#164e93]"
        >
          <Printer className="size-4" />
          <span>طباعة التقرير (أو حفظ PDF)</span>
        </button>
      </div>

      {/* Report Selector Tabs (hidden during print) */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs sm:flex-row sm:items-center print:hidden">
        <div className="flex gap-2">
          <button
            onClick={() => setReportType('student')}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              reportType === 'student'
                ? 'bg-[#153b68] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            تقرير متابعة طالب
          </button>
          <button
            onClick={() => setReportType('group')}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              reportType === 'group'
                ? 'bg-[#153b68] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            تقرير أداء المجموعة
          </button>
        </div>

        <div className="flex-1 sm:text-left">
          {reportType === 'student' ? (
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-semibold outline-hidden"
            >
              {students.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.full_name} ({st.grade}) - {st.group_name || 'بدون مجموعة'}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-semibold outline-hidden"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.grade})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Printable Report Canvas */}
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm print:border-none print:shadow-none print:p-0">
        {/* Printable Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-5">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-[#153b68] text-white shadow-xs">
              <GraduationCap className="size-6" />
            </div>
            <div>
              <h1 className="text-lg font-black text-[#153b68]">معلّم | تقرير المتابعة الأكاديمي</h1>
              <p className="text-xs text-slate-500">
                الأستاذ: {teacherName || 'مدرس المادة'} · مادة {subject || 'الدروس الخصوصية'}
              </p>
            </div>
          </div>
          <div className="text-left text-xs text-slate-400">
            <p>تاريخ استخراج التقرير:</p>
            <p className="font-bold text-slate-700">{new Date().toLocaleDateString('ar-EG')}</p>
          </div>
        </div>

        {/* Content for Student Report */}
        {reportType === 'student' && currentStudent && (
          <div className="mt-6 space-y-6">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
                <div>
                  <p className="text-slate-400 font-bold">اسم الطالب</p>
                  <p className="mt-1 font-extrabold text-sm text-slate-800">
                    {currentStudent.full_name}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold">المرحلة الدراسية</p>
                  <p className="mt-1 font-bold text-slate-700">{currentStudent.grade}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold">المجموعة</p>
                  <p className="mt-1 font-bold text-slate-700">
                    {currentStudent.group_name || 'بدون مجموعة'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold">هاتف ولي الأمر</p>
                  <p className="mt-1 font-mono font-bold text-slate-700" dir="ltr">
                    {currentStudent.parent_phone}
                  </p>
                </div>
              </div>
            </div>

            {/* Attendance Summary */}
            <div className="space-y-3">
              <h3 className="text-sm font-extrabold text-slate-800">سجل الغياب والحضور:</h3>
              <div className="rounded-2xl border border-slate-200 p-4 text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="font-bold text-slate-600">إجمالي أيام الغياب غير المعوّضة:</span>
                  <span
                    className={`rounded-full px-3 py-1 font-bold ${
                      absentDates.length > 2
                        ? 'bg-rose-50 text-rose-700'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {absentDates.length} أيام
                  </span>
                </div>

                <div className="mt-3">
                  <p className="font-bold text-slate-500 mb-1.5">تواريخ الغياب المسجلة:</p>
                  {absentDates.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {absentDates.map((date, idx) => (
                        <span
                          key={idx}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-700 font-semibold"
                        >
                          {date}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-emerald-700 font-bold">لا يوجد غياب مسجل للطالب (حضور منتظم 100%)</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content for Group Report */}
        {reportType === 'group' && currentGroup && (
          <div className="mt-6 space-y-6">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <p className="text-slate-400 font-bold">اسم المجموعة</p>
                  <p className="mt-1 font-extrabold text-sm text-slate-800">{currentGroup.name}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold">المرحلة الدراسية</p>
                  <p className="mt-1 font-bold text-slate-700">{currentGroup.grade}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold">عدد الطلاب المقيدين</p>
                  <p className="mt-1 font-bold text-slate-700">
                    {groupStudents.length} / {currentGroup.capacity} طالب
                  </p>
                </div>
              </div>
            </div>

            {/* Students Roster */}
            <div>
              <h3 className="mb-3 text-sm font-extrabold text-slate-800">قائمة طلاب المجموعة:</h3>
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                    <tr>
                      <th className="p-3">م</th>
                      <th className="p-3">اسم الطالب</th>
                      <th className="p-3">هاتف ولي الأمر</th>
                      <th className="p-3">كود الاختبار</th>
                      <th className="p-3 text-center">أيام الغياب</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {groupStudents.map((st, idx) => {
                      const totalAbsent = absencesData[st.id]?.dates?.length || 0
                      return (
                        <tr key={st.id}>
                          <td className="p-3 text-slate-400">{idx + 1}</td>
                          <td className="p-3 font-bold text-slate-800">{st.full_name}</td>
                          <td className="p-3" dir="ltr">
                            {st.parent_phone}
                          </td>
                          <td className="p-3 font-mono font-bold text-[#1d5ca8]">
                            {st.access_code}
                          </td>
                          <td className="p-3 text-center font-bold">{totalAbsent}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Printable Footer */}
        <div className="mt-12 border-t border-slate-200 pt-5 text-center text-xs text-slate-400">
          تم إنشاء هذا التقرير عبر تطبيق معلّم لإدارة الدروس الخصوصية
        </div>
      </div>
    </div>
  )
}
