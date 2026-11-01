import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabaseUser = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 })
    }

    const adminClient = getAdminClient()

    // 1. Fetch counts
    const { data: students, error: stErr } = await adminClient
      .from('students')
      .select('id, group_id')
      .eq('teacher_id', user.id)

    if (stErr) throw stErr

    const { count: groupsCount, error: grpErr } = await adminClient
      .from('groups')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', user.id)

    if (grpErr) throw grpErr

    const totalStudents = students?.length || 0
    const unassignedStudents = (students || []).filter((s) => !s.group_id).length
    const assignedStudents = totalStudents - unassignedStudents

    return NextResponse.json({
      success: true,
      totalStudents,
      assignedStudents,
      unassignedStudents,
      groupsCount: groupsCount || 0,
    })
  } catch (error) {
    console.error('[AcademicYear GET] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'فشل جلب بيانات العام الدراسي' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabaseUser = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 })
    }

    const adminClient = getAdminClient()

    // Check teacher suspension status
    const { data: teacher, error: teachErr } = await adminClient
      .from('teachers')
      .select('is_suspended, active_to, active_from')
      .eq('id', user.id)
      .single()

    if (teachErr || !teacher || teacher.is_suspended) {
      return NextResponse.json({ error: 'الحساب موقوف أو غير نشط' }, { status: 403 })
    }

    const body = await request.json()
    const { action } = body

    if (action === 'prepare_new_year') {
      // Step 1: Prepare for New Year
      // 1. Delete makeup_requests (avoids foreign key constraint on session_occurrences)
      await adminClient.from('makeup_requests').delete().eq('teacher_id', user.id)

      // 2. Delete attendance records for this teacher
      await adminClient.from('attendance_records').delete().eq('teacher_id', user.id)

      // 3. Delete session occurrences for this teacher
      await adminClient.from('session_occurrences').delete().eq('teacher_id', user.id)

      // 4. Update all students to group_id = null (unassigned)
      await adminClient
        .from('students')
        .update({ group_id: null })
        .eq('teacher_id', user.id)

      // 5. Delete group sessions
      const { data: teacherGroups } = await adminClient
        .from('groups')
        .select('id')
        .eq('teacher_id', user.id)

      const groupIds = (teacherGroups || []).map((g) => g.id)
      if (groupIds.length > 0) {
        await adminClient.from('group_sessions').delete().in('group_id', groupIds)
      }

      // 6. Delete all groups of this teacher
      await adminClient.from('groups').delete().eq('teacher_id', user.id)

      // 7. Get count of preserved unassigned students
      const { count: studentCount } = await adminClient
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('teacher_id', user.id)

      return NextResponse.json({
        success: true,
        message: 'تمت إزالة المجموعات بنجاح وإبقاء جميع الطلاب كغير مسجلين بمجموعات استعداداً للعام الجديد.',
        unassignedStudentsCount: studentCount || 0,
      })
    } else if (action === 'finalize_new_year' || action === 'start_new_year') {
      // Step 2: Finalize New Year & Purge Unassigned Students
      // 1. Fetch unassigned students IDs
      const { data: unassignedStudents, error: fetchErr } = await adminClient
        .from('students')
        .select('id')
        .eq('teacher_id', user.id)
        .is('group_id', null)

      if (fetchErr) throw fetchErr

      const unassignedIds = (unassignedStudents || []).map((s) => s.id)
      let deletedCount = 0

      if (unassignedIds.length > 0) {
        // Delete unassigned students
        const { error: delErr } = await adminClient
          .from('students')
          .delete()
          .eq('teacher_id', user.id)
          .is('group_id', null)

        if (delErr) throw delErr
        deletedCount = unassignedIds.length
      }

      // Count remaining students assigned to groups
      const { count: remainingCount } = await adminClient
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('teacher_id', user.id)

      return NextResponse.json({
        success: true,
        message: 'تم بدء العام الدراسي الجديد بنجاح وحذف الطلاب غير المسجلين في أي مجموعة.',
        deletedCount,
        remainingCount: remainingCount || 0,
      })
    } else {
      return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 })
    }
  } catch (error) {
    console.error('[AcademicYear POST] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'فشل تنفيذ إجراء العام الدراسي' },
      { status: 500 }
    )
  }
}
