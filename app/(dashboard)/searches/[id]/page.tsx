import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import SearchForm from '../SearchForm'

// ===== ADDED FOR STATIC EXPORT =====
export async function generateStaticParams() {
  // For static export with authenticated routes, we use a placeholder
  // The actual data will be fetched when the user visits the page
  return [
    { id: 'placeholder' }
  ]
}
// ===== END OF ADDED CODE =====

export default async function EditSearchPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: search } = await supabase
    .from('job_searches')
    .select('*')
    .eq('id', id)
    .eq('user_id', user!.id)
    .single()

  if (!search) notFound()

  return <SearchForm search={search} />
}

// ===== ADDED AT THE BOTTOM FOR STATIC EXPORT =====
export const dynamic = 'force-static'
// ===== END OF ADDED CODE =====