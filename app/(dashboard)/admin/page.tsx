import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin'
import { AdminTask } from '@/types'
import AdminTaskList, { Commit } from './AdminTaskList'
import Link from 'next/link'

const REPO = 'herchenmx/job-search-app'
const COMMITS_PER_PAGE = 30

async function fetchCommits(): Promise<Commit[]> {
  try {
    const [commitsRes, branchesRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${REPO}/commits?per_page=${COMMITS_PER_PAGE}&page=1`, {
        headers: { 'Accept': 'application/vnd.github.v3+json' },
        next: { revalidate: 60 },
      }),
      fetch(`https://api.github.com/repos/${REPO}/branches?per_page=100`, {
        headers: { 'Accept': 'application/vnd.github.v3+json' },
        next: { revalidate: 300 },
      }),
    ])

    if (!commitsRes.ok) return []

    const rawCommits = await commitsRes.json()

    const branchMap = new Map<string, string>()
    if (branchesRes.ok) {
      const branches = await branchesRes.json()
      for (const b of branches) {
        branchMap.set(b.commit.sha, b.name)
      }
    }

    return rawCommits.map((c: { sha: string; html_url: string; commit: { message: string; author: { date: string } } }) => ({
      sha: c.sha,
      shortSha: c.sha.slice(0, 7),
      message: c.commit.message.split('\n')[0],
      date: c.commit.author.date,
      url: c.html_url,
      branch: branchMap.get(c.sha) || null,
    }))
  } catch {
    return []
  }
}

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isAdmin(user)) redirect('/dashboard')

  const [{ data: tasks }, commits] = await Promise.all([
    supabase
      .from('admin_tasks')
      .select('*')
      .order('position', { ascending: true }),
    fetchCommits(),
  ])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Admin</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Task tracker for features, bugs, and improvements.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/admin/bugs"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            Bug reports →
          </Link>
          <Link
            href="/admin/commits"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            View commits →
          </Link>
        </div>
      </div>

      <AdminTaskList initialTasks={(tasks || []) as AdminTask[]} commits={commits} />
    </div>
  )
}
