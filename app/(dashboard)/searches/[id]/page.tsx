import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import SearchForm from '../SearchForm'

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