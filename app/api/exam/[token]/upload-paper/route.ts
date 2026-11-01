import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function POST(
  request: Request,
  props: { params: Promise<{ token: string }> }
) {
  const params = await props.params
  try {
    const { token } = params
    const adminClient = getAdminClient()

    // 1. Validate exam token
    const { data: exam, error: examErr } = await adminClient
      .from('exams')
      .select('id, teacher_id')
      .eq('public_token', token)
      .single()

    if (examErr || !exam) {
      return NextResponse.json({ error: 'الاختبار غير صالح' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const studentId = formData.get('student_id') as string | null

    if (!file) {
      return NextResponse.json({ error: 'لم يتم إرسال ملف' }, { status: 400 })
    }

    const bucketName = 'question-images'
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const fileExt = file.name.split('.').pop() || 'jpg'
    const fileName = `papers/${exam.id}/${studentId || 'anon'}/${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`

    try {
      const { data: uploadData, error: uploadError } = await adminClient.storage
        .from(bucketName)
        .upload(fileName, buffer, {
          contentType: file.type || 'image/jpeg',
          upsert: true,
        })

      if (!uploadError && uploadData) {
        const {
          data: { publicUrl },
        } = adminClient.storage.from(bucketName).getPublicUrl(uploadData.path)
        return NextResponse.json({ success: true, url: publicUrl })
      }
    } catch {
      // Storage fallback
    }

    // Fallback Data URL
    const base64 = buffer.toString('base64')
    const dataUrl = `data:${file.type || 'image/jpeg'};base64,${base64}`
    return NextResponse.json({ success: true, url: dataUrl })
  } catch (error) {
    console.error('[Student Upload Paper] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'فشل رفع ورقة الإجابة' },
      { status: 500 }
    )
  }
}
