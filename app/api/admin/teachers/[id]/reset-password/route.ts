import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

function generateComplexPassword(length = 12): string {
  const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lowers = 'abcdefghijkmnpqrstuvwxyz'
  const numbers = '23456789'
  const symbols = '!@#$%&*+='
  const all = uppers + lowers + numbers + symbols

  const pwd: string[] = [
    uppers[Math.floor(Math.random() * uppers.length)],
    lowers[Math.floor(Math.random() * lowers.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ]

  for (let i = pwd.length; i < length; i++) {
    pwd.push(all[Math.floor(Math.random() * all.length)])
  }

  return pwd.sort(() => Math.random() - 0.5).join('')
}

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    // 1. Verify caller is an authenticated admin
    const supabaseUser = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'غير مصرح لك بتنفيذ هذا الإجراء' }, { status: 401 })
    }

    const adminClient = getAdminClient()

    const { data: callerTeacher, error: checkAdminError } = await adminClient
      .from('teachers')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (checkAdminError || !callerTeacher?.is_admin) {
      return NextResponse.json({ error: 'صلاحيات المشرف فقط مطلوبة' }, { status: 403 })
    }

    const teacherId = params.id

    // 2. Check if a specific password was sent or generate a random complex one
    let body: any = {}
    try {
      body = await request.json()
    } catch {
      // Body is optional
    }

    const newPassword = body.password && body.password.trim().length >= 8
      ? body.password.trim()
      : generateComplexPassword(12)

    // 3. Update Auth user password
    const { data: updatedAuth, error: updateError } =
      await adminClient.auth.admin.updateUserById(teacherId, {
        password: newPassword,
      })

    if (updateError || !updatedAuth.user) {
      console.error('[Admin] Error resetting password:', updateError)
      return NextResponse.json(
        { error: updateError?.message || 'فشل تحديث كلمة مرور المعلم' },
        { status: 500 }
      )
    }

    // 4. Also fetch teacher details for confirmation
    const { data: teacherRecord } = await adminClient
      .from('teachers')
      .select('full_name, phone')
      .eq('id', teacherId)
      .single()

    return NextResponse.json({
      success: true,
      password: newPassword,
      email: updatedAuth.user.email,
      full_name: teacherRecord?.full_name,
      phone: teacherRecord?.phone,
    })
  } catch (error) {
    console.error('[Admin] Unhandled exception in POST /api/admin/teachers/[id]/reset-password:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'حدث خطأ غير متوقع أثناء إعادة تعيين كلمة المرور' },
      { status: 500 }
    )
  }
}
