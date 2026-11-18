import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CandidateLayout } from './CandidateLayout.jsx';
import { AuthContext } from '../../features/auth/authContext.js';
vi.mock('../../features/auth/api.js', () => ({ http: { get: vi.fn().mockResolvedValue({ data: { full_name: 'Casey Developer' } }) } }));
afterEach(() => { cleanup(); localStorage.clear(); });
function mount() { return render(<AuthContext.Provider value={{ user: { id: 'candidate', role: 'candidate' }, logout: vi.fn() }}><MemoryRouter initialEntries={['/candidate']}><Routes><Route element={<CandidateLayout authenticated />}><Route path="candidate" element={<h1>Candidate content</h1>} /></Route></Routes></MemoryRouter></AuthContext.Provider>); }
it('defaults to light, toggles immediately, and restores the saved candidate preference', async () => {
  const first = mount();
  expect(await screen.findByText('Casey Developer')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
  expect(document.querySelector('.candidate-dark')).toBeInTheDocument();
  expect(localStorage.getItem('devjobs.candidate.theme')).toBe('dark');
  first.unmount(); mount();
  expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Mobile candidate navigation' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Saved Jobs' })).not.toBeInTheDocument();
});
