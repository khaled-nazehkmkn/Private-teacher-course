import { NextResponse } from 'next/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const dynamic = 'force-dynamic'

function getServerBuildId(): string {
  if (process.env.NODE_ENV === 'development') {
    return 'development'
  }

  if (process.env.NEXT_PUBLIC_APP_BUILD_ID) {
    return process.env.NEXT_PUBLIC_APP_BUILD_ID
  }

  if (process.env.VERCEL_DEPLOYMENT_ID) {
    return process.env.VERCEL_DEPLOYMENT_ID
  }

  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA
  }

  try {
    return readFileSync(join(process.cwd(), '.next', 'BUILD_ID'), 'utf8').trim()
  } catch {
    return 'unknown'
  }
}

export async function GET() {
  try {
    const version = getServerBuildId()
    return NextResponse.json(
      { version },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    )
  } catch (error) {
    console.error('[API Version] Failed to read app version:', error)
    return NextResponse.json(
      { error: 'تعذر التحقق من إصدار التطبيق' },
      { status: 500 }
    )
  }
}
