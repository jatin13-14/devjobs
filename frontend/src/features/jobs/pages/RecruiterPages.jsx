import { useCompanyMembership } from '../../companies/useCompanyMembership.js';
import { CompanyPicker } from '../../companies/CompanyPicker.jsx';
import { RecruiterOverview } from '../components/RecruiterOverview.jsx';
import { CompanyDirectory } from './CompanyDirectory.jsx';
import { resumeApi, resumeError } from '../../resumes/api.js';
import { createElement, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Empty, Form, Input, InputNumber, Select, Spin, Tag, Popconfirm, message } from 'antd';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { jobsApi, apiMessage } from '../services/api.js';
import { useAuth } from '../../auth/useAuth.js';

const statusLabel = (status) => ({ DRAFT: 'Draft', PUBLISHED: 'Published', CLOSED: 'Closed' }[status] || status);
const transitions = { SUBMITTED: ['REVIEWING', 'SHORTLISTED', 'REJECTED'], REVIEWING: ['SHORTLISTED', 'REJECTED'], SHORTLISTED: ['REJECTED'] };
const jobFields = ['title', 'description', 'employment_type', 'workplace_type', 'location', 'country', 'experience_level', 'skills', 'salary_min', 'salary_max', 'salary_currency', 'application_deadline'];
const options = {
  employment_type: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY', 'INTERNSHIP'], workplace_type: ['REMOTE', 'HYBRID', 'ON_SITE'],
  experience_level: ['ENTRY', 'MID', 'SENIOR', 'LEAD'],
};

function Page({ children }) { return <section className="container recruiter-page">{children}</section>; }
function LoadError({ error, retry }) { return error ? <Alert type="error" showIcon title={error} action={retry && <Button type="link" onClick={retry}>Retry</Button>} /> : null; }
function useCompany() {
  const [params, setParams] = useSearchParams();
  const companyId = params.get('company') || '';
  const chooseCompany = useCallback((value) => setParams((previous) => { const next = new URLSearchParams(previous); if (value) next.set('company', value); else next.delete('company'); return next; }), [setParams]);
  return { companyId, chooseCompany };
}

export function RecruiterDashboardPage() {
  const { user } = useAuth(); const { companyId, chooseCompany } = useCompany();
  const [total, setTotal] = useState(0);
  const [profile, setProfile] = useState(null); const [activeJobs, setActiveJobs] = useState(null); const [jobsCompanyId, setJobsCompanyId] = useState(''); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const requestId = useRef(0);
  const authorization = useCompanyMembership(companyId);
  const { membership: selected, error: membershipError, retry: retryMembership } = authorization;
  const refresh = useCallback(async () => { const request = ++requestId.current; setLoading(true); setError(''); setActiveJobs(null); setJobsCompanyId(''); try { const [p, list] = await Promise.all([jobsApi.recruiterProfile(), jobsApi.recruiterCompanies()]); if (request !== requestId.current) return; setProfile(p); setTotal(list.count); const exact = companyId ? await jobsApi.recruiterCompanies({ companyId }) : null; if (request !== requestId.current) return; const selectedId = companyId ? (exact.results[0]?.id || '') : list.count === 1 ? list.results[0].id : ''; if (selectedId !== companyId) chooseCompany(selectedId); if (selectedId) { const result = await jobsApi.companyJobs(selectedId, { page: 1, page_size: 1, status: 'PUBLISHED' }); if (request !== requestId.current) return; setActiveJobs(result.count); setJobsCompanyId(selectedId); } } catch (e) { if (request === requestId.current) setError(apiMessage(e)); } finally { if (request === requestId.current) setLoading(false); } }, [companyId, chooseCompany]);
  useEffect(() => { refresh(); return () => { requestId.current += 1; }; }, [refresh, user?.id]);
  if (loading) return <div className="page-state"><Spin description="Loading recruiter workspace…" /></div>;
  return <><RecruiterOverview profile={profile} selected={selected} activeJobs={jobsCompanyId === selected?.id ? activeJobs : null} authorization={authorization} companyPicker={total > 1 && <CompanyPicker selected={selected} value={companyId} onChange={chooseCompany} />} error={error || membershipError} retry={membershipError ? retryMembership : refresh} />{!error && total === 0 && <Page><Empty description="You have no active company memberships yet." /></Page>}</>;
}

