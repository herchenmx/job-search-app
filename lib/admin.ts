import { User } from '@supabase/supabase-js'

export function isAdmin(user: User): boolean {
  return user.id === process.env.ADMIN_USER_ID
}
