'use client'

import React, { useState } from 'react'
import {
  CalendarClock,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Loader2,
  AlertCircle,
  Users,
} from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { formatArabicDate } from '@/lib/occurrences'
import type { TeacherStatus } from '@/lib/teacher-status'
import type { StudentItem } from '../students/StudentsView'
import type { GroupItem } from '../groups/GroupsView'
import type { OccurrenceItem } from '../attendance/AttendanceView'

export interface MakeupRequestItem {
  id: string
  student_id: string
  student_name: string
  missed_occurrence_id: string
  missed_date: string
  target_occurrence_id: string
  target_date: string
  target_group_name: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

interface Props {
  requests: MakeupRequestItem[]
  students: StudentItem[]
  groups: GroupItem[]
  occurrences: OccurrenceItem[]
  onCreateRequest: (req: {
    student_id: string
    missed_occurrence_id: string
    target_occurrence_id: string
  }) => Promise<void>
  onUpdateStatus: (requestId: string, newStatus: 'approved' | 'rejected') => Promise<void>
  teacherStatus: TeacherStatus
}

export function MakeupView({
  requests,
  students,
  groups,
  occurrences,
  onCreateRequest,
  onUpdateStatus,
  teacherStatus,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedStudentId, setSelectedStudentId] = useState(students[0]?.id || '')
  const [missedOccurrenceId, setMissedOccurrenceId] = useState('')
  const [targetOccurrenceId, setTargetOccurrenceId] = useState('')
  const [loading, setLoading] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const selectedStudent = students.find((s) => s.id === selectedStudentId)

  // Target occurrences must be for groups with same grade as student
  const validTargetOccurrences = occurrences.filter((occ) => {
    const grp = groups.find((g) => g.id === occ.group_id)
    return (
      grp &&
      grp.grade === selectedStudent?.grade &&
      grp.id !== selectedStudent?.group_id &&
      occ.status !== 'cancelled'
    )
  })

  // Submit new makeup request
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStudentId || !missedOccurrenceId || !targetOccurrenceId) return

    setValidationError(null)
    setLoading(true)
    try {
      await onCreateRequest({
        student_id: selectedStudentId,
        missed_occurrence_id: missedOccurrenceId,
        target_occurrence_id: targetOccurrenceId,
      })
      setModalOpen(false)
    } catch (err) {
      console.error(err)
      setValidationError('فشل إنشاء طلب التعويض')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-extrabold text-[#153b68]">طلبات الحصص التعويضية</h2>
          <p className="text-xs text-slate-500">
            إدارة حضور الطلاب في مجموعات بديلة من نفس المرحلة عند التغيب، لخصم الغياب تلقائياً
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          disabled={!teacherStatus.isActive}
          className="inline-flex items-center gap-2 rounded-xl bg-[#1d5ca8] px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#164e93] disabled:opacity-50"
        >
          <Plus className="size-4" />
          <span>طلب تعويض جديد</span>
        </button>
      </div>

      {/* Requests List */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {requests.map((req) => (
          <div
            key={req.id}
            className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
          >
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">{req.student_name}</h3>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    req.status === 'approved'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : req.status === 'rejected'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  {req.status === 'approved'
                    ? 'تمت الموافقة'
                    : req.status === 'rejected'
                    ? 'مرفوض'
                    : 'قيد الانتظار'}
                </span>
              </div>

              <div className="mt-4 space-y-2 text-xs">
                <div className="rounded-xl bg-rose-50/70 p-2 text-rose-800">
                  <span className="font-bold">الحصة الفائتة:</span> {formatArabicDate(req.missed_date)}
                </div>

                <div className="flex justify-center text-slate-400">
                  <ArrowRight className="size-4 rotate-90" />
                </div>

                <div className="rounded-xl bg-blue-50/70 p-2 text-blue-900">
                  <p className="font-bold">الحصة البديلة المقترحة:</p>
                  <p className="mt-0.5">{formatArabicDate(req.target_date)}</p>
                  <p className="text-[11px] text-blue-700 font-semibold">مجموعة: {req.target_group_name}</p>
                </div>
              </div>
            </div>

            {req.status === 'pending' && (
              <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  onClick={() => onUpdateStatus(req.id, 'rejected')}
                  disabled={!teacherStatus.isActive}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                >
                  رفض
                </button>
                <button
                  onClick={() => onUpdateStatus(req.id, 'approved')}
                  disabled={!teacherStatus.isActive}
                  className="rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
                >
                  موافقة واعتماد
                </button>
              </div>
            )}
          </div>
        ))}

        {requests.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">
            <CalendarClock className="mx-auto size-10 text-slate-300" />
            <p className="mt-3 text-sm font-bold text-slate-600">لا توجد طلبات تعويض حالياً</p>
            <p className="mt-1 text-xs text-slate-400">
              عند تغيب طالب يمكنك تسجيل طلب لحضور حصة بديلة في مجموعة أخرى من نفس المرحلة
            </p>
          </div>
        )}
      </div>

      {/* New Request Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="تسجيل طلب تعويض حصة">
        <form onSubmit={handleCreate} className="space-y-4">
          {validationError && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
              <AlertCircle className="size-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">اختر الطالب الغائب</label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-semibold outline-hidden"
            >
              {students.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.full_name} ({st.grade}) - {st.group_name || 'بدون مجموعة'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">الحصة الفائتة (الغياب)</label>
            <select
              value={missedOccurrenceId}
              onChange={(e) => setMissedOccurrenceId(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-hidden"
            >
              <option value="">-- اختر موعد الحصة الفائتة --</option>
              {occurrences
                .filter((o) => o.group_id === selectedStudent?.group_id)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {formatArabicDate(o.session_date)} ({o.start_time} - {o.end_time})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">
              الحصة البديلة المقترحة (نفس المرحلة: {selectedStudent?.grade})
            </label>
            <select
              value={targetOccurrenceId}
              onChange={(e) => setTargetOccurrenceId(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-hidden"
            >
              <option value="">-- اختر الحصة البديلة --</option>
              {validTargetOccurrences.map((o) => {
                const grp = groups.find((g) => g.id === o.group_id)
                return (
                  <option key={o.id} value={o.id}>
                    {grp?.name}: {formatArabicDate(o.session_date)} ({o.start_time})
                  </option>
                )
              })}
            </select>
          </div>

          <div className="mt-5 flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading || !missedOccurrenceId || !targetOccurrenceId}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1d5ca8] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#164e93] disabled:opacity-50"
            >
              {loading && <Loader2 className="size-3.5 animate-spin" />}
              تأكيد الطلب
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
