# Future Features & Improvements

## High Priority
- [ ] Microsoft OAuth setup (similar to Google OAuth)
- [x] CV upload confirmation flow: show parsed markdown, let user confirm/edit before saving
- [x] Interview recording auto-purge after successful transcription
- [x] Interview transcript review page before analysis runs
- [ ] In-app bug reporting widget (for issues like failed transcription)
- [ ] CV edit page after initial upload (in case PDF parsing needs manual fixes)

## Medium Priority
- [ ] Rubric builder: conversational AI agent to help users create their rubrics
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

## Current Sprint (What we're building now)
- [x] Project scaffold
- [x] Auth (Google OAuth)
- [x] Dashboard + navigation
- [x] Jobs list + detail pages
- [x] Add job manually
- [x] Profile & CV page with PDF upload
- [ ] CV upload confirmation flow ← NEXT
