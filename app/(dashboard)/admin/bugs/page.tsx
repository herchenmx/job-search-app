import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin'
import { BugReport } from '@/types'
import Link from 'next/link'
import BugReportList from './BugReportList'

export default async function AdminBugsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isAdmin(user)) redirect('/dashboard')

  // Use service role to bypass RLS and read ALL bug reports
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: reports } = await serviceClient
    .from('bug_reports')
    .select('*')
    .order('created_at', { ascending: false })

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
            <span className="text-sm text-gray-600">Bug Reports</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Bug Reports</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {(reports || []).length} report{(reports || []).length !== 1 ? 's' : ''} from all users.
          </p>
        </div>
      </div>

      <BugReportList initialReports={(reports || []) as BugReport[]} />
    </div>
  )
}
