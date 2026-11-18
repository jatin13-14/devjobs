import { expect, it } from 'vitest';
import { profileCompletion } from './profileCompletion.js';
it('requires resume, skills and a link even when all core fields are complete', () => {
  const profile = { full_name: 'Developer', professional_headline: 'Engineer', country: 'IN', city: 'Delhi', about: 'Build software', years_of_experience: 0 };
  expect(profileCompletion(profile, [], null).percent).toBe(67);
  expect(profileCompletion(profile, [], null).missing.map((item) => item.label)).toEqual(['skills', 'professional link', 'resume']);
  expect(profileCompletion({ ...profile, github_url: 'https://github.com/example' }, [{ name: 'Python' }], { filename: 'resume.pdf' }).percent).toBe(100);
  expect(profileCompletion({}, [], null).percent).toBe(0);
});
