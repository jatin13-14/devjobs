import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ResumePage } from './ResumePage.jsx';
import { RecruiterApplicantDetailPage } from '../jobs/pages/RecruiterPages.jsx';
import { resumeApi } from './api.js';
import { jobsApi } from '../jobs/services/api.js';

vi.mock('./api.js', () => ({ resumeApi: { metadata: vi.fn(), upload: vi.fn(), remove: vi.fn(), download: vi.fn(), applicantDownload: vi.fn() }, resumeError: () => 'Resume action failed.' }));
vi.mock('../jobs/services/api.js', () => ({ jobsApi: { recruiterApplication: vi.fn() }, apiMessage: () => 'Request failed.' }));
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);
const metadata = { filename: 'resume.pdf', size: 400, updated_at: '2026-11-07T00:00:00Z' };

it('uploads, replaces, downloads and removes a resume', async () => {
  resumeApi.metadata.mockResolvedValue(null); resumeApi.upload.mockResolvedValue(metadata); resumeApi.remove.mockResolvedValue(); resumeApi.download.mockResolvedValue();
  const { container } = render(<ResumePage />);
  expect(await screen.findByText('No resume uploaded.')).toBeInTheDocument();
  const first = new File(['synthetic'], 'first.pdf', { type: 'application/pdf' });
  fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [first] } });
  expect(await screen.findByText(/400 bytes/)).toBeInTheDocument();
  expect(resumeApi.upload).toHaveBeenCalledWith(first);
  fireEvent.click(screen.getByRole('button', { name: 'Download resume' }));
  await waitFor(() => expect(resumeApi.download).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByRole('button', { name: 'Replace resume' })).not.toBeDisabled());
  const second = new File(['replacement'], 'second.pdf', { type: 'application/pdf' });
  fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [second] } });
  await waitFor(() => expect(resumeApi.upload).toHaveBeenCalledWith(second));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Remove resume' })).not.toBeDisabled());
  fireEvent.click(screen.getByRole('button', { name: 'Remove resume' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Remove', exact: true }));
  expect(await screen.findByText('No resume uploaded.')).toBeInTheDocument();
});

it('preserves resume status when replacement or deletion fails', async () => {
  resumeApi.metadata.mockResolvedValue(metadata); resumeApi.upload.mockRejectedValue(new Error()); resumeApi.remove.mockRejectedValue(new Error());
  const { container } = render(<ResumePage />);
  await screen.findByText(/400 bytes/);
  fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [new File(['bad'], 'bad.pdf')] } });
  expect(await screen.findByText('Resume action failed.')).toBeInTheDocument();
  expect(screen.getByText(/400 bytes/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Remove resume' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Remove', exact: true }));
  expect(await screen.findByText('Resume action failed.')).toBeInTheDocument();
  expect(screen.getByText(/400 bytes/)).toBeInTheDocument();
});

it('shows metadata load failures', async () => {
  resumeApi.metadata.mockRejectedValue(new Error());
  render(<ResumePage />);
  expect(await screen.findByText('Resume action failed.')).toBeInTheDocument();
});

function applicant(available) {
  jobsApi.recruiterApplication.mockResolvedValue({ candidate: { full_name: 'Synthetic Candidate', skills: [] }, status: 'SUBMITTED', resume_available: available });
  render(<MemoryRouter initialEntries={['/jobs/job-1/applicants/app-1']}><Routes><Route path="/jobs/:id/applicants/:applicationId" element={<RecruiterApplicantDetailPage />} /></Routes></MemoryRouter>);
}

it('downloads through the application scope and displays revoked access errors', async () => {
  resumeApi.applicantDownload.mockRejectedValue(new Error());
  applicant(true);
  fireEvent.click(await screen.findByRole('button', { name: 'Download resume' }));
  await waitFor(() => expect(resumeApi.applicantDownload).toHaveBeenCalledWith('job-1', 'app-1'));
  expect(await screen.findByText('Resume action failed.')).toBeInTheDocument();
});

it('hides applicant download when the backend reports resume unavailable', async () => {
  applicant(false);
  expect(await screen.findByText('Resume unavailable.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Download resume' })).not.toBeInTheDocument();
});
