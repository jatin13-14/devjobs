import { StrictMode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CandidateSkills } from './CandidateSkills.jsx';
import { http } from '../auth/api.js';
vi.mock('../auth/api.js', () => ({ captureRequestOwnership: () => ({ owner: 'original-session' }), http: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
const empty = { results: [], count: 0, next: null };
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it('uses bounded pages and displays field validation without duplicate submits', async () => {
  http.get.mockResolvedValue({ data: empty });
  let reject;
  http.post.mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
  render(<CandidateSkills />);
  await screen.findByText('No skills added.');
  expect(http.get).toHaveBeenCalledWith('/candidates/me/skills/', expect.objectContaining({ params: { pagination: 'page', page: 1, page_size: 20 }, owner: 'original-session' }));
  fireEvent.change(screen.getByLabelText('Skill'), { target: { value: 'İ'.repeat(80) } });
  fireEvent.click(screen.getByRole('button', { name: 'Add skill' }));
  await waitFor(() => expect(http.post).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: 'Add skill' }));
  await act(async () => reject({ response: { data: { name: ['Normalized name too long.'] } } }));
  expect(await screen.findByText('Normalized name too long.')).toBeInTheDocument();
  expect(http.post).toHaveBeenCalledTimes(1);
});
it('invalidates retained dispatch authority on page switching and unmount', async () => {
  http.get.mockResolvedValue({ data: { ...empty, next: 'next', count: 21 } });
  const view = render(<CandidateSkills />);
  await screen.findByText('21 skills · Page 1');
  const first = http.get.mock.calls[0][1];
  first._assertAuthority();
  fireEvent.click(screen.getByRole('button', { name: 'Next skills page' }));
  expect(() => first._assertAuthority()).toThrow();
  await screen.findByText('21 skills · Page 2');
  const second = http.get.mock.calls[1][1];
  view.unmount();
  expect(() => second._assertAuthority()).toThrow();
  expect(first.signal.aborted).toBe(true);
  expect(second.signal.aborted).toBe(true);
});
it('falls back after the last page disappears and ignores late results on unmount', async () => {
  let late;
  http.get.mockResolvedValueOnce({ data: { ...empty, count: 21, next: 'next' } })
    .mockRejectedValueOnce({ response: { status: 404 } })
    .mockImplementationOnce(() => new Promise((resolve) => { late = resolve; }));
  const view = render(<CandidateSkills />);
  await screen.findByText('21 skills · Page 1');
  fireEvent.click(screen.getByRole('button', { name: 'Next skills page' }));
  await waitFor(() => expect(http.get).toHaveBeenCalledTimes(3));
  view.unmount();
  await act(async () => late({ data: { ...empty, results: [{ id: 'late', name: 'private stale skill' }] } }));
  expect(screen.queryByText('private stale skill')).not.toBeInTheDocument();
});

it('ignores a superseded Strict Mode GET after the current response', async () => {
  const responses = [];
  http.get.mockImplementation(() => new Promise((resolve) => responses.push(resolve)));
  render(<StrictMode><CandidateSkills /></StrictMode>);
  await waitFor(() => expect(responses).toHaveLength(2));
  await act(async () => responses[1]({ data: empty }));
  await screen.findByText('No skills added.');
  await act(async () => responses[0]({ data: { ...empty, results: [{ id: 'old', name: 'obsolete private skill' }] } }));
  expect(screen.queryByText('obsolete private skill')).not.toBeInTheDocument();
});
