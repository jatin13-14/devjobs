import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RecruiterLayout } from './RecruiterLayout.jsx';
vi.mock('../../features/auth/useAuth.js', () => ({ useAuth: () => ({ user: { id: 'r1', email: 'r@example.test' }, logout: vi.fn() }) }));
vi.mock('../../features/jobs/services/api.js', () => ({ jobsApi: { recruiterCompanies: () => Promise.resolve([]), recruiterProfile: () => Promise.resolve({ name: 'Riley Recruiter' }) } }));
afterEach(() => { cleanup(); localStorage.clear(); });
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
