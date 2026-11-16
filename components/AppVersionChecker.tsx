'use client'

import React, { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'

const CLIENT_BUILD_ID = process.env.NEXT_PUBLIC_APP_BUILD_ID || ''
const CHECK_COOLDOWN_MS = 15_000
const BACKGROUND_INTERVAL_MS = 5 * 60 * 1000
const RELOAD_STORAGE_KEY = 'app_reloaded_for_version'
const CHUNK_RELOAD_TS_KEY = 'app_chunk_reload_ts'

declare global {
  interface Window {
    __ACTIVE_EXAM_SESSION__?: boolean
  }
}

export function AppVersionChecker() {
  const [updating, setUpdating] = useState(false)
  const isReloadingRef = useRef(false)
  const lastCheckAtRef = useRef(0)
  const inFlightRef = useRef(false)

  useEffect(() => {
    if (
      !CLIENT_BUILD_ID ||
      CLIENT_BUILD_ID === 'development' ||
      CLIENT_BUILD_ID === 'unknown'
    ) {
      return
    }

    const triggerCleanReload = async (targetVersion?: string) => {
      if (isReloadingRef.current || window.__ACTIVE_EXAM_SESSION__) {
        return
      }

      if (targetVersion) {
        try {
          const alreadyReloaded = sessionStorage.getItem(RELOAD_STORAGE_KEY)
          if (alreadyReloaded === targetVersion) {
            return
          }
          sessionStorage.setItem(RELOAD_STORAGE_KEY, targetVersion)
        } catch {
          // Ignore sessionStorage restrictions
        }
      }

      isReloadingRef.current = true
      setUpdating(true)

      try {
        // Force browser HTTP cache to revalidate current page HTML before reloading
        await fetch(window.location.href, {
          cache: 'reload',
          credentials: 'same-origin',
        })
      } catch {
        // Proceed with reload even if preflight revalidate fails
      }

      setTimeout(() => {
        window.location.reload()
      }, 250)
    }

    const checkForUpdates = async (force = false) => {
      try {
        if (
          isReloadingRef.current ||
          inFlightRef.current ||
          window.__ACTIVE_EXAM_SESSION__
        ) {
          return
        }

        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          return
        }

        const now = Date.now()
        if (!force && now - lastCheckAtRef.current < CHECK_COOLDOWN_MS) {
          return
        }

        lastCheckAtRef.current = now
        inFlightRef.current = true

        const res = await fetch(`/api/version?t=${now}`, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'same-origin',
          headers: {
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
          },
        })

        if (!res.ok) return

        const data = await res.json()
        const serverVersion = typeof data?.version === 'string' ? data.version.trim() : ''

        if (
          serverVersion &&
          serverVersion !== 'development' &&
          serverVersion !== 'unknown' &&
          serverVersion !== CLIENT_BUILD_ID
        ) {
          await triggerCleanReload(serverVersion)
        }
      } catch (error) {
        console.error('[AppVersionChecker] Failed to check app version:', error)
      } finally {
        inFlightRef.current = false
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkForUpdates(false)
      }
    }

    const handleFocus = () => {
      void checkForUpdates(false)
    }

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        void checkForUpdates(true)
      }
    }

    const handleOnline = () => {
      void checkForUpdates(true)
    }

    const handleChunkError = (reason: unknown) => {
      if (window.__ACTIVE_EXAM_SESSION__ || isReloadingRef.current) return
      const message =
        typeof reason === 'string'
          ? reason
          : reason instanceof Error
          ? reason.message
          : (reason as { message?: string } | null)?.message || ''

      if (
        message.includes('ChunkLoadError') ||
        message.includes('Loading chunk') ||
        message.includes('Failed to fetch dynamically imported module')
      ) {
        try {
          const lastTs = Number(sessionStorage.getItem(CHUNK_RELOAD_TS_KEY) || '0')
          if (Date.now() - lastTs < 30_000) return
          sessionStorage.setItem(CHUNK_RELOAD_TS_KEY, String(Date.now()))
        } catch {
          // Ignore storage error
        }
        void triggerCleanReload()
      }
    }

    const onWindowError = (event: ErrorEvent) => {
      handleChunkError(event.error || event.message)
    }

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      handleChunkError(event.reason)
    }

    // Immediate check when app mounts (catches cached PWA/HTML on open)
    void checkForUpdates(true)

    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void checkForUpdates(false)
      }
    }, BACKGROUND_INTERVAL_MS)

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('pageshow', handlePageShow)
    window.addEventListener('online', handleOnline)
    window.addEventListener('error', onWindowError)
    window.addEventListener('unhandledrejection', onUnhandledRejection)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('pageshow', handlePageShow)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('error', onWindowError)
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
    }
  }, [])

  if (!updating) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-3 z-[100] flex justify-center px-4 pointer-events-none"
    >
      <div className="flex items-center gap-2 rounded-2xl bg-[#153b68] px-4 py-2.5 text-xs font-bold text-white shadow-lg ring-1 ring-white/20">
        <RefreshCw className="size-4 animate-spin text-blue-200" />
        <span>تم نشر تحديث جديد، جاري تحديث التطبيق تلقائياً...</span>
      </div>
    </div>
  )
}
