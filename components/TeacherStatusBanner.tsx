'use client'

import React from 'react'
import { AlertCircle, Lock } from 'lucide-react'
import type { TeacherStatus } from '@/lib/teacher-status'

interface Props {
  status: TeacherStatus
}

export function TeacherStatusBanner({ status }: Props) {
  if (status.isActive) {
    return null
  }

  return (
    <div className="mb-6 flex items-center justify-between rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-xs dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
      <div className="flex items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-200/70 text-amber-900 dark:bg-amber-900/60 dark:text-amber-300">
          <Lock className="size-5" />
        </div>
        <div>
          <p className="text-sm font-bold">وضع القراءة فقط (الحساب معلّق أو منتهي الصلاحية)</p>
          <p className="text-xs text-amber-800 dark:text-amber-300">
            {status.reason || 'لا يمكنك إضافة أو تعديل البيانات الحالية، والاختبارات العامة متوقفة.'}
          </p>
        </div>
      </div>
      <div className="hidden sm:block">
        <span className="rounded-lg bg-amber-200/50 px-3 py-1.5 text-xs font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
          للتجديد تواصل مع الإدارة
        </span>
      </div>
    </div>
  )
}
