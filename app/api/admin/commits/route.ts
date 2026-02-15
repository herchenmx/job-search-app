export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'

const REPO = 'herchenmx/job-search-app'
const PER_PAGE = 30

interface GitHubCommit {
  sha: string
  html_url: string
  commit: {
    message: string
    author: {
      date: string
    }
  }
}

interface GitHubBranch {
  name: string
  commit: {
    sha: string
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const page = parseInt(request.nextUrl.searchParams.get('page') || '1')

  try {
    // Fetch commits and branches in parallel
    const [commitsRes, branchesRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${REPO}/commits?per_page=${PER_PAGE}&page=${page}`, {
        headers: { 'Accept': 'application/vnd.github.v3+json' },
        next: { revalidate: 60 },
      }),
      page === 1
        ? fetch(`https://api.github.com/repos/${REPO}/branches?per_page=100`, {
            headers: { 'Accept': 'application/vnd.github.v3+json' },
            next: { revalidate: 300 },
          })
        : Promise.resolve(null),
    ])

    if (!commitsRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch commits' }, { status: 502 })
    }

    const rawCommits: GitHubCommit[] = await commitsRes.json()

    // Build branch lookup from tip commits
    const branchMap = new Map<string, string>()
    if (branchesRes && branchesRes.ok) {
      const branches: GitHubBranch[] = await branchesRes.json()
      for (const b of branches) {
        branchMap.set(b.commit.sha, b.name)
      }
    }

    const commits = rawCommits.map(c => ({
      sha: c.sha,
      shortSha: c.sha.slice(0, 7),
      message: c.commit.message.split('\n')[0],
      date: c.commit.author.date,
      url: c.html_url,
      branch: branchMap.get(c.sha) || null,
    }))

    return NextResponse.json({
      commits,
      hasMore: rawCommits.length === PER_PAGE,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch commits' }, { status: 502 })
  }
}
