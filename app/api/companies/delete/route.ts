export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { companyIds } = await request.json()
  if (!companyIds || !Array.isArray(companyIds) || companyIds.length === 0) {
    return NextResponse.json({ error: 'companyIds array is required' }, { status: 400 })
  }

  // Nullify company_id on related jobs (keep the jobs, just unlink them)
  await supabase
    .from('jobs')
    .update({ company_id: null })
    .in('company_id', companyIds)
    .eq('user_id', user.id)

  // Delete the companies (scoped to user)
  const { error, count } = await supabase
    .from('companies')
    .delete({ count: 'exact' })
    .in('id', companyIds)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: 'Deleted', count })
}
