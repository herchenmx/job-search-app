-- Remove the policy that lets users read their own bug reports.
-- Only the admin (via service role key) should be able to read bug reports.
-- Users can still INSERT their own reports.
drop policy if exists "Users can read own bug reports" on bug_reports;
