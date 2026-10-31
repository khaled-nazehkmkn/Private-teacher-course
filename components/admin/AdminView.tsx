'use client'

import React, { useState } from 'react'
import {
  ShieldAlert,
  UserPlus,
  Lock,
  Unlock,
  Calendar,
  Phone,
  Mail,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { DatePicker } from '@/components/ui/date-picker'

export interface AdminTeacherItem {
  id: string
  full_name: string
  email?: string
  phone: string | null
  subject: string | null
  is_admin: boolean
  active_from: string | null
  active_to: string | null
  is_suspended: boolean
  created_at: string
}

interface Props {
  teachers: AdminTeacherItem[]
  onRefreshTeachers: () => Promise<void>
}

export function AdminView({ teachers, onRefreshTeachers }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Form states
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [subject, setSubject] = useState('الرياضيات')
  const [activeFrom, setActiveFrom] = useState(new Date().toISOString().split('T')[0])
  const [activeTo, setActiveTo] = useState(
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  )
  const [isAdmin, setIsAdmin] = useState(false)

  // Create new teacher
  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setLoading(true)

    try {
      const res = await fetch('/api/admin/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          password,
          phone: phone.trim() || null,
          subject: subject.trim(),
          active_from: activeFrom,
          active_to: activeTo,
          is_admin: isAdmin,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || 'فشل إنشاء حساب المعلم')
      } else {
        await onRefreshTeachers()
        setModalOpen(false)
        setFullName('')
        setEmail('')
        setPassword('')
        setPhone('')
      }
    } catch (err) {
      console.error(err)
      setErrorMsg('حدث خطأ في الاتصال بالخادم')
    } finally {
      setLoading(false)
    }
  }

  // Toggle Suspend Status
  const handleToggleSuspend = async (teacher: AdminTeacherItem) => {
    setActionLoadingId(teacher.id)
    try {
      const res = await fetch(`/api/admin/teachers/${teacher.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_suspended: !teacher.is_suspended,
        }),
      })

      if (res.ok) {
        await onRefreshTeachers()
      } else {
        alert('فشل تغيير حالة المعلم')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setActionLoadingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-amber-600" />
            <h2 className="text-xl font-extrabold text-[#153b68]">لوحة تحكم المشرف (Admin)</h2>
          </div>
          <p className="text-xs text-slate-500">
            إنشاء حسابات المعلمين، تحديد فترات الاشتراك، والتعليق أو التفعيل
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-[#1d5ca8] px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#164e93]"
        >
          <UserPlus className="size-4" />
          <span>إضافة حساب معلم جديد</span>
        </button>
      </div>

      {/* Teachers List Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
              <tr>
                <th className="p-3.5">اسم المعلم</th>
                <th className="p-3.5">المادة</th>
                <th className="p-3.5">الهاتف</th>
                <th className="p-3.5">فترة الاشتراك</th>
                <th className="p-3.5">الحالة</th>
                <th className="p-3.5 text-center">التحكم</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {teachers.map((t) => {
                const today = new Date().toISOString().split('T')[0]
                const isExpired = t.active_to && t.active_to < today

                return (
                  <tr key={t.id} className="hover:bg-slate-50/80">
                    <td className="p-3.5 font-bold text-slate-800">
                      {t.full_name}
                      {t.is_admin && (
                        <span className="mr-2 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-800">
                          مشرف
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-slate-600">{t.subject || '—'}</td>
                    <td className="p-3.5 text-slate-600" dir="ltr">
                      {t.phone || '—'}
                    </td>
                    <td className="p-3.5 text-slate-500">
                      من {t.active_from || 'البداية'} إلى {t.active_to || 'مفتوح'}
                    </td>
                    <td className="p-3.5">
                      {t.is_suspended ? (
                        <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700">
                          معلّق
                        </span>
                      ) : isExpired ? (
                        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                          منتهي الصلاحية
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                          نشط
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => handleToggleSuspend(t)}
                        disabled={actionLoadingId === t.id}
                        className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                          t.is_suspended
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                        }`}
                      >
                        {actionLoadingId === t.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : t.is_suspended ? (
                          <>
                            <Unlock className="size-3.5" />
                            <span>تفعيل</span>
                          </>
                        ) : (
                          <>
                            <Lock className="size-3.5" />
                            <span>تعليق</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Teacher Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="إضافة حساب معلم جديد">
        <form onSubmit={handleCreateTeacher} className="space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">الاسم الكامل للمعلم</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="مثال: أستاذ أحمد محمود"
              className="w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-hidden focus:border-[#1d5ca8]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">البريد الإلكتروني</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@example.com"
                className="w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-hidden focus:border-[#1d5ca8]"
                dir="ltr"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">كلمة المرور الأولية</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-hidden focus:border-[#1d5ca8]"
                dir="ltr"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">المادة الدراسية</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="مثال: الرياضيات"
                className="w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-hidden focus:border-[#1d5ca8]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">رقم الهاتف</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01012345678"
                className="w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-hidden focus:border-[#1d5ca8]"
                dir="ltr"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <DatePicker
                label="تاريخ البداية (Active From)"
                value={activeFrom}
                onChange={setActiveFrom}
              />
            </div>

            <div>
              <DatePicker
                label="تاريخ الانتهاء (Active To)"
                value={activeTo}
                onChange={setActiveTo}
                placeholder="غير محدد (مفتوح)"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="adminCheckbox"
              checked={isAdmin}
              onChange={(e) => setIsAdmin(e.target.checked)}
              className="size-4 rounded text-[#1d5ca8]"
            />
            <label htmlFor="adminCheckbox" className="text-xs font-bold text-slate-700 cursor-pointer">
              منح صلاحيات المشرف الكاملة (Admin)
            </label>
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
              إنشاء الحساب
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
