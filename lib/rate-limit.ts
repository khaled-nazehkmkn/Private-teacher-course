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
