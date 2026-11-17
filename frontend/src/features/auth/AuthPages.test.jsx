import { writeAuth, readAuth } from './api.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider } from 'antd';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './AuthContext.jsx';
import { useAuth } from './useAuth.js';
import { CandidateRegistrationPage, LoginPage, RecruiterRegistrationPage } from './AuthPages.jsx';
import { authApi } from './api.js';
import { RouteGuard } from './RouteGuard.jsx';

vi.mock('./api.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, authApi: { login: vi.fn(), logout: vi.fn(), registerCandidate: vi.fn(), registerRecruiter: vi.fn() } };
});
function renderAuth(page, route = '/login') {
  return render(<ConfigProvider><AuthProvider><MemoryRouter initialEntries={[route]}><Routes><Route path="/login" element={<LoginPage />} /><Route path="/register/candidate" element={<CandidateRegistrationPage />} /><Route path="/register/recruiter" element={<RecruiterRegistrationPage />} /><Route element={<RouteGuard roles={['candidate']} />}><Route path="/candidate" element={<p>Candidate area</p>} /></Route><Route element={<RouteGuard roles={['recruiter']} />}><Route path="/recruiter" element={<p>Recruiter area</p>} /></Route></Routes></MemoryRouter></AuthProvider></ConfigProvider>);
}
const fill = async (user, field, value) => user.type(screen.getByLabelText(field), value);
function LogoutControl() { const { logout, user } = useAuth(); return <button onClick={logout}>{user ? 'Log out' : 'Signed out'}</button>; }
beforeEach(async () => { vi.clearAllMocks(); window.localStorage.clear(); });
afterEach(cleanup);

