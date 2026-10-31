'use client'

import React from 'react'
import { DatePicker } from './date-picker'
import { TimePicker } from './time-picker'

interface DateTimePickerProps {
  value: string // Format: YYYY-MM-DDTHH:mm (or ISO)
  onChange: (val: string) => void
  label?: string
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function DateTimePicker({
  value,
  onChange,
  label,
  disabled = false,
  className = '',
}: DateTimePickerProps) {
  // Split value into date part and time part
  const splitDateTime = (dtStr: string) => {
    if (!dtStr) {
      const now = new Date()
      const d = now.toISOString().split('T')[0]
      return { datePart: d, timePart: '18:00' }
    }
    const parts = dtStr.split('T')
    const datePart = parts[0] || new Date().toISOString().split('T')[0]
    const timePart = parts[1] ? parts[1].slice(0, 5) : '18:00'
    return { datePart, timePart }
  }

  const { datePart, timePart } = splitDateTime(value)

  const handleDateChange = (newDate: string) => {
    onChange(`${newDate}T${timePart}`)
  }

  const handleTimeChange = (newTime: string) => {
    onChange(`${datePart}T${newTime}`)
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && <label className="block text-xs font-bold text-slate-700">{label}</label>}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <DatePicker
          value={datePart}
          onChange={handleDateChange}
          placeholder="اختر اليوم"
          disabled={disabled}
        />
        <TimePicker
          value={timePart}
          onChange={handleTimeChange}
          placeholder="اختر الساعة"
          disabled={disabled}
        />
      </div>
    </div>
  )
}
