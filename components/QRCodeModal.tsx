'use client'

import React, { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Copy, Check, Download, ExternalLink } from 'lucide-react'

interface QRCodeModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  url: string
}

export function QRCodeModal({ isOpen, onClose, title, url }: QRCodeModalProps) {
  const [dataUrl, setDataUrl] = useState<string>('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let isMounted = true
    if (isOpen && url) {
      // Lazy load QRCode module
      import('qrcode')
        .then((QRCode) => {
          QRCode.toDataURL(url, {
            width: 320,
            margin: 2,
            color: {
              dark: '#153b68',
              light: '#ffffff',
            },
          }).then((res) => {
            if (isMounted) setDataUrl(res)
          })
        })
        .catch((err) => {
          console.error('[QRCode] Error generating QR:', err)
        })
    }
    return () => {
      isMounted = false
    }
  }, [isOpen, url])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      console.error('Failed to copy', e)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`مشاركة اختبار: ${title}`} maxWidth="max-w-md">
      <div className="flex flex-col items-center py-3 text-center">
        {dataUrl ? (
          <div className="rounded-2xl border-4 border-[#153b68]/10 bg-white p-3 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={dataUrl} alt="QR Code" className="size-56 object-contain" />
          </div>
        ) : (
          <div className="grid size-56 place-items-center rounded-2xl bg-slate-100 text-sm text-slate-400">
            جاري إنشاء رمز QR...
          </div>
        )}

        <p className="mt-4 text-xs text-slate-500">
          يمكن للطلاب مسح الرمز بكاميرا الهاتف أو فتح الرابط المباشر وإدخال كود الدخول الخاص بهم.
        </p>

        <div className="mt-4 flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs">
          <input
            type="text"
            readOnly
            value={url}
            className="w-full bg-transparent px-1 font-mono text-slate-600 outline-none"
            dir="ltr"
          />
          <button
            onClick={copyLink}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 font-bold text-slate-700 shadow-xs hover:bg-slate-100"
          >
            {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
            {copied ? 'تم النسخ' : 'نسخ'}
          </button>
        </div>

        <div className="mt-5 flex w-full items-center justify-center gap-3">
          {dataUrl && (
            <a
              href={dataUrl}
              download={`exam-${title}.png`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <Download className="size-4" />
              تحميل صورة الرمز
            </a>
          )}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1d5ca8] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#164e93]"
          >
            <ExternalLink className="size-4" />
            فتح صفحة الطالب
          </a>
        </div>
      </div>
    </Modal>
  )
}
