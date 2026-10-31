export interface TeacherStatus {
  isActive: boolean
  isSuspended: boolean
  isExpired: boolean
  isAdmin: boolean
  reason?: string
}

export function evaluateTeacherStatus(teacher: {
  is_admin?: boolean
  is_suspended?: boolean
  active_from?: string | null
  active_to?: string | null
}): TeacherStatus {
  const isAdmin = Boolean(teacher.is_admin)
  const isSuspended = Boolean(teacher.is_suspended)

  const todayStr = new Date().toISOString().split('T')[0]

  let isExpired = false
  if (teacher.active_to && teacher.active_to < todayStr) {
    isExpired = true
  }

  let notStarted = false
  if (teacher.active_from && teacher.active_from > todayStr) {
    notStarted = true
  }

  const isActive = !isSuspended && !isExpired && !notStarted

  let reason = ''
  if (isSuspended) {
    reason = 'تم تعليق الحساب بواسطة الإدارة.'
  } else if (isExpired) {
    reason = 'انتهت فترة اشتراك الحساب.'
  } else if (notStarted) {
    reason = 'فترة تفعيل الحساب لم تبدأ بعد.'
  }

  return {
    isActive,
    isSuspended,
    isExpired: isExpired || notStarted,
    isAdmin,
    reason: isActive ? undefined : reason,
  }
}
