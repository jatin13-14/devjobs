import { jobsApi } from './api.js';

export async function loadCompanyApplications(jobs) {
  const applications = [];
  // Keep requests sequential to avoid bursts against companies with many jobs.
  for (const job of jobs) {
    let page = 1;
    while (true) {
      const data = await jobsApi.recruiterApplications(job.id, page);
      applications.push(...data.results);
      if (!data.next) break;
      page += 1;
    }
  }
  return applications.sort((a, b) => new Date(b.applied_at) - new Date(a.applied_at));
}

export function summarizeApplications(applications, now = new Date()) {
  const days = Array.from({ length: 7 }, (_, i) => { const date = new Date(now); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - 6 + i); return date; });
  return {
    total: applications.length,
    submitted: applications.filter((a) => a.status === 'SUBMITTED').length,
    reviewing: applications.filter((a) => a.status === 'REVIEWING').length,
    days: days.map((date) => { const end = new Date(date); end.setDate(end.getDate() + 1); return { date, count: applications.filter((a) => new Date(a.applied_at) >= date && new Date(a.applied_at) < end).length }; }),
  };
}
