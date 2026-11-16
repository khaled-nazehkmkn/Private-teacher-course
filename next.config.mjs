import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from 'next/constants.js'

function resolveBuildId(phase) {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    return 'development'
  }

  const platformBuildId =
    process.env.VERCEL_DEPLOYMENT_ID ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA

  if (platformBuildId) {
    return platformBuildId
  }

  if (phase === PHASE_PRODUCTION_BUILD) {
    return `build-${Date.now()}`
  }

  try {
    return readFileSync(join(process.cwd(), '.next', 'BUILD_ID'), 'utf8').trim()
  } catch {
    return 'production'
  }
}

/** @type {(phase: string) => import('next').NextConfig} */
export default function nextConfig(phase) {
  const buildId = resolveBuildId(phase)

  return {
    env: {
      NEXT_PUBLIC_APP_BUILD_ID: buildId,
    },
    generateBuildId: async () => buildId,
    typescript: {
      ignoreBuildErrors: true,
    },
    images: {
      unoptimized: true,
    },
  }
}
