-- Bug reports table for in-app issue reporting
create table if not exists bug_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  category text not null default 'bug' check (category in ('bug', 'feedback', 'other')),
  page_url text,
  user_agent text,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  created_at timestamptz not null default now()
);

-- RLS policies
alter table bug_reports enable row level security;

-- Users can insert their own reports
create policy "Users can insert own bug reports"
  on bug_reports for insert
  with check (auth.uid() = user_id);

-- Users can read their own reports
create policy "Users can read own bug reports"
  on bug_reports for select
  using (auth.uid() = user_id);
