'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  maxWidth?: string
}

export function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-xl' }: ModalProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Modal Dialog (Bottom sheet on phone, centered modal on tablet/desktop) */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-50 flex w-full max-h-[92vh] flex-col rounded-t-[28px] bg-white p-5 shadow-2xl transition-all animate-in slide-in-from-bottom sm:rounded-3xl sm:p-6 sm:slide-in-from-bottom-0 sm:zoom-in-95',
          maxWidth
        )}
      >
        {/* Mobile drag handle indicator */}
        <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-slate-200 sm:hidden" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 sm:pb-4">
          <h3 className="text-base font-extrabold text-slate-900 sm:text-lg">{title}</h3>
          <button
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 active:scale-95"
            aria-label="إغلاق"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="mt-4 overflow-y-auto overscroll-contain pb-6 sm:pb-2">
          {children}
        </div>
      </div>
    </div>
  )
}
