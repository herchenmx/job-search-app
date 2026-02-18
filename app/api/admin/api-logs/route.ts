export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

export async function GET(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const days = Math.min(
    parseInt(request.nextUrl.searchParams.get('days') || '7'),
    90
  )

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceIso = since.toISOString()

  // Fetch recent logs (most recent 200)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: logs, error: logsError } = await (serviceClient.from('api_call_logs') as any)
    .select('*')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(200)

  if (logsError) {
    return NextResponse.json({ error: logsError.message }, { status: 500 })
  }

  // Compute aggregated stats from the fetched logs
  const serviceStats: Record<string, {
    total: number
    errors: number
    totalDuration: number
    durationCount: number
  }> = {}

  for (const log of logs || []) {
    if (!serviceStats[log.service]) {
      serviceStats[log.service] = { total: 0, errors: 0, totalDuration: 0, durationCount: 0 }
    }
    const s = serviceStats[log.service]!
    s.total++
    if (log.error || (log.status_code && log.status_code >= 400)) {
      s.errors++
    }
    if (log.duration_ms != null) {
      s.totalDuration += log.duration_ms
      s.durationCount++
    }
  }

  const stats = Object.entries(serviceStats).map(([service, s]) => ({
    service,
    total_calls: s.total,
    error_count: s.errors,
    error_rate: s.total > 0 ? Math.round((s.errors / s.total) * 100) : 0,
    avg_duration_ms: s.durationCount > 0 ? Math.round(s.totalDuration / s.durationCount) : null,
  }))

  return NextResponse.json({ stats, logs: logs || [], days })
}
