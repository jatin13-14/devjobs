import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProfilePage } from './ProfilePage.jsx';
import { http } from '../auth/api.js';
vi.mock('../auth/api.js', () => ({ http: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('saves candidate fields and adds and removes canonical skills', async () => {
  http.get.mockImplementation((url) => Promise.resolve({ data: url.includes('skills') ? [] : { full_name: 'Synthetic Candidate', years_of_experience: 2 } }));
  http.patch.mockResolvedValue({ data: { full_name: 'Edited Candidate' } });
  http.post.mockResolvedValue({ data: { id: 'skill', name: 'python' } }); http.delete.mockResolvedValue({});
  render(<ProfilePage candidate />);
  fireEvent.change(await screen.findByLabelText('full name'), { target: { value: 'Edited Candidate' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
  await waitFor(() => expect(http.patch).toHaveBeenCalledWith('/candidates/me/profile/', expect.objectContaining({ full_name: 'Edited Candidate' })));
  fireEvent.change(screen.getByLabelText('Skill'), { target: { value: 'Python' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add skill' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Remove python' }));
  await waitFor(() => expect(http.delete).toHaveBeenCalledWith('/candidates/me/skills/skill/'));
});
it('displays recruiter server validation', async () => {
  http.get.mockResolvedValue({ data: { name: 'Synthetic Recruiter' } });
  http.patch.mockRejectedValue({ response: { data: { work_email: ['Enter a valid email.'] } } });
  render(<ProfilePage />);
  await screen.findByLabelText('name');
  fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
  expect(await screen.findByText('Enter a valid email.')).toBeInTheDocument();
});
