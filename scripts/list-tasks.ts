import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const { data, error } = await supabase
    .from('admin_tasks')
    .select('*')
    .order('id', { ascending: true })

  if (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }

  for (const task of data) {
    console.log(`#${task.id} [${task.status}] ${task.title}`)
    if (task.description) console.log(`   ${task.description}`)
    if (task.commit_shas?.length) console.log(`   commits: ${task.commit_shas.join(', ')}`)
    console.log()
  }
}

main()
