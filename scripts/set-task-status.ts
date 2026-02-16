/**
 * Sets an admin task's status.
 *
 * Usage:
 *   npx tsx scripts/set-task-status.ts <task-title-search> <status>
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnv() {
  try {
    const envPath = resolve(__dirname, '..', '.env.local')
    const content = readFileSync(envPath, 'utf-8')
    const vars: Record<string, string> = {}
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      let value = trimmed.slice(eqIdx + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      vars[key] = value
    }
    return vars
  } catch {
    return {}
  }
}

const env = loadEnv()
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const args = process.argv.slice(2)
if (args.length < 2) {
  console.error('Usage: npx tsx scripts/set-task-status.ts <task-title-search> <status>')
  process.exit(1)
}

const titleSearch = args[0]
const newStatus = args[1]

async function main() {
  const supabase = createClient(supabaseUrl!, serviceRoleKey!)

  const { data: tasks, error: fetchError } = await supabase
    .from('admin_tasks')
    .select('*')
    .ilike('title', `%${titleSearch}%`)

  if (fetchError) {
    console.error('Error fetching tasks:', fetchError.message)
    process.exit(1)
  }

  if (!tasks || tasks.length === 0) {
    console.error(`No task found matching "${titleSearch}"`)
    process.exit(1)
  }

  if (tasks.length > 1) {
    console.error(`Multiple tasks match "${titleSearch}":`)
    tasks.forEach(t => console.error(`  - [${t.id}] ${t.title}`))
    console.error('Please use a more specific search term.')
    process.exit(1)
  }

  const task = tasks[0]

  const { error: updateError } = await supabase
    .from('admin_tasks')
    .update({ status: newStatus })
    .eq('id', task.id)

  if (updateError) {
    console.error('Error updating task:', updateError.message)
    process.exit(1)
  }

  console.log(`✓ Task "${task.title}" set to ${newStatus}`)
}

main()
