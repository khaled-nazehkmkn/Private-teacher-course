'use client'

import React, { useState } from 'react'
import {
  Bell,
  Plus,
  Calendar,
  Clock,
  CheckCircle2,
  Circle,
  Trash2,
  AlertCircle,
  Tag,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { DatePicker } from '@/components/ui/date-picker'
import { TimePicker } from '@/components/ui/time-picker'
import { formatArabicDate } from '@/lib/occurrences'
import type { TeacherStatus } from '@/lib/teacher-status'
import type { GroupItem } from '../groups/GroupsView'

export interface ReminderItem {
  id: string
  title: string
  group_id?: string | null
  group_name?: string | null
  remind_date: string // YYYY-MM-DD
  remind_time?: string // HH:mm
  notes?: string
  completed: boolean
  created_at: string
}

interface Props {
  reminders: ReminderItem[]
  groups: GroupItem[]
  onAddReminder: (reminder: Omit<ReminderItem, 'id' | 'created_at'>) => Promise<void>
  onToggleReminder: (id: string, currentCompleted: boolean) => Promise<void>
  onDeleteReminder: (id: string) => Promise<void>
  teacherStatus: TeacherStatus
}

export function RemindersView({
  reminders,
  groups,
  onAddReminder,
  onToggleReminder,
  onDeleteReminder,
  teacherStatus,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [filterGroup, setFilterGroup] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed'>('pending')
  const [saving, setSaving] = useState(false)

  // Form states
  const todayStr = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()

  const [title, setTitle] = useState('')
  const [groupId, setGroupId] = useState<string>('')
  const [remindDate, setRemindDate] = useState(todayStr)
  const [remindTime, setRemindTime] = useState('17:00')
  const [notes, setNotes] = useState('')

  // Quick preset helpers
  const handleSetEndOfMonth = () => {
    const d = new Date()
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    const endStr = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`
    setRemindDate(endStr)
    setTitle('تذكير أولياء الأمور بالمصروفات الشهرية')
  }

  const handleSetTomorrow = () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    const nextStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    setRemindDate(nextStr)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !remindDate) return

    setSaving(true)
    try {
      const selectedGrp = groups.find((g) => g.id === groupId)
      await onAddReminder({
        title: title.trim(),
        group_id: groupId || null,
        group_name: selectedGrp?.name || null,
        remind_date: remindDate,
        remind_time: remindTime || undefined,
        notes: notes.trim() || undefined,
        completed: false,
      })

      // Reset form
      setTitle('')
      setGroupId('')
      setNotes('')
      setRemindDate(todayStr)
      setModalOpen(false)
    } catch (err) {
      console.error('Error saving reminder:', err)
      alert('فشل حفظ التذكير')
    } finally {
      setSaving(false)
    }
  }

  // Filtered Reminders
  const filteredReminders = reminders.filter((rem) => {
    if (filterStatus === 'pending' && rem.completed) return false
    if (filterStatus === 'completed' && !rem.completed) return false
    if (filterGroup !== 'all') {
      if (filterGroup === 'general' && rem.group_id) return false
      if (filterGroup !== 'general' && rem.group_id !== filterGroup) return false
    }
    return true
  }).sort((a, b) => a.remind_date.localeCompare(b.remind_date))

  const pendingCount = reminders.filter((r) => !r.completed).length

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-extrabold text-[#153b68]">التذكيرات والملاحظات</h2>
          <p className="text-xs text-slate-500">
            تذكيرات عامة أو مرتبطة بمجموعة معينة في الحصة القادمة أو نهاية الشهر
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          disabled={!teacherStatus.isActive}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1d5ca8] px-4 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-[#164e93] disabled:opacity-50"
        >
          <Plus className="size-4" />
          <span>إضافة تذكير جديد</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-3 border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => setFilterStatus('pending')}
            className={`rounded-lg px-3 py-1.5 transition ${
              filterStatus === 'pending' ? 'bg-white text-[#1d5ca8] shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            القادمة النشطة ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('completed')}
            className={`rounded-lg px-3 py-1.5 transition ${
              filterStatus === 'completed' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            المكتملة
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            className={`rounded-lg px-3 py-1.5 transition ${
              filterStatus === 'all' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الكل ({reminders.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Tag className="size-3.5 text-slate-400" />
          <select
            value={filterGroup}
            onChange={(e) => setFilterGroup(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white p-2 text-xs font-semibold outline-hidden focus:border-[#1d5ca8]"
          >
            <option value="all">كل المجموعات والعامة</option>
            <option value="general">تذكيرات عامة فقط</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Reminders List */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredReminders.map((rem) => {
          const isToday = rem.remind_date === todayStr
          const isPast = rem.remind_date < todayStr && !rem.completed

          return (
            <div
              key={rem.id}
              className={`flex flex-col justify-between rounded-2xl border p-4 shadow-2xs transition ${
                rem.completed
                  ? 'border-slate-200 bg-slate-50/60 opacity-60'
                  : isToday
                  ? 'border-blue-300 bg-blue-50/40 ring-1 ring-blue-200'
                  : isPast
                  ? 'border-rose-200 bg-rose-50/40'
                  : 'border-slate-200 bg-white hover:border-[#1d5ca8]/40'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`rounded-lg px-2.5 py-0.5 text-[11px] font-bold ${
                      rem.group_name
                        ? 'bg-blue-50 text-[#1d5ca8]'
                        : 'bg-purple-50 text-purple-700'
                    }`}
                  >
                    {rem.group_name ? `مجموعة: ${rem.group_name}` : 'تذكير عام'}
                  </span>

                  {isToday && (
                    <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-800 animate-pulse">
                      اليوم
                    </span>
                  )}
                  {isPast && (
                    <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                      فات موعده
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-start gap-2.5">
                  <button
                    type="button"
                    onClick={() => onToggleReminder(rem.id, rem.completed)}
                    className="mt-0.5 text-slate-400 hover:text-emerald-600 transition"
                  >
                    {rem.completed ? (
                      <CheckCircle2 className="size-5 text-emerald-600" />
                    ) : (
                      <Circle className="size-5 text-slate-300 hover:text-slate-400" />
                    )}
                  </button>

                  <div className="flex-1">
                    <h3
                      className={`text-sm font-bold ${
                        rem.completed ? 'line-through text-slate-400' : 'text-slate-800'
                      }`}
                    >
                      {rem.title}
                    </h3>
                    {rem.notes && (
                      <p className="mt-1 text-xs text-slate-500 leading-relaxed whitespace-pre-wrap">
                        {rem.notes}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100/80 pt-2.5 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 font-semibold text-slate-600">
                    <Calendar className="size-3.5 text-[#1d5ca8]" />
                    {formatArabicDate(rem.remind_date)}
                  </span>
                  {rem.remind_time && (
                    <span className="flex items-center gap-1 text-[11px] text-slate-400" dir="ltr">
                      <Clock className="size-3" />
                      {rem.remind_time.slice(0, 5)}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (confirm('هل أنت متأكد من حذف هذا التذكير؟')) {
                      onDeleteReminder(rem.id)
                    }
                  }}
                  className="p-1 text-slate-400 hover:text-rose-600 transition"
                  title="حذف التذكير"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          )
        })}

        {filteredReminders.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">
            <Bell className="mx-auto size-10 text-slate-300" />
            <p className="mt-3 text-sm font-bold text-slate-600">لا توجد تذكيرات حالية</p>
            <p className="mt-1 text-xs text-slate-400">
              أضف تذكيرات للحصص القادمة، المصروفات الشهرية، أو مهامك اليومية
            </p>
          </div>
        )}
      </div>

      {/* Add Reminder Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="إضافة تذكير جديد">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">عنوان التذكير</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: تذكير الطلاب بكشكول الواجب أو تذكير المصروفات..."
              className="w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-hidden focus:border-[#1d5ca8]"
            />
          </div>

          {/* Quick presets */}
          <div>
            <span className="mb-1.5 block text-[11px] font-bold text-slate-500">نماذج سريعة:</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={handleSetTomorrow}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
              >
                📅 غداً
              </button>
              <button
                type="button"
                onClick={handleSetEndOfMonth}
                className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-[#1d5ca8] hover:bg-blue-100"
              >
                💰 نهاية الشهر (المصروفات)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">المجموعة المستهدفة</label>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2 text-xs outline-hidden focus:border-[#1d5ca8]"
              >
                <option value="">عام (لكل المجموعات)</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">تاريخ التذكير</label>
              <DatePicker value={remindDate} onChange={setRemindDate} min={todayStr} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">وقت التذكير (اختياري)</label>
            <TimePicker value={remindTime} onChange={setRemindTime} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">ملاحظات إضافية (اختياري)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="اكتب تفاصيل إضافية إن وجدت..."
              className="w-full rounded-xl border border-slate-200 p-2 text-xs outline-hidden focus:border-[#1d5ca8]"
            />
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
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1d5ca8] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#164e93] disabled:opacity-50"
            >
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              حفظ التذكير
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
