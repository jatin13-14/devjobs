import { StrictMode } from 'react';
import { message } from 'antd';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProfilePage } from './ProfilePage.jsx';
import { http } from '../auth/api.js';
vi.mock('../auth/api.js', () => ({ assertRequestOwnership: () => {}, captureRequestOwnership: () => ({}), http: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
afterEach(async () => {
  await act(async () => { cleanup(); message.destroy(); });
  vi.resetAllMocks();
});
it.each([false, true])('saves candidate fields and adds and removes canonical skills (Strict Mode: %s)', async (strict) => {
  http.get.mockImplementation((url) => Promise.resolve({ data: url.includes('skills') ? { results: [], count: 0, next: null } : { full_name: 'Synthetic Candidate', years_of_experience: 2 } }));
  http.patch.mockResolvedValue({ data: { full_name: 'Edited Candidate' } });
  let finishAdd;
  http.post.mockImplementation(() => new Promise((resolve) => { finishAdd = resolve; })); http.delete.mockResolvedValue({});
  render(<ProfilePage candidate />, strict ? { wrapper: StrictMode } : {});
  fireEvent.change(await screen.findByLabelText('full name'), { target: { value: 'Edited Candidate' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
  await waitFor(() => expect(http.patch).toHaveBeenCalledWith('/candidates/me/profile/', expect.objectContaining({ full_name: 'Edited Candidate' }), expect.objectContaining({ _assertAuthority: expect.any(Function) })));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save profile' })).not.toHaveClass('ant-btn-loading'));
  await screen.findByText('No skills added.');
  const initialSkillReads = http.get.mock.calls.filter(([url]) => url.includes('skills')).length;
  fireEvent.change(screen.getByLabelText('Skill'), { target: { value: 'Python' } });
  http.get.mockImplementation((url) => Promise.resolve({ data: url.includes('skills') ? { results: [{ id: 'skill', name: 'python' }], count: 1, next: null } : { full_name: 'Edited Candidate' } }));
  fireEvent.click(screen.getByRole('button', { name: 'Add skill' }));
  // Observe validation/submission separately from the post-mutation GET and DOM.
  // A pending mutation must not expose a removal control before list refresh.
  await waitFor(() => expect(http.post).toHaveBeenCalledWith('/candidates/me/skills/', { name: 'Python' }, expect.objectContaining({ _assertAuthority: expect.any(Function) })));
  expect(screen.queryByRole('button', { name: 'Remove python' })).not.toBeInTheDocument();
  await act(async () => finishAdd({ data: { id: 'skill', name: 'python' } }));
  await waitFor(() => expect(http.get.mock.calls.filter(([url]) => url.includes('skills'))).toHaveLength(initialSkillReads + 1));
  fireEvent.click(await screen.findByRole('button', { name: 'Remove python' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Remove', exact: true }));
  await waitFor(() => expect(http.delete).toHaveBeenCalledWith('/candidates/me/skills/skill/', expect.objectContaining({ _assertAuthority: expect.any(Function) })));
});
it('displays recruiter server validation', async () => {
  http.get.mockResolvedValue({ data: { name: 'Synthetic Recruiter' } });
  http.patch.mockRejectedValue({ response: { data: { work_email: ['Enter a valid email.'] } } });
  render(<ProfilePage />);
  await screen.findByLabelText('name');
  fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
  expect(await screen.findByText('Enter a valid email.')).toBeInTheDocument();
});
