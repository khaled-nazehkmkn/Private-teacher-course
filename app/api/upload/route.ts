import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabaseUser = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'غير مصرح لك برفع الملفات' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const folder = (formData.get('folder') as string) || 'questions'

    if (!file) {
      return NextResponse.json({ error: 'لم يتم إرسال ملف' }, { status: 400 })
    }

    const adminClient = getAdminClient()
    const bucketName = 'question-images'

    // 1. Ensure bucket exists
    try {
      const { data: bucket } = await adminClient.storage.getBucket(bucketName)
      if (!bucket) {
        await adminClient.storage.createBucket(bucketName, { public: true })
      }
    } catch {
      // Bucket check might throw if already existing
    }

    // 2. Prepare file buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const fileExt = file.name.split('.').pop() || 'jpg'
    const cleanFileName = `${folder}/${user.id}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`

    // 3. Upload using admin client
    const { data: uploadData, error: uploadError } = await adminClient.storage
      .from(bucketName)
      .upload(cleanFileName, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: true,
      })

    if (uploadError) {
      console.warn('[Upload API] Storage upload failed, using Data URL fallback:', uploadError)
      // Fallback to data URL so the user never gets an error
      const base64 = buffer.toString('base64')
      const dataUrl = `data:${file.type || 'image/jpeg'};base64,${base64}`
      return NextResponse.json({ success: true, url: dataUrl })
    }

    const {
      data: { publicUrl },
    } = adminClient.storage.from(bucketName).getPublicUrl(uploadData.path)

    return NextResponse.json({
      success: true,
      url: publicUrl,
    })
  } catch (error) {
    console.error('[Upload API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'فشل رفع الملف' },
      { status: 500 }
    )
  }
}
