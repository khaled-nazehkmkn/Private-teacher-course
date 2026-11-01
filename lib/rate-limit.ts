// In-memory rate limiter for exam access code attempts
// Limits brute-force: max 5 failed attempts per IP per 10 minutes

interface AttemptRecord {
  count: number
  firstAttempt: number
}

const attemptsMap = new Map<string, AttemptRecord>()
const WINDOW_MS = 10 * 60 * 1000 // 10 minutes
const MAX_ATTEMPTS = 5

export function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const record = attemptsMap.get(ip)

  if (!record) {
    return { allowed: true, remaining: MAX_ATTEMPTS }
  }

  if (now - record.firstAttempt > WINDOW_MS) {
    attemptsMap.delete(ip)
    return { allowed: true, remaining: MAX_ATTEMPTS }
  }

  if (record.count >= MAX_ATTEMPTS) {
    return { allowed: false, remaining: 0 }
  }

  return { allowed: true, remaining: MAX_ATTEMPTS - record.count }
}

export function recordFailedAttempt(ip: string) {
  const now = Date.now()
  const record = attemptsMap.get(ip)

  if (!record || now - record.firstAttempt > WINDOW_MS) {
    attemptsMap.set(ip, { count: 1, firstAttempt: now })
  } else {
    record.count += 1
  }
}

export function resetAttempts(ip: string) {
  attemptsMap.delete(ip)
}

// Single active device session tracking per (exam_id, student_id)
interface ActiveExamSession {
  deviceId: string
  lastActive: number
}

const activeSessionsMap = new Map<string, ActiveExamSession>()

export function registerOrVerifyExamSession(
  examId: string,
  studentId: string,
  deviceId: string,
  durationMinutes: number
): { allowed: boolean; reason?: string } {
  const sessionKey = `${examId}:${studentId}`
  const now = Date.now()
  const maxSessionDurationMs = Math.max(durationMinutes, 15) * 60 * 1000 + 5 * 60 * 1000 // duration + 5 min grace
  const existing = activeSessionsMap.get(sessionKey)

  if (existing) {
    // If expired, clear it
    if (now - existing.lastActive > maxSessionDurationMs) {
      activeSessionsMap.delete(sessionKey)
    } else if (existing.deviceId !== deviceId) {
      // Different device trying to enter concurrently with the same student code
      return {
        allowed: false,
        reason:
          'هذا الكود قيد الاستخدام حالياً في جلسة اختبار نشطة على جهاز آخر. لا يُسمح بدخول أكثر من طالب أو جهاز في نفس الوقت بالكود نفسه.',
      }
    }
  }

  // Same device or new session: register / refresh
  activeSessionsMap.set(sessionKey, {
    deviceId,
    lastActive: now,
  })

  return { allowed: true }
}

export function releaseExamSession(examId: string, studentId: string) {
  const sessionKey = `${examId}:${studentId}`
  activeSessionsMap.delete(sessionKey)
}
