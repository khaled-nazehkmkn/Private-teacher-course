import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getAdminClient()
    // Perform a trivial query to keep PostgreSQL and Supabase active
    const { count, error } = await supabase
      .from('teachers')
      .select('*', { count: 'exact', head: true })

    if (error) {
      console.error('[Keep-Alive Cron] Database query error:', error)
      return NextResponse.json({ status: 'error', message: error.message }, { status: 500 })
    }

    return NextResponse.json({
      status: 'ok',
      message: 'Keep-alive ping successful',
      timestamp: new Date().toISOString(),
      teacherCount: count ?? 0,
    })
  } catch (error) {
    console.error('[Keep-Alive Cron] Exception in /api/ping:', error)
    return NextResponse.json(
      { status: 'error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