describe('authentication screens', () => {
  it('registers candidates and shows backend field validation', async () => {
    const user = userEvent.setup(); authApi.registerCandidate.mockRejectedValueOnce({ response: { data: { email: ['Already registered.'] } } });
    renderAuth(<CandidateRegistrationPage />, '/register/candidate');
    await fill(user, 'Full name', 'Casey Developer'); await fill(user, 'Email address', 'casey@example.com'); await fill(user, 'Password', 'Strong-pass-42!'); await fill(user, 'Confirm password', 'Strong-pass-42!');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(authApi.registerCandidate).toHaveBeenCalledWith({ full_name: 'Casey Developer', email: 'casey@example.com', password: 'Strong-pass-42!' }));
    expect(await screen.findByText('Already registered.')).toBeInTheDocument();
  });
  it('submits recruiter registration with the required full name and without company fields', async () => {
    const user = userEvent.setup(); authApi.registerRecruiter.mockResolvedValueOnce({ id: 'r1' });
    renderAuth(<RecruiterRegistrationPage />, '/register/recruiter');
    await fill(user, 'Full name', 'Riley Recruiter'); await fill(user, 'Email address', 'recruiter@example.com'); await fill(user, 'Password', 'Strong-pass-42!'); await fill(user, 'Confirm password', 'Strong-pass-42!');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(authApi.registerRecruiter).toHaveBeenCalledWith({ name: 'Riley Recruiter', email: 'recruiter@example.com', password: 'Strong-pass-42!' }));
  });
  it('logs in and reports invalid credentials', async () => {
    const user = userEvent.setup(); authApi.login.mockRejectedValueOnce({ response: { data: { detail: 'No active account found with the given credentials' } } });
    renderAuth(<LoginPage />);
    await fill(user, 'Email address', 'bad@example.com'); await fill(user, 'Password', 'incorrect'); await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/credentials/i);
    authApi.login.mockResolvedValueOnce({ access: 'access-token', refresh: 'refresh-token', user: { id: '1', email: 'c@example.com', role: 'candidate' } });
    await user.clear(screen.getByLabelText('Email address')); await fill(user, 'Email address', 'c@example.com'); await user.clear(screen.getByLabelText('Password')); await fill(user, 'Password', 'Good-pass-42!'); await user.click(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() => expect(readAuth()?.access).toBe('access-token'));
  });
  it('keeps an admin login anonymous and usable after a quota response', async () => {
    const user = userEvent.setup();
    authApi.login.mockRejectedValueOnce({ response: { status: 429, data: { detail: 'Request was throttled. Expected available in 1 second.' } } });
    renderAuth(<LoginPage admin />);
    await fill(user, 'Email address', 'admin@example.test'); await fill(user, 'Password', 'Strong-pass-42!');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Request was throttled.');
    expect(readAuth()).toBeNull();
    expect(screen.getByLabelText('Email address')).toHaveValue('admin@example.test');
    expect(screen.getByLabelText('Password')).toHaveValue('Strong-pass-42!');
    await waitFor(() => expect(document.querySelector('form button[type=submit]')).not.toHaveClass('ant-btn-loading'));
    expect(document.querySelector('form button[type=submit]')).toBeEnabled();
    expect(authApi.login).toHaveBeenCalledTimes(1);
  });
  it('validates email and password confirmation in the browser', async () => {
    const user = userEvent.setup(); renderAuth(<CandidateRegistrationPage />, '/register/candidate');
    await user.type(screen.getByLabelText('Email address'), 'bad'); await user.type(screen.getByLabelText('Password'), 'short'); await user.type(screen.getByLabelText('Confirm password'), 'different');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument(); expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    expect(authApi.registerCandidate).not.toHaveBeenCalled();
  });
  it('guards both role routes in both directions and sends anonymous users to login', async () => {
    const { unmount } = renderAuth(<LoginPage />, '/candidate');
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument(); unmount();
    await writeAuth({ access: 'a', refresh: 'r', user: { id: 'synthetic-user', role: 'recruiter' } });
    renderAuth(<LoginPage />, '/candidate');
    expect(await screen.findByText('Recruiter area')).toBeInTheDocument();
    cleanup();
    await writeAuth({ access: 'a', refresh: 'r', user: { id: 'synthetic-user', role: 'candidate' } });
    renderAuth(<LoginPage />, '/recruiter');
    expect(await screen.findByText('Candidate area')).toBeInTheDocument();
    cleanup();
    renderAuth(<LoginPage />, '/candidate');
    expect(await screen.findByText('Candidate area')).toBeInTheDocument();
    cleanup();
    await writeAuth({ access: 'a', refresh: 'r', user: { id: 'synthetic-user', role: 'recruiter' } });
    renderAuth(<LoginPage />, '/recruiter');
    expect(await screen.findByText('Recruiter area')).toBeInTheDocument();
  });
  it('sends a candidate to their own workspace when a login return path targets recruiters', async () => {
    const user = userEvent.setup();
    authApi.login.mockResolvedValueOnce({ access: 'a', refresh: 'r', user: { id: 'c', role: 'candidate' } });
    renderAuth(<LoginPage />, { pathname: '/login', state: { from: { pathname: '/recruiter/jobs' } } });
    await fill(user, 'Email address', 'casey@example.test'); await fill(user, 'Password', 'Strong-pass-42!');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Candidate area')).toBeInTheDocument();
  });
  it('clears stored credentials on logout', async () => {
    await writeAuth({ access: 'a', refresh: 'r', user: { id: 'synthetic-user', role: 'candidate' } });
    const user = userEvent.setup();
    render(<ConfigProvider><AuthProvider><LogoutControl /></AuthProvider></ConfigProvider>);
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    expect(screen.getByRole('button', { name: 'Signed out' })).toBeInTheDocument();
    expect(readAuth()).toBeNull();
    await waitFor(() => expect(authApi.logout).toHaveBeenCalledWith('r'));
  });
});

it('preserves company selection and hash when returning from recruiter login', async () => {
  const user = userEvent.setup();
  authApi.login.mockResolvedValueOnce({ access: 'access-token', refresh: 'refresh-token', user: { id: 'return-recruiter', role: 'recruiter' } });
  render(<ConfigProvider><AuthProvider><MemoryRouter initialEntries={[{ pathname: '/login', state: { from: { pathname: '/recruiter/jobs', search: '?company=selected-company', hash: '#job-list' } } }]}><Routes><Route path="/login" element={<LoginPage />} /><Route path="/recruiter/jobs" element={<ReturnLocation />} /><Route path="/recruiter" element={<p>Wrong return destination</p>} /></Routes></MemoryRouter></AuthProvider></ConfigProvider>);
  await fill(user, 'Email address', 'return@example.test');
  await fill(user, 'Password', 'Good-pass-42!');
  await user.click(screen.getByRole('button', { name: 'Log in' }));
  expect(await screen.findByText('/recruiter/jobs?company=selected-company#job-list')).toBeInTheDocument();
});

function ReturnLocation() { const location = useLocation(); return <p>{location.pathname}{location.search}{location.hash}</p>; }
