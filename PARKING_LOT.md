# Future Features & Improvements

## High Priority
- [x] CV upload confirmation flow: show parsed markdown, let user confirm/edit before saving
- [x] Interview recording auto-purge after successful transcription
- [x] Interview transcript review page before analysis runs
- [ ] In-app bug reporting widget (for issues like failed transcription)
- [ ] CV edit page after initial upload (in case PDF parsing needs manual fixes)
- [x] Delete job listings (individually from job detail page + bulk via multi-select from jobs list)
- [x] Delete companies (individually from company detail page + bulk via multi-select from companies list)
- [x] Add sorting (by name, cultural match rating) on companies list page
- [x] Add free-text search (company name) on companies list page
- [x] Add sorting (by status, added date, job title, company) on jobs list page
- [x] Add status filtering on jobs list page
- [x] Add free-text search (job title + company) on jobs list page
- [x] Manual trigger for company culture analysis from job detail page (when missing)

## Medium Priority
- [x] Rubric builder: conversational AI agent to help users create their rubrics
- [ ] Bulk job import from LinkedIn search URLs
- [ ] Email notifications for job status changes
- [ ] Calendar integration for interview scheduling
- [ ] Export job applications to CSV/Excel

## Low Priority / Ideas
- [ ] Dark mode
- [ ] Mobile app (React Native?)
- [ ] Collaborative features (share rubrics with other job seekers)
- [ ] Analytics dashboard (application rate over time, response rates, etc.)
- [ ] Integration with ATS systems (Greenhouse, Lever, etc.)

## Technical Debt / Refactoring
- [ ] Add proper error boundaries
- [ ] Improve loading states across all pages
- [ ] Add optimistic UI updates
- [ ] Add proper TypeScript strict mode
- [ ] Add unit tests for scoring logic
- [ ] Add E2E tests for critical flows