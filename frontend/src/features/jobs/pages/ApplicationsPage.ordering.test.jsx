import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../../auth/AuthContext.jsx';
import { writeAuth } from '../../auth/api.js';
import { ApplicationDetailPage } from './ApplicationsPage.jsx';
import { jobsApi } from '../services/api.js';

vi.mock('../services/api.js', () => ({ jobsApi: { application: vi.fn(), withdraw: vi.fn() }, apiMessage: () => 'failed' }));
vi.mock('antd', () => {
  const Box = ({ children }) => <div>{children}</div>;
  return { Alert: ({ title }) => <p>{title}</p>, Card: Box, Tag: ({ children }) => <span>{children}</span>, Spin: () => <p>pending</p>, Popconfirm: Box, Button: Box, Empty: Box, Pagination: Box };
});
afterEach(() => { cleanup(); localStorage.clear(); vi.resetAllMocks(); });
it('does not let application A overwrite B even when the transport ignores cancellation', async () => {
  await writeAuth({ access: 'test-access', refresh: 'test-refresh', user: { id: 'A', role: 'candidate' } });
  const pending = {};
  jobsApi.application.mockImplementation((id) => new Promise((resolve) => { pending[id] = resolve; }));
  const view = render(<AuthProvider><MemoryRouter initialEntries={['/applications/A']}><Link to="/applications/B">Open B</Link><Routes><Route path="/applications/:applicationId" element={<ApplicationDetailPage />} /></Routes></MemoryRouter></AuthProvider>);
  await waitFor(() => expect(pending.A).toBeDefined());
  fireEvent.click(view.getByText('Open B'));
  await waitFor(() => expect(pending.B).toBeDefined());
  const application = (title) => ({ id: title, status: 'WITHDRAWN', job: { title, company: 'Company' } });
  await act(async () => { pending.B(application('Current B')); });
  expect(view.getByRole('heading', { name: 'Current B' })).toBeTruthy();
  await act(async () => { pending.A(application('Private A')); });
  expect(view.getByRole('heading', { name: 'Current B' })).toBeTruthy();
  expect(view.queryByText('Private A')).toBeNull();
});
