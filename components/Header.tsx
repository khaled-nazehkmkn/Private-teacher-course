'use client'

import React, { useState, useEffect } from 'react'
import { Menu, Calendar, Type } from 'lucide-react'

interface HeaderProps {
  onOpenSidebar: () => void
  teacherName: string
  activeTab: string
}

type FontSizeOption = 'normal' | 'large' | 'xlarge'

export function Header({ onOpenSidebar, teacherName, activeTab }: HeaderProps) {
  const [fontSize, setFontSize] = useState<FontSizeOption>('normal')
  const [fontMenuOpen, setFontMenuOpen] = useState(false)

  // Initialize and apply font size on mount
  useEffect(() => {
    const saved = localStorage.getItem('app_font_size') as FontSizeOption | null
    if (saved && ['normal', 'large', 'xlarge'].includes(saved)) {
      setFontSize(saved)
      applyFontSize(saved)
    }
  }, [])

  const applyFontSize = (size: FontSizeOption) => {
    if (typeof document === 'undefined') return
    if (size === 'normal') {
      document.documentElement.style.fontSize = '16px'
    } else if (size === 'large') {
      document.documentElement.style.fontSize = '18px'
    } else if (size === 'xlarge') {
      document.documentElement.style.fontSize = '20px'
    }
  }

  const handleSelectSize = (size: FontSizeOption) => {
    setFontSize(size)
    applyFontSize(size)
    localStorage.setItem('app_font_size', size)
    setFontMenuOpen(false)
  }

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

      <div className="flex items-center gap-3">
        {/* Font Size Scaler */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setFontMenuOpen((prev) => !prev)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
            title="تكبير / تصغير خط التطبيق"
          >
            <Type className="size-3.5 text-[#1d5ca8]" />
            <span className="hidden sm:inline">حجم الخط:</span>
            <span className="text-[#1d5ca8]">
              {fontSize === 'normal' ? 'عادي' : fontSize === 'large' ? 'كبير' : 'كبير جداً'}
            </span>
          </button>

          {fontMenuOpen && (
            <div className="absolute left-0 mt-2 z-50 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-black/5">
              <button
                type="button"
                onClick={() => handleSelectSize('normal')}
                className={`flex w-full items-center justify-between px-3 py-2 text-xs font-bold transition ${
                  fontSize === 'normal' ? 'bg-blue-50 text-[#1d5ca8]' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>خط عادي (100%)</span>
                {fontSize === 'normal' && <span>✓</span>}
              </button>
              <button
                type="button"
                onClick={() => handleSelectSize('large')}
                className={`flex w-full items-center justify-between px-3 py-2 text-xs font-bold transition ${
                  fontSize === 'large' ? 'bg-blue-50 text-[#1d5ca8]' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>خط كبير (112%)</span>
                {fontSize === 'large' && <span>✓</span>}
              </button>
              <button
                type="button"
                onClick={() => handleSelectSize('xlarge')}
                className={`flex w-full items-center justify-between px-3 py-2 text-xs font-bold transition ${
                  fontSize === 'xlarge' ? 'bg-blue-50 text-[#1d5ca8]' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>كبير جداً (125%)</span>
                {fontSize === 'xlarge' && <span>✓</span>}
              </button>
            </div>
          )}
        </div>

        <div className="hidden items-center gap-2 rounded-xl bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 sm:flex">
          <Calendar className="size-3.5 text-[#1d5ca8]" />
          <span>{todayArabic}</span>
        </div>
      </div>
    </header>
  )
}
