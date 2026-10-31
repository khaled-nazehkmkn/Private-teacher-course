/**
 * Helper to generate session occurrences for a group across rolling weeks
 */

export const ARABIC_WEEKDAYS = [
  'الأحد',
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
]

export interface WeeklySession {
  weekday: number // 0 = Sunday, 6 = Saturday
  start_time: string
  end_time: string
}

export function generateOccurrencesForWeeks({
  weeklySessions,
  weeksAhead = 8,
  weeksBehind = 2,
  startDate = new Date(),
}: {
  weeklySessions: WeeklySession[]
  weeksAhead?: number
  weeksBehind?: number
  startDate?: Date
}): Array<{
  session_date: string
  weekday: number
  start_time: string
  end_time: string
}> {
  const occurrences: Array<{
    session_date: string
    weekday: number
    start_time: string
    end_time: string
  }> = []

  // Range from (startDate - weeksBehind * 7 days) to (startDate + weeksAhead * 7 days)
  const start = new Date(startDate)
  start.setDate(start.getDate() - weeksBehind * 7)

  const end = new Date(startDate)
  end.setDate(end.getDate() + weeksAhead * 7)

  const current = new Date(start)

  while (current <= end) {
    const dayOfWeek = current.getDay() // 0 = Sunday, 6 = Saturday
    const matchingSessions = weeklySessions.filter((s) => s.weekday === dayOfWeek)

    const dateStr = current.toISOString().split('T')[0]

    for (const session of matchingSessions) {
      occurrences.push({
        session_date: dateStr,
        weekday: dayOfWeek,
        start_time: session.start_time,
        end_time: session.end_time,
      })
    }

    current.setDate(current.getDate() + 1)
  }

  // Sort ascending by date then time
  occurrences.sort((a, b) => {
    if (a.session_date !== b.session_date) {
      return a.session_date.localeCompare(b.session_date)
    }
    return a.start_time.localeCompare(b.start_time)
  })

  return occurrences
}

export function formatArabicDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}
