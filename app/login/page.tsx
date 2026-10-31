'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { GraduationCap, Lock, Mail, ArrowLeft, AlertCircle, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('[Login] Supabase Auth error:', error)
        setErrorMsg('البريد الإلكتروني أو كلمة المرور غير صحيحة')
        setLoading(false)
        return
      }

      if (data.session) {
        router.push('/')
        router.refresh()
      }
    } catch (err) {
      console.error('[Login] Exception:', err)
      setErrorMsg('حدث خطأ أثناء تسجيل الدخول، يرجى المحاولة لاحقاً')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f6f8fb] p-4 text-[#17263b]">
      <div className="w-full max-w-md rounded-3xl border border-[#e6ebf2] bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <div className="flex flex-col items-center text-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-[#153b68] text-white shadow-md">
            <GraduationCap className="size-8" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold text-[#153b68]">معلّم | تسجيل الدخول</h1>
          <p className="mt-1 text-sm text-slate-500">
            بوابة المدرسين وإدارة الدروس الخصوصية
          </p>
        </div>

        {errorMsg && (
          <div className="mt-6 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">البريد الإلكتروني</label>
            <div className="relative">
              <Mail className="absolute right-3.5 top-3 size-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@example.com"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pr-10 pl-3 text-sm transition focus:border-[#1d5ca8] focus:bg-white focus:outline-hidden"
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">كلمة المرور</label>
            <div className="relative">
              <Lock className="absolute right-3.5 top-3 size-4 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pr-10 pl-3 text-sm transition focus:border-[#1d5ca8] focus:bg-white focus:outline-hidden"
                dir="ltr"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1d5ca8] py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#164e93] disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                جاري الدخول...
              </>
            ) : (
              <>
                <span>دخول إلى لوحة التحكم</span>
                <ArrowLeft className="size-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 border-t border-slate-100 pt-5 text-center text-xs text-slate-400">
          <p>يتم إنشاء حسابات المعلمين بواسطة إدارة النظام فقط.</p>
          <p className="mt-1">للطلاب: يتم فتح الاختبارات عبر الرابط المرسل بدون تسجيل دخول.</p>
        </div>
      </div>
    </div>
  )
}
