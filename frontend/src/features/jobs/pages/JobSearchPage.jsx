import { useEffect, useState } from 'react';
import { Alert, Card, Empty, Input, Pagination, Select, Spin, Tag } from 'antd';
import { Link, useSearchParams } from 'react-router-dom';
import { jobsApi } from '../services/api.js';
import { formatJobDate, formatSalary, labelFor } from '../utils/format.js';

const filters = [
  ['country', 'Country code'], ['location', 'Location'],
  ['workplace_type', 'Workplace', ['REMOTE', 'HYBRID', 'ON_SITE']],
  ['employment_type', 'Employment', ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY', 'INTERNSHIP']],
  ['experience_level', 'Experience', ['ENTRY', 'MID', 'SENIOR', 'LEAD']],
  ['skill', 'Skill'], ['company', 'Company ID'],
];

export function JobSearchPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') || '');
  const [retryKey, setRetryKey] = useState(0);
  const [data, setData] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const query = params.toString();
  useEffect(() => { let active = true; const timer = setTimeout(() => {
    setLoading(true); setError('');
    jobsApi.list(Object.fromEntries(new URLSearchParams(query))).then((result) => { if (active) setData(result); })
      .catch(() => { if (active) setError('Jobs could not be loaded. Please try again.'); })
      .finally(() => { if (active) setLoading(false); });
  }, 300); return () => { active = false; clearTimeout(timer); }; }, [query, retryKey]);
  function update(name, value, resetPage = true) { const next = new URLSearchParams(params); if (value) next.set(name, value); else next.delete(name); if (resetPage) next.delete('page'); setParams(next); }
  return <section className="container jobs-page">
    <div className="jobs-heading"><div><p className="eyebrow">YOUR NEXT OPPORTUNITY</p><h1>Find your next role</h1><p>Explore software, data and AI opportunities around the world.</p></div></div>
    <div className="jobs-search"><Input aria-label="Search jobs" placeholder="Search titles and descriptions" value={search} onChange={(event) => { const value = event.target.value; setSearch(value); update('search', value); }} allowClear /></div>
    <div className="job-discovery">
      <aside className="job-filters" aria-label="Job filters"><h2>Filters</h2>{filters.map(([name, label, options]) => options
        ? <label className="filter-field" key={name}>{label}<Select aria-label={label} allowClear placeholder={`Any ${label.toLowerCase()}`} value={params.get(name) || undefined} onChange={(value) => update(name, value)} options={options.map((value) => ({ value, label: labelFor(value) }))} /></label>
        : <label className="filter-field" key={name}>{label}<Input aria-label={label} value={params.get(name) || ''} onChange={(event) => update(name, event.target.value)} placeholder={name === 'country' ? 'e.g. US' : `Any ${label.toLowerCase()}`} /></label>)}</aside>
      <div className="job-results" aria-live="polite">
        {error && <Alert type="error" showIcon title={error} action={<button className="text-button" onClick={() => setRetryKey((value) => value + 1)}>Retry</button>} />}
        {loading ? <div className="jobs-loading"><Spin /><span>Loading jobs…</span></div> : !error && data?.results?.length === 0 ? <Empty description="No jobs match these filters." /> : !error && <>
          <p className="results-count">{data?.count || 0} opportunities</p>
          {data?.results?.map((job) => <Card key={job.id} className="job-card" hoverable><Link to={`/jobs/${job.id}`} className="job-card-link"><div className="job-card-top"><div><h2>{job.title}</h2><p className="company-name">{job.company?.name}</p></div><span className="job-date">{formatJobDate(job.published_at || job.created_at)}</span></div><p className="job-meta">{[job.location, job.country, labelFor(job.workplace_type), labelFor(job.employment_type), labelFor(job.experience_level)].filter(Boolean).join(' · ')}</p>{formatSalary(job) && <p className="job-salary">{formatSalary(job)}</p>}<div className="job-tags">{(job.skills || []).map((skill) => <Tag key={skill}>{skill}</Tag>)}</div></Link></Card>)}
          <Pagination current={Number(params.get('page') || 1)} pageSize={20} total={data?.count || 0} onChange={(page) => update('page', String(page), false)} showSizeChanger={false} />
        </>}
      </div>
    </div>
  </section>;
}