// Each committed identity/route/authorization owns a fresh data subtree.
// Pending or failed revalidation unmounts that subtree, including its callbacks.
function AuthorizedJobScreen({ component: Component, management = false }) {
  const { user } = useAuth();
  const { id, applicationId } = useParams();
  const [params] = useSearchParams();
  return <JobScreenAuthorization key={JSON.stringify([user?.id, id, applicationId, params.get('company'), params.get('search')])} component={Component} management={management} />;
}
function JobScreenAuthorization({ component: Component, management }) {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const authorization = useCompanyMembership(params.get('company'));
  if (!user?.id) return <Page><Empty description="Sign in to view this workspace." /></Page>;
  if (authorization.loading) return <div className="page-state"><Spin /></div>;
  if (authorization.error) return <Page><LoadError error={authorization.error} retry={authorization.retry} /></Page>;
  if (management && !authorization.canManage) return <Page><LoadError error="Job management requires an active OWNER or ADMIN membership." /></Page>;
  return createElement(Component, { authorization });
}
function useJobLifetime() {
  const lifetime = useRef(null);
  useLayoutEffect(() => {
    const permit = { live: true };
    lifetime.current = permit;
    return () => { permit.live = false; };
  }, []);
  return lifetime;
}

export function CompanyJobsPage() {
  const { companyId } = useCompany();
  return companyId ? <AuthorizedJobScreen component={CompanyJobsList} /> : <CompanyDirectory applicants />;
}

function CompanyJobsList({ authorization }) {
  const handleDenial = authorization.handleDenial;
  const [initialParams] = useSearchParams();
  const [search, setSearch] = useState(initialParams.get('search') || '');
  const [page, setPage] = useState(1); const [status, setStatus] = useState(''); const [pagination, setPagination] = useState({});
  const { companyId } = useCompany(); const { canManage, loading: membershipLoading, error: membershipError, retry: retryMembership } = authorization; const [jobs, setJobs] = useState([]); const [jobsCompanyId, setJobsCompanyId] = useState(''); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const requestId = useRef(0);
  const refresh = useCallback(async () => { const request = ++requestId.current; setJobs([]); setJobsCompanyId(''); if (!companyId) { setError('A company ID is required to load jobs.'); setLoading(false); return; } setLoading(true); setError(''); try { const result = await jobsApi.companyJobs(companyId, { page, status: status || undefined, ...(search ? { search } : {}) }); if (request !== requestId.current) return; setJobs(result.results || []); setPagination(result); setJobsCompanyId(companyId); } catch (e) { handleDenial(e); if (request === requestId.current) setError(apiMessage(e)); } finally { if (request === requestId.current) setLoading(false); } }, [companyId, page, status, search, handleDenial]);
  useEffect(() => { refresh(); return () => { requestId.current += 1; }; }, [refresh]);
  if (membershipLoading) return <div className="page-state"><Spin /></div>;
  if (membershipError) return <Page><LoadError error={membershipError} retry={retryMembership} /></Page>;
  if (loading) return <div className="page-state"><Spin description="Loading company jobs…" /></div>;
  const currentJobs = jobsCompanyId === companyId ? jobs : [];
  return <Page><Link to={`/recruiter?company=${companyId}`}>← Dashboard</Link><div className="recruiter-heading"><div><p className="eyebrow">COMPANY JOBS</p><h1>Company jobs</h1><Input.Search aria-label="Search company jobs" placeholder="Search job titles and descriptions" onSearch={(value) => { setSearch(value); setPage(1); }} /><Select aria-label="Job status" value={status} options={[{ value: '', label: 'All statuses' }, ...['DRAFT', 'PUBLISHED', 'CLOSED'].map((value) => ({ value, label: value }))]} onChange={(value) => { setPage(1); setStatus(value); }} /></div>{companyId && canManage && <Link to={`/recruiter/jobs/new?company=${companyId}`}><Button type="primary">Create job</Button></Link>}</div><LoadError error={error || membershipError} retry={membershipError ? retryMembership : refresh} />{!error && jobsCompanyId === companyId && currentJobs.length === 0 && <Empty description="No jobs found." />}{currentJobs.map((job) => <Card key={job.id} className="recruiter-job"><div><Link to={`/recruiter/jobs/${job.id}?company=${companyId}`}><h2>{job.title}</h2></Link><p>{job.location || 'Location not specified'} · {statusLabel(job.status)}</p></div>{canManage && <Link to={`/recruiter/jobs/${job.id}/applicants?company=${companyId}`}>Applicants</Link>}<Tag>{statusLabel(job.status)}</Tag></Card>)}<Button disabled={loading || !pagination.previous} onClick={() => setPage((value) => value - 1)}>Previous page</Button><span> Page {page} </span><Button disabled={loading || !pagination.next} onClick={() => setPage((value) => value + 1)}>Next page</Button></Page>;
}

