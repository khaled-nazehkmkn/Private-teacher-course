'use client'

import React, { useState } from 'react'
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { createClient } from '@/lib/supabase/browser'

interface Props {
  isOpen: boolean
  onClose: () => void
  userEmail?: string
}

export function ChangePasswordModal({ isOpen, onClose, userEmail }: Props) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccess(false)

    if (newPassword.length < 8) {
      setErrorMsg('يجب ألا تقل كلمة المرور عن 8 خانات')
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('كلمتا المرور غير متطابقتين')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) {
        console.error('[ChangePassword] Error:', error)
        setErrorMsg(error.message || 'فشل تحديث كلمة المرور')
      } else {
        setSuccess(true)
        setTimeout(() => {
          setSuccess(false)
          setNewPassword('')
          setConfirmPassword('')
          onClose()
        }, 2000)
      }
    } catch (err) {
      console.error('[ChangePassword] Exception:', err)
      setErrorMsg('حدث خطأ في الاتصال، يرجى المحاولة لاحقاً')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="تغيير كلمة المرور">
      <form onSubmit={handleSubmit} className="space-y-4">
        {userEmail && (
          <div className="rounded-xl bg-slate-50 p-2.5 text-xs text-slate-500">
            الحساب الحالي: <span className="font-bold text-slate-800" dir="ltr">{userEmail}</span>
          </div>
        )}

        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>تم تغيير كلمة المرور بنجاح!</span>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-bold text-slate-700">كلمة المرور الجديدة</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pr-3 pl-10 text-sm outline-hidden focus:border-[#1d5ca8] focus:bg-white"
              dir="ltr"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute left-3 top-3 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">8 خانات على الأقل (يُفضل استخدام أرقام ورموز)</p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-slate-700">تأكيد كلمة المرور الجديدة</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pr-3 pl-10 text-sm outline-hidden focus:border-[#1d5ca8] focus:bg-white"
              dir="ltr"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={loading || success}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1d5ca8] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#164e93] disabled:opacity-50"
          >
            {loading && <Loader2 className="size-3.5 animate-spin" />}
            <span>حفظ كلمة المرور الجديدة</span>
          </button>
        </div>
      </form>
    </Modal>
  )
}
