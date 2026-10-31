'use client'

import React, { useState } from 'react'
import {
  AlertTriangle,
  MessageCircle,
  Settings2,
} from 'lucide-react'
import { getAbsenceSeverity, type AbsenceBadgeConfig } from '@/lib/absence-utils'
import { buildWhatsAppLink, formatAbsenceMessage } from '@/lib/whatsapp'
import { ARABIC_WEEKDAYS } from '@/lib/occurrences'
import { Modal } from '@/components/ui/modal'
import type { TeacherStatus } from '@/lib/teacher-status'
import type { StudentItem } from '../students/StudentsView'

export interface AbsenceRecord {
  student_id: string
  dates: string[]
  consecutive: number
}

interface Props {
  students: StudentItem[]
  absencesData: Record<string, AbsenceRecord>
  teacherName: string
  subject: string
  onLogWhatsAppMessage: (studentId: string, message: string) => Promise<void>
  teacherStatus: TeacherStatus
}

export function AbsenceView({
  students,
  absencesData,
  teacherName,
  subject,
  onLogWhatsAppMessage,
  teacherStatus,
}: Props) {
  const [period, setPeriod] = useState<'current_month' | 'last_month' | 'all'>('current_month')
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'alerts_only'>('all')

  // WhatsApp preview modal state
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [targetStudent, setTargetStudent] = useState<StudentItem | null>(null)
  const [targetMessage, setTargetMessage] = useState('')
  const [targetWhatsAppUrl, setTargetWhatsAppUrl] = useState('')

  // Configurable thresholds state
  const [thresholds, setThresholds] = useState<AbsenceBadgeConfig>({
    consecutiveLimit: 2,
    totalLimit: 3,
  })
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)

  // Compute student absence rows
  const absenceRows = students.map((st) => {
    const record = absencesData[st.id] || { dates: [], consecutive: 0 }
    const totalAbsent = record.dates.length
    const severity = getAbsenceSeverity(totalAbsent, record.consecutive, thresholds)

    return {
      student: st,
      totalAbsent,
      consecutive: record.consecutive,
      dates: record.dates,
      severity,
    }
  })

  // Filter rows
  const filteredRows = absenceRows.filter((row) => {
    if (filterSeverity === 'alerts_only') {
      return row.severity.isAlert
    }
    return true
  })

  // Open WhatsApp prepared message
  const handleOpenWhatsApp = (st: StudentItem, dates: string[]) => {
    const daysArabic = dates.map((d) => {
      const dayIdx = new Date(d).getDay()
      return ARABIC_WEEKDAYS[dayIdx] || ''
    })

    const message = formatAbsenceMessage({
      studentName: st.full_name,
      groupName: st.group_name || 'المجموعة',
      teacherName: teacherName || 'المعلم',
      subject: subject || 'المادة الدراسية',
      dates,
      daysArabic,
      totalAbsences: dates.length,
    })

    const waLink = buildWhatsAppLink(st.parent_phone, message)

    setTargetStudent(st)
    setTargetMessage(message)
    setTargetWhatsAppUrl(waLink)
    setPreviewModalOpen(true)
  }

  // Confirm and open WhatsApp
  const handleConfirmSend = async () => {
    if (!targetStudent || !targetMessage) return

    // 1. Log to message_log
    try {
      await onLogWhatsAppMessage(targetStudent.id, targetMessage)
    } catch (e) {
      console.error('Error logging whatsapp message:', e)
    }

    // 2. Open WhatsApp Web or App
    window.open(targetWhatsAppUrl, '_blank')
    setPreviewModalOpen(false)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-black text-[#153b68] sm:text-xl">رصد الغياب والتنبيهات</h2>
          <p className="text-xs text-slate-500">
            حساب تلقائي لغياب الطلاب وإرسال تنبيهات واتساب بنقرة واحدة
          </p>
        </div>

        <button
          onClick={() => setSettingsModalOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 w-full sm:w-auto"
        >
          <Settings2 className="size-4" />
          <span>ضبط حدود التنبيه</span>
        </button>
      </div>

      {/* Period & Filter Controls (Mobile-Friendly) */}
      <div className="flex flex-col gap-2.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 shrink-0">الفترة:</span>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            className="w-full sm:w-auto rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 outline-hidden"
          >
            <option value="current_month">الشهر الحالي</option>
            <option value="last_month">الشهر الماضي</option>
            <option value="all">كل الفترات (الفصل كاملاً)</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <button
            onClick={() => setFilterSeverity('all')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition text-center ${
              filterSeverity === 'all'
                ? 'bg-[#153b68] text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            جميع الطلاب ({absenceRows.length})
          </button>
          <button
            onClick={() => setFilterSeverity('alerts_only')}
            className={`inline-flex items-center justify-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              filterSeverity === 'alerts_only'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            <AlertTriangle className="size-3.5 shrink-0" />
            <span>المستحقون للتنبيه ({absenceRows.filter((r) => r.severity.isAlert).length})</span>
          </button>
        </div>
      </div>

      {/* Color Scale Legend */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-3 text-xs border border-slate-200">
        <span className="font-bold text-slate-400 text-[11px]">المقياس:</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
          منتظم (0-1)
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
          تنبيه (2-3)
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-0.5 text-[11px] font-bold text-orange-700 border border-orange-200">
          غياب متكرر (4)
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200">
          خطر انقطاع (5+)
        </span>
      </div>

      {/* MOBILE CARD VIEW (Phones < 768px) */}
      <div className="grid gap-2.5 sm:hidden">
        {filteredRows.map(({ student, totalAbsent, consecutive, dates, severity }) => (
          <div
            key={student.id}
            className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-extrabold text-slate-900">{student.full_name}</p>
                <p className="text-xs text-slate-400">{student.group_name || 'بدون مجموعة'}</p>
              </div>

              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${severity.bgClass} ${severity.textClass} ${severity.borderClass}`}
              >
                {severity.label}
              </span>
            </div>

            <div className="mt-2.5 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-semibold">أيام الغياب غير المعوّضة:</span>
              <span className="font-bold text-sm text-slate-800">
                {totalAbsent} أيام
                {consecutive >= 2 && (
                  <span className="mr-1 text-[11px] text-rose-600 font-semibold">
                    ({consecutive} متتالي)
                  </span>
                )}
              </span>
            </div>

            {dates.length > 0 && (
              <p className="mt-1 text-[11px] text-slate-500 truncate">
                التواريخ: {dates.join('، ')}
              </p>
            )}

            {totalAbsent > 0 ? (
              <button
                onClick={() => handleOpenWhatsApp(student, dates)}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-xs active:bg-emerald-700"
              >
                <MessageCircle className="size-4" />
                <span>إرسال تنبيه واتساب لولي الأمر</span>
              </button>
            ) : (
              <div className="mt-2 text-center text-[11px] font-bold text-emerald-600">
                ✓ حضور منتظم ولا يوجد غياب
              </div>
            )}
          </div>
        ))}

        {filteredRows.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-400">
            لا يوجد طلاب يطابقون شروط العرض
          </div>
        )}
      </div>

      {/* DESKTOP TABLE VIEW (Tablets & Desktops >= 768px) */}
      <div className="hidden sm:block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold">
              <tr>
                <th className="p-3.5">اسم الطالب</th>
                <th className="p-3.5">المجموعة</th>
                <th className="p-3.5 text-center">أيام الغياب غير المعوضة</th>
                <th className="p-3.5">الحالة والتصنيف</th>
                <th className="p-3.5">تواريخ الغياب</th>
                <th className="p-3.5 text-center">تنبيه ولي الأمر</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map(({ student, totalAbsent, consecutive, dates, severity }) => (
                <tr key={student.id} className="hover:bg-slate-50/80 transition">
                  <td className="p-3.5 font-bold text-slate-800">{student.full_name}</td>
                  <td className="p-3.5 text-slate-600">{student.group_name || '—'}</td>
                  <td className="p-3.5 text-center font-bold text-sm">
                    {totalAbsent}
                    {consecutive >= 2 && (
                      <span className="mr-1 text-[11px] font-semibold text-rose-600">
                        ({consecutive} متتالي)
                      </span>
                    )}
                  </td>
                  <td className="p-3.5">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${severity.bgClass} ${severity.textClass} ${severity.borderClass}`}
                    >
                      {severity.label}
                    </span>
                  </td>
                  <td className="p-3.5 text-slate-500 max-w-xs truncate">
                    {dates.length > 0 ? dates.join('، ') : 'لا يوجد غياب'}
                  </td>
                  <td className="p-3.5 text-center">
                    {totalAbsent > 0 ? (
                      <button
                        onClick={() => handleOpenWhatsApp(student, dates)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
                      >
                        <MessageCircle className="size-3.5" />
                        <span>إرسال واتساب</span>
                      </button>
                    ) : (
                      <span className="text-slate-400 text-[11px]">لا يوجد غياب</span>
                    )}
                  </td>
                </tr>
              ))}

              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    لا يوجد طلاب يطابقون شروط العرض
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* WhatsApp Message Preview Modal */}
      <Modal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        title={`إرسال رسالة غياب: ${targetStudent?.full_name || ''}`}
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            تم تجهيز نص الرسالة باللغة العربية مع تواريخ وأيام الغياب. عند النقر على "فتح واتساب"،
            سيتم فتح تطبيق الواتساب على هاتفك لتأكيد الإرسال:
          </p>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-800" dir="rtl">
              {targetMessage}
            </pre>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <span className="text-xs text-slate-400">
              الرقم المستهدف: <span className="font-mono font-bold text-slate-700" dir="ltr">{targetStudent?.parent_phone}</span>
            </span>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="flex-1 sm:flex-none rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmSend}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
              >
                <MessageCircle className="size-4" />
                <span>فتح واتساب وإرسال</span>
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Threshold Settings Modal */}
      <Modal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        title="تخصيص حدود تنبيهات الغياب"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">
              حد الغياب المتتالي لإطلاق التنبيه (أيام)
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={thresholds.consecutiveLimit}
              onChange={(e) =>
                setThresholds((prev) => ({ ...prev, consecutiveLimit: Number(e.target.value) }))
              }
              className="w-full rounded-xl border border-slate-200 p-2.5 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">
              إجمالي أيام الغياب في الفترة لإطلاق التنبيه
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={thresholds.totalLimit}
              onChange={(e) =>
                setThresholds((prev) => ({ ...prev, totalLimit: Number(e.target.value) }))
              }
              className="w-full rounded-xl border border-slate-200 p-2.5 text-sm"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setSettingsModalOpen(false)}
              className="w-full sm:w-auto rounded-xl bg-[#1d5ca8] px-5 py-2.5 text-xs font-bold text-white"
            >
              حفظ التفضيلات
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
