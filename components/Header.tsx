'use client'

import React from 'react'
import { Menu, Calendar, Bell } from 'lucide-react'

interface HeaderProps {
  onOpenSidebar: () => void
  teacherName: string
  activeTab: string
}

export function Header({ onOpenSidebar, teacherName, activeTab }: HeaderProps) {
  const todayArabic = new Date().toLocaleDateString('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <header className="flex h-16 items-center justify-between border-b border-[#e6ebf2] bg-white px-4 sm:px-6 print:hidden">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
          aria-label="فتح القائمة"
        >
          <Menu className="size-5" />
        </button>

        <div>
          <h2 className="text-base font-extrabold text-slate-800">{activeTab}</h2>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-2 rounded-xl bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 sm:flex">
          <Calendar className="size-3.5 text-[#1d5ca8]" />
          <span>{todayArabic}</span>
        </div>
      </div>
    </header>
  )
}
