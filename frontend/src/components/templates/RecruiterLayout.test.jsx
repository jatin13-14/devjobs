import { StrictMode, useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RecruiterLayout } from './RecruiterLayout.jsx';
const auth = vi.hoisted(() => ({ user: { id: 'r1', email: 'r@example.test' }, logout: vi.fn() }));
vi.mock('../../features/auth/useAuth.js', () => ({ useAuth: () => auth }));
vi.mock('../../features/jobs/services/api.js', () => ({ jobsApi: { recruiterCompanies: () => Promise.resolve({ count: 0, results: [] }), recruiterProfile: () => Promise.resolve({ name: 'Riley Recruiter' }) } }));
afterEach(() => { cleanup(); localStorage.clear(); auth.user = { id: 'r1', email: 'r@example.test' }; });
it('persists recruiter theme without changing candidate preference and provides mobile destinations', async () => {
  localStorage.setItem('devjobs.candidate.theme', 'light');
  const { container } = render(<MemoryRouter><RecruiterLayout /></MemoryRouter>);
  expect(await screen.findByText('Riley Recruiter')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
  expect(container.querySelector('.recruiter-dark')).toBeInTheDocument();
  expect(localStorage.getItem('devjobs.recruiter.theme')).toBe('dark');
  expect(localStorage.getItem('devjobs.candidate.theme')).toBe('light');
  fireEvent.click(screen.getByRole('button', { name: 'Open user menu' }));
  await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Log out' })).toBeVisible());
  expect(container.querySelector('.recruiter-bottom-nav').querySelectorAll('a')).toHaveLength(5);
});


it('resets outlet selection and obsolete picker requests only when identity changes', async () => {
  const { jobsApi } = await import('../../features/jobs/services/api.js');
  const { CompanyPicker } = await import('../../features/companies/CompanyPicker.jsx');
  const pending = [];
  const spy = vi.spyOn(jobsApi, 'recruiterCompanies').mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
  function Screen() {
    const [selected, setSelected] = useState(null);
    return <><button onClick={() => setSelected({ id: 'private', name: 'Private selection', role: 'OWNER' })}>Select private</button><CompanyPicker selected={selected} value={selected?.id} onChange={() => {}} /></>;
  }
  const view = () => <StrictMode><MemoryRouter><Routes><Route element={<RecruiterLayout />}><Route path="/" element={<Screen />} /></Route></Routes></MemoryRouter></StrictMode>;
  const { rerender } = render(view());
  await screen.findByText('Riley Recruiter');
  fireEvent.click(screen.getByRole('button', { name: 'Select private' }));
  expect(screen.getByText('Private selection · OWNER')).toBeInTheDocument();
  rerender(view());
  expect(screen.getByText('Private selection · OWNER')).toBeInTheDocument();
  await waitFor(() => expect(pending.length).toBeGreaterThan(2));
  const old = [...pending];
  auth.user = { id: 'r2' }; rerender(view());
  expect(screen.queryByText('Private selection · OWNER')).not.toBeInTheDocument();
  expect(screen.queryByText('Riley Recruiter')).not.toBeInTheDocument();
  await act(async () => old.forEach((resolve) => resolve({ count: 1, results: [{ id: 'old', name: 'Old company', role: 'OWNER' }] })));
  expect(screen.queryByText('Old company')).not.toBeInTheDocument();
  auth.user = { id: 'r1' }; rerender(view());
  expect(screen.queryByText('Private selection · OWNER')).not.toBeInTheDocument();
  auth.user = null; rerender(view());
  expect(screen.queryByRole('combobox', { name: 'Company' })).not.toBeInTheDocument();
  spy.mockRestore();
});


it.each(['load more', 'search', 'exact lookup'])('isolates pending %s at the workspace boundary', async (operation) => {
  const { jobsApi } = await import('../../features/jobs/services/api.js');
  const { CompanyPicker } = await import('../../features/companies/CompanyPicker.jsx');
  const requests = [];
  const spy = vi.spyOn(jobsApi, 'recruiterCompanies').mockImplementation((args) => new Promise((resolve) => requests.push({ args, resolve })));
  const view = () => <MemoryRouter initialEntries={[operation === 'exact lookup' ? '/?company=private' : '/']}><Routes><Route element={<RecruiterLayout />}><Route path="/" element={<CompanyPicker onChange={() => {}} />} /></Route></Routes></MemoryRouter>;
  const { rerender } = render(view());
  await waitFor(() => expect(requests.some((r) => r.args?.page === 1)).toBe(true));
  const picker = requests.find((r) => r.args?.page === 1);
  await act(async () => picker.resolve({ count: 30, results: [{ id: 'private', name: 'Private company', role: 'OWNER' }], next: 'next' }));
  if (operation === 'load more') {
    fireEvent.click(screen.getByRole('button', { name: 'Load more companies' }));
    await waitFor(() => expect(requests.some((r) => r.args?.page === 2)).toBe(true));
  } else if (operation === 'search') {
    fireEvent.change(screen.getByRole('combobox', { name: 'Company' }), { target: { value: 'query' } });
    await waitFor(() => expect(requests.some((r) => r.args?.search === 'query')).toBe(true));
  } else expect(requests.some((r) => r.args?.companyId === 'private')).toBe(true);
  const old = [...requests];
  auth.user = { id: 'r2' }; rerender(view());
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Company' }));
  expect(screen.queryByText('Private company · OWNER')).not.toBeInTheDocument();
  await act(async () => old.forEach((r) => r.resolve({ count: 1, results: [{ id: 'obsolete', name: 'Obsolete company', role: 'OWNER' }] })));
  expect(screen.queryByText('Obsolete company · OWNER')).not.toBeInTheDocument();
  expect(screen.queryByText('Obsolete company')).not.toBeInTheDocument();
  spy.mockRestore();
});
