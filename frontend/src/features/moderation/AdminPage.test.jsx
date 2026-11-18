import { message } from 'antd';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminPage } from './AdminPage.jsx';
import { RouteGuard } from '../auth/RouteGuard.jsx';
import { http } from '../auth/api.js';
import { useAuth } from '../auth/useAuth.js';
vi.mock('../auth/api.js', () => ({ http: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../auth/useAuth.js', () => ({ useAuth: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); http.get.mockImplementation((url) => Promise.resolve({ data: url.includes('overview') ? { companies: 1 } : { count: 1, results: [{ id: 'one', name: 'Test Company', is_suspended: false }] } })); });
// Static messages own React roots outside the rendered test container. Drain
// their teardown before Vitest disposes this file's JSDOM window.
afterEach(async () => { await act(async () => { cleanup(); message.destroy(); }); });
it('denies ordinary users access to the admin route', () => {
  useAuth.mockReturnValue({ user: { role: 'recruiter' } });
  render(<MemoryRouter initialEntries={['/admin']}><Routes><Route element={<RouteGuard platformAdmin />}><Route path="/admin" element={<AdminPage />} /></Route><Route path="/" element={<p>Public jobs</p>} /></Routes></MemoryRouter>);
  expect(screen.getByText('Public jobs')).toBeInTheDocument(); expect(http.get).not.toHaveBeenCalled();
});
it('requires a reason and submits a confirmed decision', async () => {
  http.post.mockResolvedValue({ data: {} }); render(<MemoryRouter initialEntries={['/admin?section=companies']}><AdminPage /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Moderate' }));
  expect(screen.getByRole('button', { name: 'OK' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Moderation reason'), { target: { value: 'Policy violation' } });
  fireEvent.click(screen.getByRole('button', { name: 'OK' }));
  await waitFor(() => expect(http.post).toHaveBeenCalledWith('/admin/companies/one/', { action: 'suspend', reason: 'Policy violation' }));
  // Ant Design modal rendering exceeds five seconds on shared hosted runners.
}, 15000);
it('displays authorization and API failures', async () => {
  http.get.mockRejectedValue({ response: { data: { detail: 'Permission denied.' } } }); render(<MemoryRouter initialEntries={['/admin?section=companies']}><AdminPage /></MemoryRouter>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Permission denied.');
});
it('shows supported dashboard totals without invented historical values', async () => {
  http.get.mockImplementation((url) => Promise.resolve({ data: url.includes('overview') ? { companies: 337, recruiters: 20, candidates: 80, jobs: 1902 } : { count: 0, results: [] } }));
  render(<MemoryRouter initialEntries={['/admin']}><AdminPage /></MemoryRouter>);
  expect(await screen.findByText('337')).toBeInTheDocument();
  expect(screen.getByText('1,902')).toBeInTheDocument();
  expect(screen.getByText('Historical activity unavailable')).toBeInTheDocument();
  expect(await screen.findByText('No moderation decisions recorded')).toBeInTheDocument();
  expect(screen.queryByText('Total Users')).not.toBeInTheDocument();
  expect(screen.queryByText('+12%')).not.toBeInTheDocument();
});
it('uses the supported company search query from the header destination', async () => {
  render(<MemoryRouter initialEntries={['/admin?section=companies&q=Studio']}><AdminPage /></MemoryRouter>);
  await waitFor(() => expect(http.get).toHaveBeenCalledWith('/admin/companies/', { params: { page: 1, search: 'Studio', state: undefined } }));
  expect(screen.getByLabelText('Search moderation records')).toHaveValue('Studio');
  expect(screen.getByPlaceholderText('Search company name')).toBeInTheDocument();
});

it('preserves an overview failure after visiting a working resource section', async () => {
  http.get.mockImplementation((url) => url.includes('overview') ? Promise.reject({ response: { data: { detail: 'Overview unavailable.' } } }) : Promise.resolve({ data: { count: 0, results: [] } }));
  render(<MemoryRouter initialEntries={['/admin?section=companies']}><AdminPage /><DashboardLink /></MemoryRouter>);
  await waitFor(() => expect(http.get).toHaveBeenCalledWith('/admin/companies/', expect.anything()));
  fireEvent.click(screen.getByText('Return to dashboard'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Overview unavailable.');
  expect(document.querySelectorAll('.admin-metric strong')).toHaveLength(4);
  expect([...document.querySelectorAll('.admin-metric strong')].map((node) => node.textContent)).toEqual(['—', '—', '—', '—']);
});

it('keeps missing totals unavailable and renders real zero totals', async () => {
  http.get.mockImplementation((url) => Promise.resolve({ data: url.includes('overview') ? { companies: 0 } : { count: 0, results: [] } }));
  render(<MemoryRouter><AdminPage /></MemoryRouter>);
  expect(await screen.findByText('0')).toBeInTheDocument();
  expect([...document.querySelectorAll('.admin-metric strong')].map((node) => node.textContent)).toEqual(['—', '—', '0', '—']);
  expect(screen.queryByText(/jobs, and applications/)).not.toBeInTheDocument();
});

function DashboardLink() { return <Link to="/admin">Return to dashboard</Link>; }

it('does not show zero totals while the overview is pending', async () => {
  http.get.mockImplementation((url) => url.includes('overview') ? new Promise(() => {}) : Promise.resolve({ data: { count: 0, results: [] } }));
  render(<MemoryRouter><AdminPage /></MemoryRouter>);
  expect([...document.querySelectorAll('.admin-metric strong')].map((node) => node.textContent)).toEqual(['—', '—', '—', '—']);
  expect(await screen.findByText('No moderation decisions recorded')).toBeInTheDocument();
});

it('reports history failures separately from successful overview totals', async () => {
  http.get.mockImplementation((url) => url.includes('overview') ? Promise.resolve({ data: { companies: 3 } }) : Promise.reject(new Error('Unavailable')));
  render(<MemoryRouter><AdminPage /></MemoryRouter>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Activity could not be loaded.');
  expect(screen.getByText('3')).toBeInTheDocument();
  expect(screen.queryByText('No moderation decisions recorded')).not.toBeInTheDocument();
});
