import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
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

    // 2. Parse request body
    const body = await request.json()
    const { email, password, full_name, phone, subject, active_from, active_to, is_admin } = body

    if (!email || !password || !full_name) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني، كلمة المرور، والاسم الكامل حقول مطلوبة' },
        { status: 400 }
      )
    }

    // 3. Create Auth user via service role
    const { data: newAuthUser, error: createAuthError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      })

    if (createAuthError || !newAuthUser.user) {
      console.error('[Admin] Error creating auth user:', createAuthError)
      return NextResponse.json(
        { error: createAuthError?.message || 'فشل إنشاء حساب المستخدم' },
        { status: 400 }
      )
    }

    const teacherId = newAuthUser.user.id

    // 4. Insert corresponding teacher record
    const { data: teacherRecord, error: insertTeacherError } = await adminClient
      .from('teachers')
      .insert({
        id: teacherId,
        full_name,
        phone: phone || null,
        subject: subject || null,
        is_admin: Boolean(is_admin),
        active_from: active_from || null,
        active_to: active_to || null,
        is_suspended: false,
      })
      .select()
      .single()

    if (insertTeacherError) {
      console.error('[Admin] Error creating teacher row:', insertTeacherError)
      // Cleanup auth user to avoid orphan
      await adminClient.auth.admin.deleteUser(teacherId)
      return NextResponse.json(
        { error: 'فشل حفظ بيانات المعلم في قاعدة البيانات' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      teacher: teacherRecord,
    })
  } catch (error) {
    console.error('[Admin] Unhandled exception in POST /api/admin/teachers:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'حدث خطأ غير متوقع' },
      { status: 500 }
    )
  }
}
