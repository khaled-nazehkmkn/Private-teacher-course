'use client'

import React, { useState } from 'react'
import { MessageSquare, Calendar, User, Search, Filter } from 'lucide-react'

export interface MessageLogItem {
  id: string
  student_id: string | null
  student_name?: string
  kind: 'absence' | 'result' | 'custom'
  body: string
  created_at: string
}

interface Props {
  logs: MessageLogItem[]
}

export function MessageLogView({ logs }: Props) {
  const [searchTerm, setSearchTerm] = useState('')
  const [kindFilter, setKindFilter] = useState<'all' | 'absence' | 'result' | 'custom'>('all')

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.body.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.student_name && log.student_name.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesKind = kindFilter === 'all' || log.kind === kindFilter
    return matchesSearch && matchesKind
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-extrabold text-[#153b68]">سجل رسائل الواتساب</h2>
          <p className="text-xs text-slate-500">
            أرشيف الرسائل والتنبيهات المجهزة لأولياء الأمور ومواعيد إرسالها
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-2.5 size-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث في نص الرسالة أو اسم الطالب..."
            className="w-full rounded-xl bg-slate-50 py-2 pr-9 pl-3 text-xs outline-hidden focus:bg-white focus:ring-1 focus:ring-[#1d5ca8]"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400">نوع الرسالة:</span>
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as any)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-hidden"
          >
            <option value="all">جميع الأنواع</option>
            <option value="absence">تنبيهات الغياب</option>
            <option value="result">نتائج الاختبارات</option>
            <option value="custom">رسائل مخصصة</option>
          </select>
        </div>
      </div>

      {/* Logs List */}
      <div className="space-y-3">
        {filteredLogs.map((log) => (
          <div
            key={log.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-[#1d5ca8]/30"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    log.kind === 'absence'
                      ? 'bg-rose-50 text-rose-700'
                      : log.kind === 'result'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-blue-50 text-blue-700'
                  }`}
                >
                  {log.kind === 'absence'
                    ? 'تنبيه غياب'
                    : log.kind === 'result'
                    ? 'نتيجة اختبار'
                    : 'رسالة مخصصة'}
                </span>
                <span className="text-xs font-bold text-slate-700">
                  الطالب: {log.student_name || 'طالب'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Calendar className="size-3.5" />
                <span>{new Date(log.created_at).toLocaleString('ar-EG')}</span>
              </div>
            </div>

            <p className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs font-sans text-slate-700 leading-relaxed">
              {log.body}
            </p>
          </div>
        ))}

        {filteredLogs.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">
            <MessageSquare className="mx-auto size-10 text-slate-300" />
            <p className="mt-3 text-sm font-bold text-slate-600">لا توجد رسائل مسجلة</p>
            <p className="mt-1 text-xs text-slate-400">
              سيتم تسجيل جميع الرسائل المجهزة تلقائياً عند النقر على إرسال واتساب
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
