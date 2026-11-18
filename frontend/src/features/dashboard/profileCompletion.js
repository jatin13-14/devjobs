const completionFields = ['full_name', 'professional_headline', 'country', 'city', 'about', 'years_of_experience'];
export function profileCompletion(profile, skills, resume) {
  const checks = completionFields.map((field) => ({ label: field.replaceAll('_', ' '), done: profile[field] !== null && profile[field] !== undefined && String(profile[field]).trim() !== '', to: '/candidate/profile' }));
  checks.push({ label: 'skills', done: skills.length > 0, to: '/candidate/skills' }, { label: 'professional link', done: ['github_url', 'linkedin_url', 'portfolio_url'].some((field) => Boolean(profile[field])), to: '/candidate/profile' }, { label: 'resume', done: Boolean(resume), to: '/candidate/resume' });
  return { percent: Math.round(checks.filter((item) => item.done).length / checks.length * 100), missing: checks.filter((item) => !item.done) };
}
