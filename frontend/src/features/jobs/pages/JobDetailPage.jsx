import { useEffect, useState } from 'react';
import { Alert, Button, Card, Empty, Spin, Tag } from 'antd';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth.js';
import { apiMessage, jobsApi } from '../services/api.js';
import { formatJobDate, formatSalary, labelFor } from '../utils/format.js';

export function JobDetailPage() {
  const { id } = useParams(); const { user } = useAuth(); const navigate = useNavigate();
  const [job, setJob] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => { let active = true; jobsApi.detail(id).then((value) => { if (active) setJob(value); }).catch((e) => { if (active) setError(apiMessage(e)); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [id]);
  if (loading) return <div className="page-state"><Spin description="Loading job…" /></div>;
  if (error) return <div className="container page-state"><Alert type="error" showIcon title={error} /><Link to="/">Back to jobs</Link></div>;
  const apply = () => user ? navigate(`/jobs/${id}/apply`) : navigate('/login', { state: { from: { pathname: `/jobs/${id}/apply` } } });
  return <article className="container job-detail"><Link to="/" className="back-link">← All jobs</Link><Card className="detail-card"><p className="eyebrow">{job.company?.name}</p><h1>{job.title}</h1><p className="job-meta">{[job.location, job.country, labelFor(job.workplace_type), labelFor(job.employment_type), labelFor(job.experience_level)].filter(Boolean).join(' · ')}</p>{formatSalary(job) && <p className="job-salary">{formatSalary(job)}</p>}
    <div className="detail-facts"><span>Posted {formatJobDate(job.published_at || job.created_at)}</span>{job.application_deadline && <span>Apply by {formatJobDate(job.application_deadline)}</span>}</div>
    {job.skills?.length > 0 && <section><h2>Required skills</h2><div className="job-tags">{job.skills.map((skill) => <Tag key={skill}>{skill}</Tag>)}</div></section>}
    <section className="job-description"><h2>About the role</h2><p>{job.description}</p></section>
    {user?.role === 'candidate' && <Button type="primary" size="large" onClick={apply}>Apply for this job</Button>}
    {user?.role === 'recruiter' && <Alert type="info" message="Candidate applications are available to candidate accounts." showIcon />}
    {!user && <Button type="primary" size="large" onClick={apply}>Log in to apply</Button>}
  </Card></article>;
}

export function JobApplicationPage() {
  const { id } = useParams(); const { user } = useAuth(); const navigate = useNavigate(); const [job, setJob] = useState(null); const [cover, setCover] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { let active = true; jobsApi.detail(id).then((value) => { if (active) setJob(value); }).catch((e) => { if (active) setError(apiMessage(e)); }); return () => { active = false; }; }, [id]);
  if (user?.role !== 'candidate') return <div className="container page-state"><Empty description="Candidate access is required." /><Link to="/register/candidate">Create a candidate account</Link></div>;
  async function submit(event) { event.preventDefault(); setBusy(true); setError(''); try { const application = await jobsApi.apply(id, { cover_letter: cover }); navigate(`/candidate/applications/${application.id}`, { replace: true, state: { submitted: true } }); } catch (e) { setError(apiMessage(e)); } finally { setBusy(false); } }
  return <div className="container application-page"><Link to={`/jobs/${id}`}>← Back to job</Link><Card className="application-form-card"><p className="eyebrow">APPLICATION</p><h1>{job?.title || 'Apply for this job'}</h1>{job && <p className="company-name">{job.company?.name}</p>}{error && <Alert type="error" showIcon title={error} />}
    <form onSubmit={submit}><label htmlFor="cover-letter">Cover letter <span>(optional)</span></label><textarea id="cover-letter" maxLength={5000} rows={9} value={cover} onChange={(event) => setCover(event.target.value)} placeholder="Share a little about your interest and experience." /><p className="character-count">{cover.length}/5000</p><Button type="primary" htmlType="submit" loading={busy} disabled={!job}>Submit application</Button></form>
  </Card></div>;
}
