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
  KeyRound,
  Edit3,
  Users,
  Layers,
  Copy,
  Check,
  MessageCircle,
  Database,
  Sparkles,
} from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { DatePicker } from '@/components/ui/date-picker'
import { buildWhatsAppLink } from '@/lib/whatsapp'

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
  total_students?: number
  total_groups?: number
}

interface Props {
  teachers: AdminTeacherItem[]
  onRefreshTeachers: () => Promise<void>
}

export function AdminView({ teachers, onRefreshTeachers }: Props) {
  // Create modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Action loading indicator per teacher
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  // Create Form states
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

  // Edit Teacher Modal State
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingTeacher, setEditingTeacher] = useState<AdminTeacherItem | null>(null)
  const [editFullName, setEditFullName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editSubject, setEditSubject] = useState('')
  const [editActiveFrom, setEditActiveFrom] = useState('')
  const [editActiveTo, setEditActiveTo] = useState('')
  const [editIsAdmin, setEditIsAdmin] = useState(false)
  const [editIsSuspended, setEditIsSuspended] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editErrorMsg, setEditErrorMsg] = useState<string | null>(null)

  // Reset Password Modal State
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [resetTargetTeacher, setResetTargetTeacher] = useState<AdminTeacherItem | null>(null)
  const [resetLoading, setResetLoading] = useState(false)
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null)
  const [copiedPassword, setCopiedPassword] = useState(false)
  const [copiedFullMessage, setCopiedFullMessage] = useState(false)

  // Global system metrics
  const totalTeachers = teachers.length
  const totalStudents = teachers.reduce((acc, t) => acc + (t.total_students || 0), 0)
  const totalGroups = teachers.reduce((acc, t) => acc + (t.total_groups || 0), 0)
  const activeTeachers = teachers.filter((t) => !t.is_suspended).length

  // Create new teacher handler
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

  // Open Edit Modal
  const handleOpenEdit = (teacher: AdminTeacherItem) => {
    setEditingTeacher(teacher)
    setEditFullName(teacher.full_name)
    setEditPhone(teacher.phone || '')
    setEditSubject(teacher.subject || '')
    setEditActiveFrom(teacher.active_from || new Date().toISOString().split('T')[0])
    setEditActiveTo(teacher.active_to || '')
    setEditIsAdmin(teacher.is_admin)
    setEditIsSuspended(teacher.is_suspended)
    setEditErrorMsg(null)
    setEditModalOpen(true)
  }

  // Submit Edit Teacher
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTeacher) return
    setEditLoading(true)
    setEditErrorMsg(null)

    try {
      const res = await fetch(`/api/admin/teachers/${editingTeacher.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: editFullName.trim(),
          phone: editPhone.trim() || null,
          subject: editSubject.trim() || null,
          active_from: editActiveFrom || null,
          active_to: editActiveTo || null,
          is_admin: editIsAdmin,
          is_suspended: editIsSuspended,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setEditErrorMsg(data.error || 'فشل حفظ التعديلات')
      } else {
        await onRefreshTeachers()
        setEditModalOpen(false)
      }
    } catch (err) {
      console.error(err)
      setEditErrorMsg('حدث خطأ في الاتصال بالخادم')
    } finally {
      setEditLoading(false)
    }
  }

  // Open Reset Password Modal
  const handleOpenResetPassword = (teacher: AdminTeacherItem) => {
    setResetTargetTeacher(teacher)
    setGeneratedPassword(null)
    setCopiedPassword(false)
    setCopiedFullMessage(false)
    setResetModalOpen(true)
  }

  // Execute Password Reset (Server generates cryptographically secure complex password)
  const handleExecuteResetPassword = async () => {
    if (!resetTargetTeacher) return
    setResetLoading(true)

    try {
      const res = await fetch(`/api/admin/teachers/${resetTargetTeacher.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'فشل إعادة تعيين كلمة المرور')
      } else {
        setGeneratedPassword(data.password)
      }
    } catch (err) {
      console.error(err)
      alert('حدث خطأ في الاتصال بالخادم')
    } finally {
      setResetLoading(false)
    }
  }

  // Copy password to clipboard
  const handleCopyPassword = () => {
    if (!generatedPassword) return
    navigator.clipboard.writeText(generatedPassword)
    setCopiedPassword(true)
    setTimeout(() => setCopiedPassword(false), 2500)
  }

  // Copy full login credentials message
  const getFullLoginMessage = () => {
    if (!resetTargetTeacher || !generatedPassword) return ''
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://private-teacher-course.vercel.app'
    return `مرحباً أستاذ ${resetTargetTeacher.full_name}،
تم تعيين كلمة مرور جديدة لحسابك في تطبيق "معلّم":
📧 البريد: ${resetTargetTeacher.email || '—'}
🔑 كلمة المرور الجديدة: ${generatedPassword}
🔗 رابط تسجيل الدخول: ${origin}/login

يرجى تسجيل الدخول بها، ويمكنك تغييرها في أي وقت من داخل حسابك عبر زر المفتاح 🔑 في القائمة.`
  }

  const handleCopyFullMessage = () => {
    const text = getFullLoginMessage()
    navigator.clipboard.writeText(text)
    setCopiedFullMessage(true)
    setTimeout(() => setCopiedFullMessage(false), 2500)
  }

  // Send credentials via WhatsApp
  const handleSendViaWhatsApp = () => {
    if (!resetTargetTeacher || !generatedPassword) return
    const text = getFullLoginMessage()
    const link = buildWhatsAppLink(resetTargetTeacher.phone || '', text)
    window.open(link, '_blank')
  }

  // Toggle Suspend Status directly from table
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

  // Compute fee tier badge based on student count
  const renderTierBadge = (studentsCount: number = 0) => {
    if (studentsCount > 100) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200">
          استهلاك مرتفع (يتطلب ترقية)
        </span>
      )
    }
    if (studentsCount > 30) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-[#1d5ca8] border border-blue-200">
          باقة قياسية
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
        باقة أساسية
      </span>
    )
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
            إدارة حسابات المعلمين، مراقبة حجم الاستهلاك والطلاب لتحديد الرسوم، وتوليد كلمات المرور
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-[#1d5ca8] px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#164e93] transition active:scale-95"
        >
          <UserPlus className="size-4" />
          <span>إضافة حساب معلم جديد</span>
        </button>
      </div>

      {/* Global System Metrics Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold text-slate-600">إجمالي المعلمين</span>
            <Users className="size-4 text-[#1d5ca8]" />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">{totalTeachers}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {activeTeachers} نشط · {totalTeachers - activeTeachers} معلّق
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold text-slate-600">إجمالي الطلاب</span>
            <Database className="size-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">{totalStudents}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">عبر جميع المعلمين</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold text-slate-600">المجموعات الدراسية</span>
            <Layers className="size-4 text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">{totalGroups}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">مجموعات نشطة</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold text-slate-600">معدل الطلاب / معلّم</span>
            <Sparkles className="size-4 text-purple-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">
            {totalTeachers > 0 ? Math.round(totalStudents / totalTeachers) : 0}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">متوسط الحجم الاستهلاكي</p>
        </div>
      </div>

      {/* Teachers List Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="border-b border-slate-100 p-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-900">قائمة المعلمين المسجلين</h3>
            <p className="text-xs text-slate-500">
              بيانات المجموعات والطلاب مخصصة لحساب باقات التكلفة والاستهلاك فقط
            </p>
          </div>
          <button
            onClick={onRefreshTeachers}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
          >
            تحديث البيانات 🔄
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
              <tr>
                <th className="p-3.5">اسم المعلم والبريد</th>
                <th className="p-3.5">المادة</th>
                <th className="p-3.5">الهاتف</th>
                <th className="p-3.5">حجم الاستهلاك (طلاب ومجموعات)</th>
                <th className="p-3.5">فترة الاشتراك</th>
                <th className="p-3.5">الحالة</th>
                <th className="p-3.5 text-center">التحكم وإعادة التعيين</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {teachers.map((t) => {
                const today = new Date().toISOString().split('T')[0]
                const isExpired = t.active_to && t.active_to < today
                const studentCount = t.total_students || 0
                const groupCount = t.total_groups || 0

                return (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition">
                    {/* Name & Email */}
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{t.full_name}</span>
                        {t.is_admin && (
                          <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-800">
                            مشرف
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5" dir="ltr">
                        {t.email || 'بدون بريد'}
                      </p>
                    </td>

                    {/* Subject */}
                    <td className="p-3.5 text-slate-600 font-bold">{t.subject || '—'}</td>

                    {/* Phone */}
                    <td className="p-3.5 text-slate-600 font-mono" dir="ltr">
                      {t.phone || '—'}
                    </td>

                    {/* Total Groups & Students (Read-only metrics for billing) */}
                    <td className="p-3.5">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="font-extrabold text-slate-800">
                          {studentCount} طالب · {groupCount} مجموعات
                        </span>
                        {renderTierBadge(studentCount)}
                      </div>
                    </td>

                    {/* Subscription bounds */}
                    <td className="p-3.5 text-slate-500">
                      <div>من: {t.active_from || 'البداية'}</div>
                      <div className="text-[11px] text-slate-400">إلى: {t.active_to || 'مفتوح'}</div>
                    </td>

                    {/* Account Status Badge */}
                    <td className="p-3.5">
                      {t.is_suspended ? (
                        <span className="rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-[11px] font-bold text-rose-700">
                          معلّق
                        </span>
                      ) : isExpired ? (
                        <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                          منتهي الصلاحية
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                          نشط
                        </span>
                      )}
                    </td>

                    {/* Actions: Edit, Reset Password, Suspend/Unlock */}
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Edit Teacher Details */}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(t)}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-[#1d5ca8] transition"
                          title="تعديل بيانات المعلم والاشتراك"
                        >
                          <Edit3 className="size-3.5" />
                          <span>تعديل</span>
                        </button>

                        {/* Reset Password */}
                        <button
                          type="button"
                          onClick={() => handleOpenResetPassword(t)}
                          className="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-800 shadow-2xs hover:bg-amber-100 transition"
                          title="توليد كلمة سر عشوائية معقدة وإعادة تعيينها"
                        >
                          <KeyRound className="size-3.5" />
                          <span>كلمة السر</span>
                        </button>

                        {/* Toggle Suspend */}
                        <button
                          type="button"
                          onClick={() => handleToggleSuspend(t)}
                          disabled={actionLoadingId === t.id}
                          className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold transition shadow-2xs ${
                            t.is_suspended
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                          }`}
                          title={t.is_suspended ? 'تفعيل الحساب' : 'تعليق الحساب'}
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
                      </div>
                    </td>
                  </tr>
                )
              })}

              {teachers.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    لا يوجد معلمون مسجلون حالياً
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE NEW TEACHER */}
      {/* ========================================================================= */}
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
              <span>إنشاء الحساب</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: EDIT TEACHER DETAILS */}
      {/* ========================================================================= */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`تعديل بيانات المعلم: ${editingTeacher?.full_name || ''}`}
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          {editErrorMsg && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
              <AlertCircle className="size-4 shrink-0" />
              <span>{editErrorMsg}</span>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">الاسم الكامل</label>
            <input
              type="text"
              required
              value={editFullName}
              onChange={(e) => setEditFullName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-hidden focus:border-[#1d5ca8]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">المادة الدراسية</label>
              <input
                type="text"
                required
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-hidden focus:border-[#1d5ca8]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">رقم الهاتف</label>
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-hidden focus:border-[#1d5ca8]"
                dir="ltr"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <DatePicker
                label="تاريخ بداية الاشتراك"
                value={editActiveFrom}
                onChange={setEditActiveFrom}
              />
            </div>

            <div>
              <DatePicker
                label="تاريخ نهاية الاشتراك"
                value={editActiveTo}
                onChange={setEditActiveTo}
                placeholder="مفتوح"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editIsSuspended}
                onChange={(e) => setEditIsSuspended(e.target.checked)}
                className="size-4 rounded text-rose-600"
              />
              <span className="text-xs font-bold text-rose-700">
                تعليق الحساب (Suspended - منع المعلم من التعديل)
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editIsAdmin}
                onChange={(e) => setEditIsAdmin(e.target.checked)}
                className="size-4 rounded text-[#1d5ca8]"
              />
              <span className="text-xs font-bold text-slate-700">
                صلاحية المشرف العام (Admin)
              </span>
            </label>
          </div>

          <div className="mt-5 flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={editLoading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1d5ca8] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#164e93] disabled:opacity-50"
            >
              {editLoading && <Loader2 className="size-3.5 animate-spin" />}
              <span>حفظ التعديلات</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: RESET PASSWORD (GENERATE COMPLEX PASSWORD) */}
      {/* ========================================================================= */}
      <Modal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title={`إعادة تعيين كلمة المرور: ${resetTargetTeacher?.full_name || ''}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            سيقوم النظام بتوليد كلمة سر عشوائية قوية ومعقدة تحتوي على حروف وأرقام ورموز خاصة وتعيينها في حساب المعلم، لتقوم بنسخها أو إرسالها له مباشرة عبر واتساب.
          </p>

          {/* Teacher Summary Box */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">المعلم:</span>
              <span className="font-bold text-slate-800">{resetTargetTeacher?.full_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">البريد المسجل:</span>
              <span className="font-mono text-slate-700" dir="ltr">{resetTargetTeacher?.email || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">رقم الهاتف:</span>
              <span className="font-mono text-slate-700" dir="ltr">{resetTargetTeacher?.phone || '—'}</span>
            </div>
          </div>

          {!generatedPassword ? (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleExecuteResetPassword}
                disabled={resetLoading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#153b68] py-3 text-xs font-bold text-white shadow-md hover:bg-[#102d50] disabled:opacity-50 transition active:scale-98"
              >
                {resetLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>جاري توليد وتعيين كلمة المرور...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4 text-amber-400" />
                    <span>توليد كلمة سر عشوائية معقدة وتعيينها الآن</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs mb-2">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <span>تم تعيين كلمة المرور الجديدة بنجاح!</span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-white p-3 border border-emerald-200">
                  <span className="font-mono text-base font-black tracking-wider text-slate-900 select-all" dir="ltr">
                    {generatedPassword}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyPassword}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200 transition"
                  >
                    {copiedPassword ? (
                      <>
                        <Check className="size-3.5 text-emerald-600" />
                        <span className="text-emerald-700">تم النسخ!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" />
                        <span>نسخ الكلمة</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Action Buttons: Copy Message & Send via WhatsApp */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyFullMessage}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                >
                  {copiedFullMessage ? (
                    <>
                      <Check className="size-3.5 text-emerald-600" />
                      <span className="text-emerald-700">تم نسخ الرسالة!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      <span>نسخ بيانات الدخول</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSendViaWhatsApp}
                  disabled={!resetTargetTeacher?.phone}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition"
                >
                  <MessageCircle className="size-4" />
                  <span>إرسال عبر واتساب</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-400 text-center">
                يستطيع المعلم استخدام هذه الكلمة للدخول، ثم يمكنه تغييرها في أي وقت من حسابه.
              </p>
            </div>
          )}

          <div className="mt-4 flex justify-end pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setResetModalOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              إغلاق
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
