import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin'
import { AdminTask } from '@/types'
import AdminTaskList from './AdminTaskList'
import CommitHistory, { Commit } from './CommitHistory'

const REPO = 'herchenmx/job-search-app'
const COMMITS_PER_PAGE = 30

async function fetchCommits(): Promise<{ commits: Commit[]; hasMore: boolean }> {
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

    if (!commitsRes.ok) return { commits: [], hasMore: false }

    const rawCommits = await commitsRes.json()

    const branchMap = new Map<string, string>()
    if (branchesRes.ok) {
      const branches = await branchesRes.json()
      for (const b of branches) {
        branchMap.set(b.commit.sha, b.name)
      }
    }

    const commits: Commit[] = rawCommits.map((c: { sha: string; html_url: string; commit: { message: string; author: { date: string } } }) => ({
      sha: c.sha,
      shortSha: c.sha.slice(0, 7),
      message: c.commit.message.split('\n')[0],
      date: c.commit.author.date,
      url: c.html_url,
      branch: branchMap.get(c.sha) || null,
    }))

    return { commits, hasMore: rawCommits.length === COMMITS_PER_PAGE }
  } catch {
    return { commits: [], hasMore: false }
  }
}

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isAdmin(user)) redirect('/dashboard')

  const [{ data: tasks }, commitData] = await Promise.all([
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
      </div>

      <AdminTaskList initialTasks={(tasks || []) as AdminTask[]} commits={commitData.commits} />

      <div className="mt-8">
        <CommitHistory initialCommits={commitData.commits} hasMore={commitData.hasMore} tasks={(tasks || []) as AdminTask[]} />
      </div>
    </div>
  )
}