export function JobEditorPage() { return <AuthorizedJobScreen component={JobEditor} management />; }
function JobEditor({ authorization }) {
  const handleDenial = authorization.handleDenial;
  const lifetime = useJobLifetime();
  const { id } = useParams(); const [params] = useSearchParams(); const companyId = params.get('company'); const { canManage, loading: membershipLoading, error: membershipError, retry: retryMembership } = authorization; const navigate = useNavigate(); const [form] = Form.useForm(); const [loading, setLoading] = useState(Boolean(id)); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  useEffect(() => { let live = true; if (!id) return; const load = async () => { if (companyId) { return jobsApi.companyJob(companyId, id); } return jobsApi.detail(id); }; load().then((job) => { if (!live) return; const values = { ...job, skills: job.skills || [], application_deadline: job.application_deadline || undefined }; form.setFieldsValue(values); }).catch((e) => { if (live) { handleDenial(e); setError(e.message || apiMessage(e)); } }).finally(() => { if (live) setLoading(false); }); return () => { live = false; }; }, [id, companyId, form, handleDenial]);
  const submit = async (values) => { const permit = lifetime.current; if (!permit?.live) return; setSaving(true); setError(''); try { const payload = { ...values, ...(companyId && !id ? { company_id: companyId } : {}) }; const job = id ? await authorization.execute((config) => jobsApi.updateJob(id, payload, config)) : await authorization.execute((config) => jobsApi.createJob(payload, config)); if (!permit.live) return; message.success(id ? 'Job updated' : 'Job created'); navigate(`/recruiter/jobs/${job.id}?company=${companyId || ''}`); } catch (e) { if (!permit.live) return; const fields = e.response?.data; if (fields && typeof fields === 'object') { const errors = Object.entries(fields).filter(([key, value]) => jobFields.includes(key) && value).map(([name, value]) => ({ name, errors: Array.isArray(value) ? value.map(String) : [String(value)] })); form.setFields(errors); } setError(apiMessage(e)); } finally { if (permit.live) setSaving(false); } };
  if (membershipLoading) return <div className="page-state"><Spin /></div>;
  if (membershipError) return <Page><LoadError error={membershipError} retry={retryMembership} /></Page>;
  if (loading) return <div className="page-state"><Spin /></div>;
  if (!canManage) return <Page><LoadError error={error || 'Job management requires an active OWNER or ADMIN membership.'} /></Page>;
  return <Page><Link to={`/recruiter/jobs?company=${companyId || ''}`}>← Company jobs</Link><p className="eyebrow">{id ? 'EDIT JOB' : 'NEW JOB'}</p><h1>{id ? 'Edit job' : 'Create a job'}</h1><LoadError error={error} /><Card><Form form={form} layout="vertical" onFinish={submit} disabled={saving}><h2>Role and responsibilities</h2><Form.Item name="title" label="Job title" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="description" label="Description" rules={[{ required: true }]}><Input.TextArea rows={8} /></Form.Item><h2>Work arrangement</h2>{['employment_type', 'workplace_type', 'experience_level'].map((field) => <Form.Item key={field} name={field} label={field.replaceAll('_', ' ')} rules={[{ required: true }]}><Select options={options[field].map((value) => ({ value, label: value.replaceAll('_', ' ') }))} /></Form.Item>)}<Form.Item name="location" label="Location"><Input /></Form.Item><Form.Item name="country" label="Country code"><Input maxLength={2} /></Form.Item><Form.Item name="skills" label="Required skills"><Select mode="tags" /></Form.Item><h2>Compensation and deadline</h2><div className="recruiter-form-grid"><Form.Item name="salary_min" label="Salary minimum"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item><Form.Item name="salary_max" label="Salary maximum"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item><Form.Item name="salary_currency" label="Currency"><Input maxLength={3} /></Form.Item><Form.Item name="application_deadline" label="Application deadline"><Input type="date" /></Form.Item></div><Button htmlType="submit" type="primary" loading={saving}>{id ? 'Save changes' : 'Create draft'}</Button></Form></Card></Page>;
}

