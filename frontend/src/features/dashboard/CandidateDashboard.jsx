import { useEffect, useState } from 'react';
import { Alert, Avatar, Button, Card, Progress, Skeleton, Tag } from 'antd';
import { CheckCircleFilled, MinusCircleOutlined, UserOutlined, FileTextOutlined, ApartmentOutlined, EnvironmentOutlined, BankOutlined, ClockCircleOutlined, ArrowRightOutlined, SearchOutlined, EditOutlined, DownloadOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { http } from '../auth/api.js';
import { jobsApi, apiMessage } from '../jobs/services/api.js';
import { resumeApi } from '../resumes/api.js';
import { StatusLabel } from '../../components/molecules/WorkspaceUI.jsx';
import { formatJobDate, formatSalary, labelFor } from '../jobs/utils/format.js';
import { profileCompletion } from './profileCompletion.js';

export function CandidateDashboard() {
  const [downloadBusy, setDownloadBusy] = useState(false); const [downloadError, setDownloadError] = useState('');
  const [data, setData] = useState(null); const [error, setError] = useState(''); const [revision, setRevision] = useState(0);
  useEffect(() => { let live = true;
    Promise.all([http.get('/candidates/me/profile/').then(({ data }) => data), resumeApi.metadata(), jobsApi.applications({ page: 1, page_size: 3 }), http.get('/candidates/me/skills/', { params: { pagination: 'page', page: 1, page_size: 1 } }).then(({ data }) => data.results), jobsApi.list({ page: 1, page_size: 3 })]).then(([profile, resume, applications, skills, jobs]) => { if (live) setData({ profile, resume, applications, skills, jobs }); }).catch((e) => { if (live) setError(apiMessage(e)); });
    return () => { live = false; };
  }, [revision]);
  if (error) return <section className="candidate-dashboard"><Alert type="error" showIcon title={error} action={<Button onClick={() => { setError(''); setRevision((v) => v + 1); }}>Retry</Button>} /></section>;
  if (!data) return <section className="candidate-dashboard"><Skeleton active /><Skeleton active /></section>;
  const { profile, resume, applications, skills, jobs } = data; const records = applications.results || [];
  const completion = profileCompletion(profile, skills, resume);
  const checks = [
    ['Basic Information', ['full_name', 'professional_headline', 'country', 'city', 'about'].every((key) => Boolean(profile[key]?.trim())), '/candidate/profile'],
    ['Experience', profile.years_of_experience != null, '/candidate/profile'],
    ['Skills', skills.length > 0, '/candidate/skills'],
    ['Professional Links', ['github_url', 'linkedin_url', 'portfolio_url'].some((key) => Boolean(profile[key])), '/candidate/profile'],
    ['Resume', Boolean(resume), '/candidate/resume'],
  ];
  async function downloadResume() { setDownloadBusy(true); setDownloadError(''); try { await resumeApi.download(); } catch (e) { setDownloadError(apiMessage(e)); } finally { setDownloadBusy(false); } }
  return <section className="candidate-dashboard"><div className="candidate-primary-column">
    <div className="candidate-welcome"><p className="candidate-greeting">Welcome back{profile.full_name ? `, ${profile.full_name.trim().split(/\s+/)[0]}` : ''} 👋</p><h1>Find Your Next Opportunity</h1><p>Discover relevant roles, apply, and track your applications in one place.</p><div className="candidate-welcome-actions"><Link to="/"><Button type="primary" icon={<SearchOutlined />}>Explore Jobs</Button></Link><Link to="/candidate/profile"><Button icon={<EditOutlined />}>Complete Profile</Button></Link></div></div>
    <section className="candidate-opportunities"><div className="candidate-section-heading"><h2>Recommended Opportunities</h2><Link to="/">View All Jobs <ArrowRightOutlined /></Link></div>
      {!jobs.results?.length ? <p className="candidate-empty">No published jobs are currently available.</p> : jobs.results.slice(0, 3).map((job) => <article className="candidate-job" key={job.id}>
        <Avatar shape="square" className="candidate-company-avatar">{(job.company?.name || '?').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</Avatar>
        <div className="candidate-job-info"><h3><Link to={`/jobs/${job.id}`}>{job.title}</Link></h3><p>{job.company?.name}</p><div className="candidate-job-meta"><span><EnvironmentOutlined /> {[job.location, job.country].filter(Boolean).join(', ')}</span><span><BankOutlined /> {labelFor(job.workplace_type)}</span>{job.experience_level && <span><ClockCircleOutlined /> {labelFor(job.experience_level)}</span>}</div><div className="candidate-job-skills">{(job.skills || []).map((skill) => <Tag key={skill}>{skill}</Tag>)}</div></div>
        <div className="candidate-job-actions">{formatSalary(job) && <strong>{formatSalary(job)}</strong>}<Link to={`/jobs/${job.id}`}><Button type="primary">View Details <ArrowRightOutlined /></Button></Link></div>
      </article>)}
    </section></div>
    <aside className="candidate-information" aria-label="Candidate information"><Card className="candidate-panel"><div className="candidate-section-heading"><h2><UserOutlined /> Profile Completion</h2><strong>{completion.percent}%</strong></div><Progress percent={completion.percent} showInfo={false} strokeColor="#623dff" /><ul className="candidate-checklist">{checks.map(([label, done, to]) => <li key={label}><Link to={to}>{done ? <CheckCircleFilled className="complete" /> : <MinusCircleOutlined />}<span>{label}</span></Link></li>)}</ul><Link to="/candidate/profile"><Button block>Complete Your Profile <ArrowRightOutlined /></Button></Link></Card>
    <Card className="candidate-panel"><h2><FileTextOutlined /> Resume</h2><div className="candidate-resume-state">{resume ? <><FileTextOutlined /><div><strong>{resume.filename}</strong><p>{resume.updated_at ? `Updated ${formatJobDate(resume.updated_at)}` : 'Private resume'}</p></div><Button aria-label="Download resume" icon={<DownloadOutlined />} loading={downloadBusy} onClick={downloadResume} /></> : <p>No resume uploaded yet.</p>}</div>{downloadError && <Alert type="error" title={downloadError} />}<Link to="/candidate/resume"><Button block>{resume ? 'Update Resume' : 'Upload Resume'}</Button></Link></Card>
    <Card className="candidate-panel"><div className="candidate-section-heading"><h2><ApartmentOutlined /> Recent Applications</h2><Link to="/candidate/applications">View All <ArrowRightOutlined /></Link></div>{!records.length ? <p className="candidate-empty">No applications yet.</p> : records.slice(0, 3).map((item) => <Link className="candidate-application" key={item.id} to={`/candidate/applications/${item.id}`}><div><strong>{item.job.title}</strong><p>{item.job.company}</p></div><StatusLabel value={item.status} /></Link>)}</Card></aside>
  </section>;
}
