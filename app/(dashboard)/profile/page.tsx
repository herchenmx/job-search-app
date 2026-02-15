import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('culture_preferences_rubric, role_preferences_rubric, experience_rubric')
    .eq('user_id', user!.id)
    .single()

  const rubrics = [
    {
      label: 'Culture Preferences Rubric',
      href: '/profile/culture-rubric',
      saved: !!profile?.culture_preferences_rubric,
      description: 'Defines what you value in a workplace culture. Used to analyse company culture fit.',
    },
    {
      label: 'Role Preferences Rubric',
      href: '/profile/role-rubric',
      saved: !!profile?.role_preferences_rubric,
      description: 'Defines your ideal role characteristics. Used to match job listings to your preferences.',
    },
    {
      label: 'Experience Rubric',
      href: '/profile/experience-rubric',
      saved: !!profile?.experience_rubric,
      description: 'Defines your experience and skills. Used to assess how well you match job requirements.',
    },
  ]

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Profile</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Your rubrics are used by the AI analysis workflows.
        </p>
      </div>

      <div className="space-y-3">
        {rubrics.map((rubric) => (
          <Link
            key={rubric.href}
            href={rubric.href}
            className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-gray-900">{rubric.label}</h3>
                  {rubric.saved ? (
                    <span className="text-xs text-green-600 font-medium">Saved</span>
                  ) : (
                    <span className="text-xs text-gray-400">Not set</span>
                  )}
                </div>
                <p className="text-xs text-gray-500">{rubric.description}</p>
              </div>
              <span className="text-gray-400 text-sm">→</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
