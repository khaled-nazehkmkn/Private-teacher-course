/**
 * WhatsApp click-to-chat link generator with Egyptian phone normalization
 */

export function normalizeEgyptianPhone(phone: string): string {
  // Remove non-numeric characters
  const digits = phone.replace(/\D/g, '')

  // If starts with 01, prefix with Egypt country code 2
  if (digits.startsWith('01') && digits.length === 11) {
    return `2${digits}`
  }

  // If already starts with 201
  if (digits.startsWith('201') && digits.length === 12) {
    return digits
  }

  return digits
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = normalizeEgyptianPhone(phone)
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
}

export function formatAbsenceMessage({
  studentName,
  groupName,
  teacherName,
  subject,
  dates,
  daysArabic,
  totalAbsences,
}: {
  studentName: string
  groupName: string
  teacherName: string
  subject: string
  dates: string[]
  daysArabic: string[]
  totalAbsences: number
}): string {
  const datesList = dates
    .map((date, idx) => `• ${daysArabic[idx] || ''} (${date})`)
    .join('\n')

  return `السلام عليكم ورحمة الله وبركاته،
ولي أمر الطالب المحترم: ${studentName}
تحية طيبة وبعد،،

نحيطكم علماً بأن الطالب قد تغيب عن حصة ${subject} (${groupName}) في التواريخ التالية:
${datesList}

إجمالي أيام الغياب غير المعوّضة: ${totalAbsences}
يرجى المتابعة والحرص على الحضور حرصاً على مستواه الدراسي ومستقبله التعليمي.

مع تحيات الأستاذ: ${teacherName}`
}

export function formatExamResultMessage({
  studentName,
  examTitle,
  teacherName,
  score,
  maxScore,
  percentage,
}: {
  studentName: string
  examTitle: string
  teacherName: string
  score: number
  maxScore: number
  percentage: number
}): string {
  return `السلام عليكم ورحمة الله وبركاته،
ولي أمر الطالب المحترم: ${studentName}
تحية طيبة وبعد،،

نتيجة اختبار: "${examTitle}"
الدرجة: ${score} من ${maxScore} (بنسبة ${percentage}%)

${percentage >= 85 ? '🌟 أداء ممتاز ومشرّف، تمنياتنا له بدوام التفوق!' : percentage >= 70 ? '👍 أداء جيد مع إمكانية التحسن للأفضل بالتدريب المستمر.' : '⚠️ يحتاج الطالب لمزيد من التركيز والمراجعة الدورية.'}

مع تحيات الأستاذ: ${teacherName}`
}
