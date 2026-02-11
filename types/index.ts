export type JobStatus =
  | 'Review' | 'Bookmarked' | 'Interested' | 'Reposted' | 'Unfit'
  | 'Applied' | 'Referred' | 'Followed-Up'
  | '1st Stage' | '2nd Stage' | '3rd Stage' | '4th Stage'
  | 'Offered' | 'Declined' | 'Rejected' | 'Signed' | 'Closed'

export const INCLUDED_STATUSES: JobStatus[] = ['Review', 'Bookmarked', 'Interested', 'Reposted']
export const EXCLUDED_STATUSES: JobStatus[] = [
  'Applied', 'Referred', 'Followed-Up',
  '1st Stage', '2nd Stage', '3rd Stage', '4th Stage',
  'Offered', 'Declined', 'Rejected', 'Signed', 'Closed'
]

export interface UserProfile {
  id: string
  user_id: string
  cv: string | null
  culture_preferences_rubric: string | null
  role_preferences_rubric: string | null
  experience_rubric: string | null
  wanted_keywords: string[]
  unwanted_keywords: string[]
  created_at: string
  updated_at: string
}

export interface Company {
  id: string
  user_id: string
  name: string
  linkedin_page: string             // NOT NULL
  cultural_match_rate: number | null
  cultural_match_insights: string | null
  created_at: string
  updated_at: string
}

export interface Job {
  id: string
  user_id: string
  company_id: string | null
  job_title: string                     // NOT NULL
  posting_url: string                   // NOT NULL
  company: string                       // NOT NULL
  linkedin_company_page: string | null
  status: JobStatus                     // NOT NULL
  status_reason: string | null
  prioritisation_score: number | null
  overall_match_rate: number | null
  experience_match_rate: number | null
  experience_match_insights: string | null
  job_match_rate: number | null
  job_match_insights: string | null
  job_description: string | null        // AI-generated summary
  job_description_full: string | null   // Full scraped job description
  tailored_covering_letter: string | null
  salary_expectation: number | null
  application_date: string | null
  last_live_check: string | null
  is_live: boolean
  created_at: string
  updated_at: string
  // Joined relation
  companies?: Company
}

export interface InterviewRecording {
  id: string
  job_id: string
  user_id: string
  interview_number: number
  file_path: string
  file_name: string
  uploaded_at: string
}

export interface InterviewTranscript {
  id: string
  job_id: string
  recording_id: string | null
  interview_number: number
  transcript_text: string
  created_at: string
}

export interface InterviewAnalysis {
  id: string
  job_id: string
  transcript_id: string | null
  interview_number: number
  analysis_text: string
  created_at: string
}

export interface JobSearch {
  id: string
  user_id: string
  label: string
  keyword: string
  location: string
  experience_level: string[]
  work_model: string[]
  job_type: string[]
  is_active: boolean
  last_run_at: string | null
  created_at: string
  updated_at: string
}