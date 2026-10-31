'use client'

import React, { useState } from 'react'
import { Plus, Users, Calendar, Clock, Trash2, Edit2, AlertCircle, Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { ARABIC_WEEKDAYS } from '@/lib/occurrences'
import type { TeacherStatus } from '@/lib/teacher-status'

export interface GroupItem {
  id: string
  name: string
  grade: string
  capacity: number
  studentCount?: number
  sessions: Array<{
    id?: string
    weekday: number
    start_time: string
    end_time: string
  }>
}

interface Props {
  groups: GroupItem[]
  onAddGroup: (newGroup: Omit<GroupItem, 'id'>) => Promise<void>
  onDeleteGroup: (groupId: string) => Promise<void>
  teacherStatus: TeacherStatus
}

export function GroupsView({ groups, onAddGroup, onDeleteGroup, teacherStatus }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // Form states
  const [name, setName] = useState('')
  const [grade, setGrade] = useState('الصف الأول الثانوي')
  const [capacity, setCapacity] = useState(20)
  const [sessions, setSessions] = useState<Array<{ weekday: number; start_time: string; end_time: string }>>([
    { weekday: 0, start_time: '17:00', end_time: '18:30' },
  ])

  const addSessionRow = () => {
    setSessions((prev) => [...prev, { weekday: 2, start_time: '17:00', end_time: '18:30' }])
  }

  const removeSessionRow = (idx: number) => {
    setSessions((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    try {
      await onAddGroup({
        name: name.trim(),
        grade,
        capacity,
        sessions,
      })
      setName('')
      setModalOpen(false)
    } catch (err) {
      console.error('Error creating group:', err)
      alert('فشل حفظ المجموعة الجديدة')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-extrabold text-[#153b68]">المجموعات الدراسية</h2>
          <p className="text-xs text-slate-500">
            إدارة مجموعات الطلاب ومواعيد الحصص الأسبوعية الثابتة
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          disabled={!teacherStatus.isActive}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1d5ca8] px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-[#164e93] disabled:opacity-50"
        >
          <Plus className="size-4" />
          <span>إضافة مجموعة جديدة</span>
        </button>
      </div>

      {/* Groups Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => {
          const currentCount = group.studentCount || 0
          const isFull = currentCount >= group.capacity

          return (
            <div
              key={group.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-[#1d5ca8]/40"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                      {group.grade}
                    </span>
                    <h3 className="mt-2 text-base font-bold text-slate-800">{group.name}</h3>
                  </div>
                  <div
                    className={`rounded-xl px-2.5 py-1 text-xs font-bold ${
                      isFull ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {currentCount} / {group.capacity} طالب
                  </div>
                </div>

                {/* Weekly Sessions */}
                <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3">
                  <p className="text-[11px] font-bold text-slate-400">مواعيد الحصص الأسبوعية:</p>
                  {group.sessions?.length > 0 ? (
                    group.sessions.map((sess, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 text-xs font-semibold text-slate-700"
                      >
                        <Calendar className="size-3.5 text-[#1d5ca8]" />
                        <span>يوم {ARABIC_WEEKDAYS[sess.weekday]}</span>
                        <Clock className="size-3 text-slate-400" />
                        <span dir="ltr">
                          {sess.start_time} - {sess.end_time}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400">لم تحدد مواعيد بعد</p>
                  )}
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  onClick={() => {
                    if (confirm(`هل أنت متأكد من حذف مجموعة "${group.name}"؟`)) {
                      onDeleteGroup(group.id)
                    }
                  }}
                  disabled={!teacherStatus.isActive}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                  aria-label="حذف"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          )
        })}

        {groups.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">
            <Users className="mx-auto size-10 text-slate-300" />
            <p className="mt-3 text-sm font-bold text-slate-600">لا توجد مجموعات حالية</p>
            <p className="mt-1 text-xs text-slate-400">
              قم بإنشاء مجموعتك الأولى لتوزيع الطلاب وتحديد جدول الحصص
            </p>
          </div>
        )}
      </div>

      {/* Add Group Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="إضافة مجموعة دراسية جديدة">
        <form onSubmit={handleCreateGroup} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">اسم المجموعة</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: مجموعة السبت والثلاثاء المتفوقين"
              className="w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-hidden focus:border-[#1d5ca8]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">المرحلة الدراسية</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-hidden focus:border-[#1d5ca8]"
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
              <label className="mb-1 block text-xs font-bold text-slate-700">السعة الاستيعابية</label>
              <input
                type="number"
                min="1"
                max="100"
                required
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-hidden focus:border-[#1d5ca8]"
              />
            </div>
          </div>

          {/* Weekly recurring sessions */}
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">الحصص الأسبوعية</label>
              <button
                type="button"
                onClick={addSessionRow}
                className="text-xs font-bold text-[#1d5ca8] hover:underline"
              >
                + إضافة حصة أسبوعية أخرى
              </button>
            </div>

            {sessions.map((sess, idx) => (
              <div key={idx} className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5">
                <select
                  value={sess.weekday}
                  onChange={(e) => {
                    const val = Number(e.target.value)
                    setSessions((prev) =>
                      prev.map((s, i) => (i === idx ? { ...s, weekday: val } : s))
                    )
                  }}
                  className="rounded-lg border border-slate-200 bg-white p-1.5 text-xs font-bold"
                >
                  {ARABIC_WEEKDAYS.map((day, dIdx) => (
                    <option key={dIdx} value={dIdx}>
                      {day}
                    </option>
                  ))}
                </select>

                <input
                  type="time"
                  required
                  value={sess.start_time}
                  onChange={(e) => {
                    const val = e.target.value
                    setSessions((prev) =>
                      prev.map((s, i) => (i === idx ? { ...s, start_time: val } : s))
                    )
                  }}
                  className="rounded-lg border border-slate-200 bg-white p-1.5 text-xs font-bold"
                />

                <span className="text-xs text-slate-400">إلى</span>

                <input
                  type="time"
                  required
                  value={sess.end_time}
                  onChange={(e) => {
                    const val = e.target.value
                    setSessions((prev) =>
                      prev.map((s, i) => (i === idx ? { ...s, end_time: val } : s))
                    )
                  }}
                  className="rounded-lg border border-slate-200 bg-white p-1.5 text-xs font-bold"
                />

                {sessions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSessionRow(idx)}
                    className="p-1 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            ))}
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
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1d5ca8] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#164e93] disabled:opacity-50"
            >
              {loading && <Loader2 className="size-3.5 animate-spin" />}
              حفظ المجموعة
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
