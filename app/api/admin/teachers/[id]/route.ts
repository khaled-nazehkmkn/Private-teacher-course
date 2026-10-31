import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
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
    const body = await request.json()
    const { is_suspended, active_from, active_to, full_name, phone, subject, is_admin } = body

    const updateData: Record<string, unknown> = {}
    if (typeof is_suspended === 'boolean') updateData.is_suspended = is_suspended
    if (active_from !== undefined) updateData.active_from = active_from || null
    if (active_to !== undefined) updateData.active_to = active_to || null
    if (full_name !== undefined) updateData.full_name = full_name
    if (phone !== undefined) updateData.phone = phone || null
    if (subject !== undefined) updateData.subject = subject || null
    if (typeof is_admin === 'boolean') updateData.is_admin = is_admin

    const { data: updatedTeacher, error: updateError } = await adminClient
      .from('teachers')
      .update(updateData)
      .eq('id', teacherId)
      .select()
      .single()

    if (updateError) {
      console.error('[Admin] Error updating teacher:', updateError)
      return NextResponse.json(
        { error: 'فشل تحديث بيانات المعلم' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      teacher: updatedTeacher,
    })
  } catch (error) {
    console.error('[Admin] Unhandled exception in PATCH /api/admin/teachers/[id]:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'حدث خطأ غير متوقع' },
      { status: 500 }
    )
  }
}