export function RecruiterJobDetailPage() { return <AuthorizedJobScreen component={RecruiterJobDetail} />; }
function RecruiterJobDetail({ authorization }) {
  const handleDenial = authorization.handleDenial;
  const lifetime = useJobLifetime(); const requestId = useRef(0);
  const { id } = useParams(); const [params] = useSearchParams(); const companyId = params.get('company'); const { canManage, loading: membershipLoading, error: membershipError, retry: retryMembership } = authorization; const navigate = useNavigate(); const [job, setJob] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => { const request = ++requestId.current; setLoading(true); setError(''); setJob(null); try { if (!companyId) throw new Error('Select a company to view its job details.'); const result = await jobsApi.companyJob(companyId, id); if (request === requestId.current) setJob(result); } catch (e) { handleDenial(e); if (request === requestId.current) setError(e.message || apiMessage(e)); } finally { if (request === requestId.current) setLoading(false); } }, [id, companyId, handleDenial]); useEffect(() => { refresh(); return () => { requestId.current += 1; }; }, [refresh]);
  const transition = async (action) => { const permit = lifetime.current; if (!permit?.live || !canManage) return; setBusy(true); setError(''); try { const result = await authorization.execute((config) => jobsApi[action](id, config)); if (!permit.live) return; setJob(result); message.success(`Job ${action === 'publishJob' ? 'published' : 'closed'}`); } catch (e) { if (permit.live) setError(apiMessage(e)); } finally { if (permit.live) setBusy(false); } };
  if (membershipLoading) return <div className="page-state"><Spin /></div>;
  if (membershipError) return <Page><LoadError error={membershipError} retry={retryMembership} /></Page>;
  if (loading) return <div className="page-state"><Spin /></div>; if (error && !job) return <Page><LoadError error={error} retry={refresh} /></Page>;
  return <Page><Link to={`/recruiter/jobs?company=${companyId || ''}`}>← Company jobs</Link><Card><p className="eyebrow">JOB PREVIEW · {statusLabel(job.status)}</p><h1>{job.title}</h1><p>{job.company?.name} · {[job.location, job.country, job.workplace_type, job.employment_type].filter(Boolean).join(' · ')}</p><p className="job-description">{job.description}</p><p>{(job.skills || []).map((skill) => <Tag key={skill}>{skill}</Tag>)}</p>{error && <LoadError error={error} />}<div className="recruiter-actions">{canManage && <><Button onClick={() => navigate(`/recruiter/jobs/${id}/edit?company=${companyId}`)}>Edit</Button>{job.status !== 'CLOSED' && job.status !== 'PUBLISHED' && <Popconfirm title="Publish this job?" onConfirm={() => transition('publishJob')}><Button type="primary" loading={busy}>Publish</Button></Popconfirm>}{job.status !== 'CLOSED' && <Popconfirm title="Close this job? Applicants will no longer be accepted." onConfirm={() => transition('closeJob')}><Button danger loading={busy}>Close job</Button></Popconfirm>}<Link to={`/recruiter/jobs/${id}/applicants?company=${companyId}`}>Applicants</Link></>}</div></Card></Page>;
}

