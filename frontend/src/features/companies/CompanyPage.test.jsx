import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CompanyPage } from './CompanyPage.jsx';
import { jobsApi } from '../jobs/services/api.js';
import { http } from '../auth/api.js';
vi.mock('../auth/useAuth.js', () => ({ useAuth: () => ({ user: { id: 'self' } }) }));
vi.mock('../auth/api.js', () => ({ http: { get: vi.fn() } }));
vi.mock('../jobs/services/api.js', () => ({ jobsApi: { company: vi.fn(), recruiterCompanies: vi.fn() }, apiMessage: () => 'Request failed' }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function mount() { render(<MemoryRouter initialEntries={['/recruiter/companies/company']}><Routes><Route path="/recruiter/companies/:id" element={<CompanyPage />} /></Routes></MemoryRouter>); }
it('shows member details without edit or membership controls', async () => {
  jobsApi.company.mockResolvedValue({ name: 'Synthetic Company' });
  jobsApi.recruiterCompanies.mockResolvedValue([{ id: 'company', role: 'MEMBER' }]);
  mount();
  expect(await screen.findByText('Active membership · MEMBER')).toBeInTheDocument();
  expect(screen.getByLabelText('name')).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Save company' })).not.toBeInTheDocument();
  expect(http.get).not.toHaveBeenCalled();
});
it('protects owner and own membership from unsafe operations', async () => {
  jobsApi.company.mockResolvedValue({ name: 'Synthetic Company' });
  jobsApi.recruiterCompanies.mockResolvedValue([{ id: 'company', role: 'OWNER' }]);
  http.get.mockResolvedValue({ data: [{ id: 'owner', recruiter_id: 'self', recruiter_name: 'Synthetic Owner', role: 'OWNER', status: 'ACTIVE' }] });
  mount();
  expect(await screen.findByText('Synthetic Owner · OWNER · ACTIVE')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Remove membership' })).not.toBeInTheDocument();
});
