import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminPage } from './AdminPage.jsx';
import { RouteGuard } from '../auth/RouteGuard.jsx';
import { http } from '../auth/api.js';
import { useAuth } from '../auth/useAuth.js';
vi.mock('../auth/api.js', () => ({ http: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../auth/useAuth.js', () => ({ useAuth: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); http.get.mockImplementation((url) => Promise.resolve({ data: url.includes('overview') ? { companies: 1 } : { count: 1, results: [{ id: 'one', name: 'Test Company', is_suspended: false }] } })); });
afterEach(cleanup);
it('denies ordinary users access to the admin route', () => {
  useAuth.mockReturnValue({ user: { role: 'recruiter' } });
  render(<MemoryRouter initialEntries={['/admin']}><Routes><Route element={<RouteGuard platformAdmin />}><Route path="/admin" element={<AdminPage />} /></Route><Route path="/" element={<p>Public jobs</p>} /></Routes></MemoryRouter>);
  expect(screen.getByText('Public jobs')).toBeInTheDocument(); expect(http.get).not.toHaveBeenCalled();
});
it('requires a reason and submits a confirmed decision', async () => {
  http.post.mockResolvedValue({ data: {} }); render(<AdminPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Moderate' }));
  expect(screen.getByRole('button', { name: 'OK' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Moderation reason'), { target: { value: 'Policy violation' } });
  fireEvent.click(screen.getByRole('button', { name: 'OK' }));
  await waitFor(() => expect(http.post).toHaveBeenCalledWith('/admin/companies/one/', { action: 'suspend', reason: 'Policy violation' }));
});
it('displays authorization and API failures', async () => {
  http.get.mockRejectedValue({ response: { data: { detail: 'Permission denied.' } } }); render(<AdminPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Permission denied.');
});
