import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin'
import { AdminTask } from '@/types'
import AdminTaskList from './AdminTaskList'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isAdmin(user)) redirect('/dashboard')

  const { data: tasks } = await supabase
    .from('admin_tasks')
    .select('*')
    .order('position', { ascending: true })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Admin</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Task tracker for features, bugs, and improvements.
          </p>
        </div>
      </div>

      <AdminTaskList initialTasks={(tasks || []) as AdminTask[]} />
    </div>
  )
}
