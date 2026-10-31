'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Calendar as CalendarIcon, ChevronRight, ChevronLeft, X } from 'lucide-react'

interface DatePickerProps {
  value: string // Format: YYYY-MM-DD
  onChange: (val: string) => void
  label?: string
  placeholder?: string
  min?: string
  max?: string
  disabled?: boolean
  className?: string
}

const ARABIC_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
]

const ARABIC_WEEKDAYS_SHORT = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']

export function DatePicker({
  value,
  onChange,
  label,
  placeholder = 'اختر التاريخ...',
  min,
  max,
  disabled = false,
  className = '',
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Current viewed month/year in calendar
  const initialDate = value ? new Date(value) : new Date()
  const [viewYear, setViewYear] = useState(initialDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth()) // 0 - 11

  // Keep view in sync when value changes externally
  useEffect(() => {
    if (value) {
      const d = new Date(value)
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear())
        setViewMonth(d.getMonth())
      }
    }
  }, [value])

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  // Helpers
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDayWeekday = new Date(viewYear, viewMonth, 1).getDay() // 0 = Sunday

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const handleSelectDay = (day: number) => {
    const y = viewYear
    const m = String(viewMonth + 1).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    onChange(`${y}-${m}-${d}`)
    setOpen(false)
  }

  const handleSetToday = (e: React.MouseEvent) => {
    e.stopPropagation()
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    onChange(`${y}-${m}-${d}`)
    setViewYear(y)
    setViewMonth(now.getMonth())
    setOpen(false)
  }

  const handleSetTomorrow = (e: React.MouseEvent) => {
    e.stopPropagation()
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const y = tomorrow.getFullYear()
    const m = String(tomorrow.getMonth() + 1).padStart(2, '0')
    const d = String(tomorrow.getDate()).padStart(2, '0')
    onChange(`${y}-${m}-${d}`)
    setViewYear(y)
    setViewMonth(tomorrow.getMonth())
    setOpen(false)
  }

  // Format display text in Arabic
  const formatDisplay = (val: string) => {
    if (!val) return ''
    try {
      const parts = val.split('-')
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString('ar-EG', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
        }
      }
      return val
    } catch {
      return val
    }
  }

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && <label className="mb-1 block text-xs font-bold text-slate-700">{label}</label>}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold text-slate-800 transition outline-hidden hover:bg-white focus:border-[#1d5ca8] focus:bg-white disabled:opacity-50 ${
          open ? 'border-[#1d5ca8] bg-white ring-2 ring-[#1d5ca8]/10' : ''
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          <CalendarIcon className="size-4 shrink-0 text-[#1d5ca8]" />
          <span className={value ? 'font-bold text-slate-900' : 'text-slate-400'}>
            {value ? formatDisplay(value) : placeholder}
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">📅</span>
      </button>

      {/* Popover Calendar */}
      {open && (
        <div className="absolute top-full z-50 mt-1.5 w-72 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xl transition animate-in fade-in zoom-in-95">
          {/* Calendar Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <button
              type="button"
              onClick={handleNextMonth} // in RTL, next month is on the left
              className="grid size-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <ChevronRight className="size-4" />
            </button>

            <span className="text-xs font-extrabold text-slate-800">
              {ARABIC_MONTHS[viewMonth]} {viewYear}
            </span>

            <button
              type="button"
              onClick={handlePrevMonth} // in RTL, prev month is on the right
              className="grid size-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <ChevronLeft className="size-4" />
            </button>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-1 pt-2 pb-1 text-center text-[10px] font-bold text-slate-400">
            {ARABIC_WEEKDAYS_SHORT.map((wd, i) => (
              <div key={i}>{wd}</div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 pt-1 text-center text-xs">
            {/* Empty slots before first day */}
            {Array.from({ length: firstDayWeekday }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {/* Days of month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dayStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(
                day
              ).padStart(2, '0')}`
              const isSelected = value === dayStr
              const isToday =
                new Date().toISOString().split('T')[0] === dayStr

              const isDisabled = (min && dayStr < min) || (max && dayStr > max)

              return (
                <button
                  key={day}
                  type="button"
                  disabled={Boolean(isDisabled)}
                  onClick={() => handleSelectDay(day)}
                  className={`grid size-8 place-items-center rounded-xl text-xs font-bold transition active:scale-95 disabled:opacity-20 ${
                    isSelected
                      ? 'bg-[#1d5ca8] text-white shadow-xs'
                      : isToday
                      ? 'border border-[#1d5ca8]/50 bg-blue-50 text-[#1d5ca8]'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Quick preset pills */}
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSetToday}
                className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-200"
              >
                اليوم
              </button>
              <button
                type="button"
                onClick={handleSetTomorrow}
                className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-200"
              >
                غداً
              </button>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[11px] font-bold text-[#1d5ca8] hover:underline"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
