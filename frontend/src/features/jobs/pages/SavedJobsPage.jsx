import { useEffect, useState } from 'react';
import { Alert, Button, Card, Empty, Pagination, Spin } from 'antd';
import { Link } from 'react-router-dom';
import { useViewAuthority } from '../../auth/useViewAuthority.js';
import { useAuth } from '../../auth/useAuth.js';
import { apiMessage, jobsApi } from '../services/api.js';
import { formatSalary, labelFor } from '../utils/format.js';

export function SavedJobsPage() {
  const { user } = useAuth();
  return <CandidateSavedJobsView key={user?.id || 'anonymous'} />;
}

function CandidateSavedJobsView() {
  const view = useViewAuthority('saved-jobs');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState(null);

  useEffect(() => {
    if (!view.valid()) return;
    const config = view.config;
    let active = true;
    setLoading(true);
    setError('');
    jobsApi.savedJobs({ page }, config)
      .then((result) => { if (active && view.valid()) setData(result); })
      .catch((reason) => { if (active && view.valid()) setError(apiMessage(reason)); })
      .finally(() => { if (active && view.valid()) setLoading(false); });
    return () => { active = false; };
  }, [page, revision, view]);

  async function remove(id) {
    if (!view.valid() || view.busy || removing) return;
    view.busy = true;
    const config = view.config;
    setRemoving(id);
    setError('');
    try {
      await jobsApi.unsaveJob(id, config);
      if (!view.valid()) return;
      if (data?.results?.length === 1 && page > 1) setPage((value) => value - 1);
      else setRevision((value) => value + 1);
    } catch (reason) {
      if (view.valid()) setError(apiMessage(reason));
    } finally {
      view.busy = false;
      if (view.valid()) setRemoving(null);
    }
  }

  return <section className="container jobs-page">
    <div className="jobs-heading"><div><p className="eyebrow">YOUR SHORTLIST</p><h1>Saved jobs</h1><p>Keep interesting opportunities together and return when you're ready.</p></div></div>
    {error && <Alert type="error" showIcon title={error} action={<Button onClick={() => setRevision((value) => value + 1)}>Retry</Button>} />}
    {loading ? <div className="jobs-loading"><Spin /><span>Loading saved jobs…</span></div>
      : !error && !data?.results?.length ? <Empty description="No saved jobs yet"><Link to="/">Explore jobs</Link></Empty>
        : !error && <>
          <div className="job-results">
            {data.results.map(({ job, saved_at }) => <Card key={job.id} className="job-card">
              <div className="job-card-top"><div><h2><Link to={`/jobs/${job.id}`}>{job.title}</Link></h2><p className="company-name">{job.company?.name}</p></div></div>
              <p className="job-meta">{[job.location, job.country, labelFor(job.workplace_type), labelFor(job.employment_type)].filter(Boolean).join(' · ')}</p>
              {formatSalary(job) && <p className="job-salary">{formatSalary(job)}</p>}
              <p className="job-meta">Saved {new Date(saved_at).toLocaleDateString()}</p>
              <Button onClick={() => remove(job.id)} loading={removing === job.id} disabled={Boolean(removing)}>Remove saved job</Button>
            </Card>)}
          </div>
          <Pagination current={page} pageSize={20} total={data.count || 0} onChange={setPage} showSizeChanger={false} />
        </>}
  </section>;
}
