export function labelFor(value) {
  return value ? value.toLowerCase().split('_').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ') : '';
}

export function formatJobDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

export function formatSalary(job) {
  if (job.salary_min == null && job.salary_max == null) return '';
  const amount = (value) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Number(value));
  const range = job.salary_min != null && job.salary_max != null ? `${amount(job.salary_min)}–${amount(job.salary_max)}` : amount(job.salary_min ?? job.salary_max);
  return `${job.salary_currency || ''} ${range}${job.salary_period ? ` / ${job.salary_period}` : ''}`.trim();
}

export function canWithdraw(status) { return ['SUBMITTED', 'REVIEWING', 'SHORTLISTED'].includes(status); }
