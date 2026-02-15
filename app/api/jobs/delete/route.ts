export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { jobIds } = await request.json()
  if (!jobIds || !Array.isArray(jobIds) || jobIds.length === 0) {
    return NextResponse.json({ error: 'jobIds array is required' }, { status: 400 })
  }

  // Delete related records first (interviews), then the jobs
  // Delete interview analyses
  await supabase
    .from('interview_analyses')
    .delete()
    .in('job_id', jobIds)

  // Delete interview transcripts
  await supabase
    .from('interview_transcripts')
    .delete()
    .in('job_id', jobIds)

  // Delete interview recordings
  await supabase
    .from('interview_recordings')
    .delete()
    .in('job_id', jobIds)

  // Delete the jobs (scoped to user)
  const { error, count } = await supabase
    .from('jobs')
    .delete({ count: 'exact' })
    .in('id', jobIds)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: 'Deleted', count })
}
