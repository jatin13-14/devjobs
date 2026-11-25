import { useEffect, useState } from 'react';
import { Alert, Button, Card, Drawer, Empty, Input, Pagination, Select, Spin, Tag } from 'antd';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth.js';
import { useViewAuthority } from '../../auth/useViewAuthority.js';
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
  const { user } = useAuth();
  return <JobSearchView key={user?.id || 'anonymous'} user={user} />;
}

function JobSearchView({ user }) {
  const bookmarkView = useViewAuthority('job-search-bookmarks');
  const [bookmarks, setBookmarks] = useState(null);
  const [bookmarkError, setBookmarkError] = useState('');
  const [bookmarkRetry, setBookmarkRetry] = useState(0);
  const [busyBookmark, setBusyBookmark] = useState(null);
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => { setSearch(params.get('search') || ''); }, [params]);
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
  useEffect(() => {
    if (user?.role !== 'candidate' || loading || error || !data?.results || !bookmarkView.valid()) return;
    let active = true;
    const config = bookmarkView.config;
    setBookmarks(null);
    setBookmarkError('');
    jobsApi.savedJobStatuses(data.results.map((job) => job.id), config)
      .then((result) => {
        if (active && bookmarkView.valid()) setBookmarks(new Set(result.saved_job_ids));
      })
      .catch(() => {
        if (active && bookmarkView.valid()) setBookmarkError('Saved job status could not be loaded.');
      });
    return () => { active = false; };
  }, [user?.role, data, loading, error, bookmarkRetry, bookmarkView]);
  async function toggleBookmark(id) {
    if (!bookmarkView.valid() || busyBookmark || !bookmarks || bookmarkError) return;
    const config = bookmarkView.config;
    const wasSaved = bookmarks.has(id);
    setBusyBookmark(id);
    setBookmarkError('');
    try {
      if (wasSaved) await jobsApi.unsaveJob(id, config);
      else await jobsApi.saveJob(id, config);
      if (!bookmarkView.valid()) return;
      setBookmarks((old) => {
        const next = new Set(old);
        if (wasSaved) next.delete(id);
        else next.add(id);
        return next;
      });
    } catch (reason) {
      if (bookmarkView.valid()) setBookmarkError(reason.response?.status === 404 ? 'This job is no longer available.' : 'Could not update saved job. Please retry.');
    } finally {
      if (bookmarkView.valid()) setBusyBookmark(null);
    }
  }
  function update(name, value, resetPage = true) { const next = new URLSearchParams(params); if (value) next.set(name, value); else next.delete(name); if (resetPage) next.delete('page'); setParams(next); }
  const filterControls = <><h2>Filters</h2>{params.size > 0 && <Button type="link" onClick={() => { setSearch(''); setParams({}); }}>Clear filters</Button>}{filters.map(([name, label, options]) => options
        ? <label className="filter-field" key={name}>{label}<Select aria-label={label} allowClear placeholder={`Any ${label.toLowerCase()}`} value={params.get(name) || undefined} onChange={(value) => update(name, value)} options={options.map((value) => ({ value, label: labelFor(value) }))} /></label>
        : <label className="filter-field" key={name}>{label}<Input aria-label={label} value={params.get(name) || ''} onChange={(event) => update(name, event.target.value)} placeholder={name === 'country' ? 'e.g. US' : `Any ${label.toLowerCase()}`} /></label>)}</>;
  return <section className="container jobs-page">
    <div className="jobs-heading"><div><p className="eyebrow">YOUR NEXT OPPORTUNITY</p><h1>Find your next role</h1><p>Explore software, data and AI opportunities around the world.</p></div></div>
    <div className="jobs-search"><Input aria-label="Search jobs" placeholder="Search titles and descriptions" value={search} onChange={(event) => { const value = event.target.value; setSearch(value); update('search', value); }} allowClear /></div>
    <div className="job-discovery">
      <Button className="mobile-filter-button" onClick={() => setFiltersOpen(true)}>Filters</Button>
      <aside className="job-filters desktop-job-filters" aria-label="Job filters">{filterControls}</aside>
      <Drawer title="Filter jobs" open={filtersOpen} onClose={() => setFiltersOpen(false)}><div className="job-filters">{filterControls}</div><Button type="primary" onClick={() => setFiltersOpen(false)}>Show results</Button></Drawer>
      <div className="job-results" aria-live="polite">
        {error && <Alert type="error" showIcon title={error} action={<button className="text-button" onClick={() => setRetryKey((value) => value + 1)}>Retry</button>} />}
        {user?.role === 'candidate' && bookmarkError && <Alert type="error" showIcon title={bookmarkError} action={<Button onClick={() => setBookmarkRetry((value) => value + 1)}>Retry saved jobs</Button>} />}
        {loading ? <div className="jobs-loading"><Spin /><span>Loading jobs…</span></div> : !error && data?.results?.length === 0 ? <Empty description="No jobs match these filters."><Button onClick={() => { setSearch(''); setParams({}); }}>Clear filters</Button></Empty> : !error && <>
          <p className="results-count">{data?.count || 0} opportunities</p>
          {data?.results?.map((job) => <Card key={job.id} className="job-card" hoverable><Link to={`/jobs/${job.id}`} className="job-card-link"><div className="job-card-top"><div><h2>{job.title}</h2><p className="company-name">{job.company?.name}</p></div><span className="job-date">{formatJobDate(job.published_at || job.created_at)}</span></div><p className="job-meta">{[job.location, job.country, labelFor(job.workplace_type), labelFor(job.employment_type), labelFor(job.experience_level)].filter(Boolean).join(' · ')}</p>{formatSalary(job) && <p className="job-salary">{formatSalary(job)}</p>}<div className="job-tags">{(job.skills || []).map((skill) => <Tag key={skill}>{skill}</Tag>)}</div></Link>{user?.role === 'candidate' && <Button aria-label={`${bookmarks?.has(job.id) ? 'Remove saved' : 'Save'} ${job.title}`} onClick={() => toggleBookmark(job.id)} loading={busyBookmark === job.id} disabled={!bookmarks || Boolean(bookmarkError) || Boolean(busyBookmark) || !bookmarkView.valid()}>{bookmarks?.has(job.id) ? 'Remove saved job' : 'Save job'}</Button>}</Card>)}
          <Pagination current={Number(params.get('page') || 1)} pageSize={20} total={data?.count || 0} onChange={(page) => update('page', String(page), false)} showSizeChanger={false} />
        </>}
      </div>
    </div>
  </section>;
}
