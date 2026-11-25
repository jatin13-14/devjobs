// Each explicit App route has a concrete URL, expected content and access policy.
// Company role is independent of the product recruiter role.
export function routeMatrix({ company, job, application }) {
  const q = `?company=${company}`;
  return [
    ['/', '/', 'Find your next role', 'public'],
    ['/jobs/:id', `/jobs/${job}`, 'Route audit engineer', 'public'],
    ['/login', '/login', 'Welcome back', 'public'],
    ['/admin/login', '/admin/login', 'Administrator sign in', 'public'],
    ['/register/candidate', '/register/candidate', 'Find your next opportunity.', 'public'],
    ['/register/recruiter', '/register/recruiter', 'Build your hiring team.', 'public'],
    ['/candidate', '/candidate', 'Find Your Next Opportunity', 'candidate'],
    ['/candidate/profile', '/candidate/profile', 'Candidate profile', 'candidate'],
    ['/candidate/skills', '/candidate/skills', 'My skills', 'candidate'],
    ['/candidate/resume', '/candidate/resume', 'My resume', 'candidate'],
    ['/candidate/saved-jobs', '/candidate/saved-jobs', 'Saved jobs', 'candidate'],
    ['/jobs/:id/apply', `/jobs/${job}/apply`, 'Route audit engineer', 'candidate'],
    ['/candidate/applications', '/candidate/applications', 'My applications', 'candidate'],
    ['/candidate/applications/:applicationId', `/candidate/applications/${application}`, 'Route audit engineer', 'candidate'],
    ['/recruiter', `/recruiter${q}`, 'Recruiter Workspace', 'recruiter'],
    ['/recruiter/profile', '/recruiter/profile', 'Recruiter profile', 'recruiter'],
    ['/recruiter/companies', '/recruiter/companies', 'My companies', 'recruiter'],
    ['/recruiter/applicants', '/recruiter/applicants', 'Review applicants', 'recruiter'],
    ['/recruiter/companies/new', '/recruiter/companies/new', 'Create company', 'recruiter'],
    ['/recruiter/companies/:id', `/recruiter/companies/${company}`, 'Company details', 'recruiter'],
    ['/recruiter/jobs', `/recruiter/jobs${q}`, 'Company jobs', 'recruiter'],
    ['/recruiter/jobs/new', `/recruiter/jobs/new${q}`, 'Create a job', 'management'],
    ['/recruiter/jobs/:id', `/recruiter/jobs/${job}${q}`, 'Route audit engineer', 'recruiter'],
    ['/recruiter/jobs/:id/edit', `/recruiter/jobs/${job}/edit${q}`, 'Edit job', 'management'],
    ['/recruiter/jobs/:id/applicants', `/recruiter/jobs/${job}/applicants${q}`, 'Applicants', 'management'],
    ['/recruiter/jobs/:id/applicants/:applicationId', `/recruiter/jobs/${job}/applicants/${application}${q}`, 'Route candidate', 'management'],
    ['/admin', '/admin', 'Admin Dashboard', 'platform'],
    ...['companies', 'recruiters', 'candidates', 'jobs', 'history'].map((kind) => ['/admin', `/admin?section=${kind}`, kind === 'history' ? 'Audit history' : `${kind[0].toUpperCase()}${kind.slice(1)} moderation`, 'platform']),
  ].map(([pattern, url, heading, policy]) => ({ pattern, url, heading, policy }));
}
