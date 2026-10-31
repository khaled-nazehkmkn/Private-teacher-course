import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

let adminClientInstance: ReturnType<typeof createSupabaseClient<Database>> | null = null

export function getAdminClient() {
  if (adminClientInstance) {
    return adminClientInstance
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[Supabase Admin] Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL')
  }

  adminClientInstance = createSupabaseClient<Database>(
    supabaseUrl || 'https://placeholder.supabase.co',
    serviceRoleKey || 'placeholder',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )

  return adminClientInstance
}
