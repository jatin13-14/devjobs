import { http } from '../../auth/api.js';

export const jobsApi = {
  list: (params) => http.get('/jobs/', { params }).then(({ data }) => data),
  detail: (id) => http.get(`/jobs/${id}/`).then(({ data }) => data),
  apply: (id, payload) => http.post(`/jobs/${id}/applications/`, payload).then(({ data }) => data),
  applications: () => http.get('/candidates/me/applications/').then(({ data }) => data),
  application: (id) => http.get(`/candidates/me/applications/${id}/`).then(({ data }) => data),
  withdraw: (id) => http.patch(`/candidates/me/applications/${id}/`, {}).then(({ data }) => data),
  recruiterProfile: () => http.get('/recruiters/me/profile/').then(({ data }) => data),
  recruiterCompanies: () => http.get('/recruiters/me/companies/').then(({ data }) => data),
  company: (id) => http.get(`/companies/${id}/`).then(({ data }) => data),
  companyJobs: (id, params) => http.get(`/companies/${id}/jobs/`, { params }).then(({ data }) => data),
  companyJob: async (companyId, jobId) => {
    let page = 1;
    while (true) {
      const data = await jobsApi.companyJobs(companyId, { page });
      const job = (data.results || []).find((item) => item.id === jobId);
      if (job) return job;
      if (!data.next) throw new Error('This job is not part of the selected company.');
      page += 1;
    }
  },
  createJob: (payload) => http.post('/jobs/', payload).then(({ data }) => data),
  updateJob: (id, payload) => http.patch(`/jobs/${id}/`, payload).then(({ data }) => data),
  publishJob: (id) => http.post(`/jobs/${id}/publish/`).then(({ data }) => data),
  closeJob: (id) => http.post(`/jobs/${id}/close/`).then(({ data }) => data),
  recruiterApplications: (jobId, page) => http.get(`/jobs/${jobId}/applications/`, { params: { page } }).then(({ data }) => data),
  recruiterApplication: (jobId, applicationId) => http.get(`/jobs/${jobId}/applications/${applicationId}/`).then(({ data }) => data),
  updateApplicationStatus: (jobId, applicationId, status) => http.patch(`/jobs/${jobId}/applications/${applicationId}/status/`, { status }).then(({ data }) => data),
};

export function apiMessage(error) {
  const data = error.response?.data;
  if (typeof data?.detail === 'string') return data.detail;
  if (typeof data?.job === 'string') return data.job;
  if (Array.isArray(data?.job)) return data.job[0];
  if (typeof data?.status === 'string') return data.status;
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object') {
    const issues = Object.entries(data).filter(([, value]) => Array.isArray(value)).map(([field, value]) => `${field.replaceAll('_', ' ')}: ${value.join(' ')}`);
    if (issues.length) return issues.join(' ');
  }
  return 'Something went wrong. Please try again.';
}
