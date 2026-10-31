'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Clock, Check } from 'lucide-react'

interface TimePickerProps {
  value: string // Format: HH:mm (24-hour, e.g. "17:00")
  onChange: (time24: string) => void
  label?: string
  placeholder?: string
  disabled?: boolean
  className?: string
}

// Common Egyptian private lesson slots (24-hour)
const QUICK_PRESETS = [
  { label: '٣:٠٠ م', value: '15:00' },
  { label: '٤:٠٠ م', value: '16:00' },
  { label: '٤:٣٠ م', value: '16:30' },
  { label: '٥:٠٠ م', value: '17:00' },
  { label: '٥:٣٠ م', value: '17:30' },
  { label: '٦:٠٠ م', value: '18:00' },
  { label: '٦:٣٠ م', value: '18:30' },
  { label: '٧:٠٠ م', value: '19:00' },
]

export function TimePicker({
  value,
  onChange,
  label,
  placeholder = 'اختر الوقت...',
  disabled = false,
  className = '',
}: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Parse 24-hour value into 12-hour + period
  const parseTime = (timeStr: string) => {
    if (!timeStr) return { hour12: 5, minute: 0, isPM: true }
    const [hStr, mStr] = timeStr.split(':')
    const h = parseInt(hStr || '17', 10)
    const m = parseInt(mStr || '0', 10)
    const isPM = h >= 12
    const hour12 = h % 12 === 0 ? 12 : h % 12
    return { hour12, minute: m, isPM }
  }

  const { hour12, minute, isPM } = parseTime(value)

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

  // Convert 12h + period back to 24h
  const updateTime = (h12: number, min: number, pm: boolean) => {
    let h24 = h12 % 12
    if (pm) h24 += 12
    const hStr = String(h24).padStart(2, '0')
    const mStr = String(min).padStart(2, '0')
    onChange(`${hStr}:${mStr}`)
  }

  // Format display text in Arabic
  const formatDisplay = (timeStr: string) => {
    if (!timeStr) return ''
    const { hour12: h, minute: m, isPM: pm } = parseTime(timeStr)
    const mFormatted = String(m).padStart(2, '0')
    return `${h}:${mFormatted} ${pm ? 'مساءً' : 'صباحاً'}`
  }

  const minutesList = [0, 15, 30, 45]
  const hoursList = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

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
          <Clock className="size-4 shrink-0 text-[#1d5ca8]" />
          <span className={value ? 'font-bold text-slate-900' : 'text-slate-400'}>
            {value ? formatDisplay(value) : placeholder}
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">🕒</span>
      </button>

      {/* Popover Time Chooser */}
      {open && (
        <div className="absolute top-full z-50 mt-1.5 w-72 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xl transition animate-in fade-in zoom-in-95">
          {/* AM / PM Toggle */}
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => updateTime(hour12, minute, false)}
              className={`rounded-lg py-1.5 transition ${
                !isPM ? 'bg-white text-[#153b68] shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              صباحاً (ص)
            </button>
            <button
              type="button"
              onClick={() => updateTime(hour12, minute, true)}
              className={`rounded-lg py-1.5 transition ${
                isPM ? 'bg-white text-[#153b68] shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              مساءً (م)
            </button>
          </div>

          {/* Hour & Minute Pickers */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            {/* Hours */}
            <div>
              <p className="mb-1 text-[11px] font-bold text-slate-400 text-center">الساعة</p>
              <div className="grid grid-cols-3 gap-1 max-h-36 overflow-y-auto rounded-xl border border-slate-100 p-1">
                {hoursList.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => updateTime(h, minute, isPM)}
                    className={`h-7 rounded-lg text-xs font-bold transition active:scale-95 ${
                      hour12 === h
                        ? 'bg-[#1d5ca8] text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>

            {/* Minutes */}
            <div>
              <p className="mb-1 text-[11px] font-bold text-slate-400 text-center">الدقيقة</p>
              <div className="flex flex-col gap-1 max-h-36 overflow-y-auto rounded-xl border border-slate-100 p-1">
                {minutesList.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => updateTime(hour12, m, isPM)}
                    className={`h-7 rounded-lg text-xs font-bold transition active:scale-95 ${
                      minute === m
                        ? 'bg-[#1d5ca8] text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    :{String(m).padStart(2, '0')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Egyptian Lesson Slots */}
          <div className="mt-3 border-t border-slate-100 pt-2.5">
            <p className="mb-1.5 text-[10px] font-bold text-slate-400">مواعيد شائعة للحصص:</p>
            <div className="grid grid-cols-4 gap-1 text-[11px]">
              {QUICK_PRESETS.map((slot) => (
                <button
                  key={slot.value}
                  type="button"
                  onClick={() => {
                    onChange(slot.value)
                    setOpen(false)
                  }}
                  className={`rounded-lg py-1 font-bold transition ${
                    value === slot.value
                      ? 'bg-[#1d5ca8] text-white'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          </div>

          {/* Close button */}
          <div className="mt-3 flex justify-end border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-bold text-[#1d5ca8] hover:underline"
            >
              تم
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