export function RecruiterApplicantsPage() { return <AuthorizedJobScreen component={RecruiterApplicantsPageContent} management />; }
function RecruiterApplicantsPageContent({ authorization }) {
  const lifetime = useJobLifetime(); const requestId = useRef(0);
  const execute = authorization.execute;
  const { id: jobId } = useParams(); const [params] = useSearchParams(); const companyId = params.get('company'); const [data, setData] = useState(null); const [error, setError] = useState(''); const [page, setPage] = useState(1); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState('');
  const refresh = useCallback(async () => { const request = ++requestId.current; setLoading(true); setError(''); setData(null); try { const result = await execute((config) => jobsApi.recruiterApplications(jobId, page, config)); if (request === requestId.current) setData(result); } catch (e) { if (request === requestId.current) setError(apiMessage(e)); } finally { if (request === requestId.current) setLoading(false); } }, [jobId, page, execute]); useEffect(() => { refresh(); return () => { requestId.current += 1; }; }, [refresh]);
  async function update(applicationId, status) { const permit = lifetime.current; if (!permit?.live) return; setBusy(applicationId); setError(''); try { await authorization.execute((config) => jobsApi.updateApplicationStatus(jobId, applicationId, status, config)); if (!permit.live) return; message.success('Application status updated'); await refresh(); } catch (e) { if (permit.live) setError(apiMessage(e)); } finally { if (permit.live) setBusy(''); } }
  if (loading) return <div className="page-state"><Spin description="Loading applicants…" /></div>;
  return <Page><Link to={`/recruiter/jobs/${jobId}?company=${companyId || ''}`}>← Job details</Link><p className="eyebrow">APPLICANTS</p><h1>Applicants</h1><LoadError error={error} retry={refresh} />{!error && !(data?.results || []).length && <Empty description="No applicants yet." />}{(data?.results || []).map((app) => <Card key={app.id} className="recruiter-applicant"><div><Link to={`/recruiter/jobs/${jobId}/applicants/${app.id}?company=${companyId || ''}`}><h2>{app.candidate.full_name}</h2></Link><p>{[app.candidate.professional_headline, app.candidate.current_designation, app.candidate.city, app.candidate.country].filter(Boolean).join(' · ')}</p><p>{(app.candidate.skills || []).map((skill) => <Tag key={skill}>{skill}</Tag>)}</p></div><Tag>{app.status}</Tag><Select aria-label={`Update status for ${app.candidate.full_name}`} value={null} placeholder="Update status" loading={busy === app.id} disabled={!transitions[app.status]} options={(transitions[app.status] || []).map((value) => ({ value, label: value }))} onChange={(value) => update(app.id, value)} /></Card>)}{data?.next && <Button onClick={() => setPage((n) => n + 1)}>Next page</Button>}{page > 1 && <Button onClick={() => setPage((n) => n - 1)}>Previous page</Button>}</Page>;
}

export function RecruiterApplicantDetailPage() { return <AuthorizedJobScreen component={RecruiterApplicantDetailPageContent} management />; }
function RecruiterApplicantDetailPageContent({ authorization }) {
  const lifetime = useJobLifetime(); const requestId = useRef(0);
  const execute = authorization.execute;
  const { id: jobId, applicationId } = useParams(); const [params] = useSearchParams(); const companyId = params.get('company'); const [application, setApplication] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => { const request = ++requestId.current; setLoading(true); setError(''); setApplication(null); try { const result = await execute((config) => jobsApi.recruiterApplication(jobId, applicationId, config)); if (request === requestId.current) setApplication(result); } catch (e) { if (request === requestId.current) setError(apiMessage(e)); } finally { if (request === requestId.current) setLoading(false); } }, [jobId, applicationId, execute]); useEffect(() => { refresh(); return () => { requestId.current += 1; }; }, [refresh]);
  if (loading) return <div className="page-state"><Spin /></div>; if (!application) return <Page><LoadError error={error} retry={refresh} /></Page>; const candidate = application.candidate;
  return <Page><Link to={`/recruiter/jobs/${jobId}/applicants?company=${companyId || ''}`}>← Applicants</Link><Card><p className="eyebrow">APPLICANT DETAIL</p><h1>{candidate.full_name}</h1>{error && <LoadError error={error} />}{application.resume_available ? <Button onClick={async () => { const permit = lifetime.current; if (!permit?.live) return; setError(''); try { await authorization.execute((config) => resumeApi.applicantDownload(jobId, applicationId, config)); } catch (e) { if (permit.live) setError(resumeError(e)); } }}>Download resume</Button> : <p>Resume unavailable.</p>}<p>{application.status}</p><p>{[candidate.professional_headline, candidate.current_designation, candidate.city, candidate.country].filter(Boolean).join(' · ')}</p><p>{candidate.years_of_experience ?? 'Experience not specified'} years of experience</p><h2>Skills</h2>{(candidate.skills || []).map((skill) => <Tag key={skill}>{skill}</Tag>)}{application.cover_letter && <><h2>Cover letter</h2><p className="cover-letter-text">{application.cover_letter}</p></>}</Card></Page>;
}
