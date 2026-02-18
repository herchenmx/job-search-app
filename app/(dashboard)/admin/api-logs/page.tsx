import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin'
import { ApiCallLog } from '@/types'
import Link from 'next/link'
import ApiCallDashboard from './ApiCallDashboard'

export default async function AdminApiLogsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isAdmin(user)) redirect('/dashboard')

  // Use service role to bypass RLS
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const since = new Date()
  since.setDate(since.getDate() - 7)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: logs } = await (serviceClient.from('api_call_logs') as any)
    .select('*')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/admin"
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Admin
            </Link>
            <span className="text-sm text-gray-300">/</span>
            <span className="text-sm text-gray-600">API Logs</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">API Call Logs</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            External API call observability — latency, errors, and volume.
          </p>
        </div>
      </div>

      <ApiCallDashboard initialLogs={(logs || []) as ApiCallLog[]} />
    </div>
  )
}
