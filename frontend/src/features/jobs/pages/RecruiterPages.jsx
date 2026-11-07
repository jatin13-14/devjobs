import { resumeApi, resumeError } from '../../resumes/api.js';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  const chooseCompany = useCallback((value) => setParams(value ? { company: value } : {}), [setParams]);
  return { companyId, chooseCompany };
}
function CompanyPicker({ companies, value, onChange }) {
  return <label className="recruiter-company-picker">Company <Select aria-label="Company" value={value || undefined} placeholder="Select a company" options={companies.map((item) => ({ value: item.id, label: `${item.name} · ${item.role}` }))} onChange={onChange} /> </label>;
}
function useCompanyMembership(companyId) {
  const { user } = useAuth(); const [result, setResult] = useState({ companyId: '', membership: null }); const [loading, setLoading] = useState(true);
  useEffect(() => { let current = true; setLoading(true); if (!companyId || !user?.id) { setResult({ companyId, membership: null }); setLoading(false); return () => { current = false; }; } jobsApi.recruiterCompanies().then((items) => { if (current) setResult({ companyId, membership: items.find((item) => item.id === companyId) || null }); }).catch(() => { if (current) setResult({ companyId, membership: null }); }).finally(() => { if (current) setLoading(false); }); return () => { current = false; }; }, [companyId, user?.id]);
  const membership = result.companyId === companyId ? result.membership : null;
  return { membership, canManage: ['OWNER', 'ADMIN'].includes(membership?.role), loading };
}

export function RecruiterDashboardPage() {
  const { user } = useAuth(); const { companyId, chooseCompany } = useCompany();
  const [profile, setProfile] = useState(null); const [companies, setCompanies] = useState([]); const [jobs, setJobs] = useState([]); const [jobsCompanyId, setJobsCompanyId] = useState(''); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const requestId = useRef(0);
  const selected = companies.find((item) => item.id === companyId);
  const refresh = useCallback(async () => { const request = ++requestId.current; setLoading(true); setError(''); setJobs([]); setJobsCompanyId(''); try { const [p, list] = await Promise.all([jobsApi.recruiterProfile(), jobsApi.recruiterCompanies()]); if (request !== requestId.current) return; setProfile(p); setCompanies(list); const selectedId = list.length === 1 ? list[0].id : (list.some((item) => item.id === companyId) ? companyId : ''); if (selectedId !== companyId) chooseCompany(selectedId); if (selectedId) { let j = await jobsApi.companyJobs(selectedId); const all = [...(j.results || [])]; let page = 1; while (j.next) { j = await jobsApi.companyJobs(selectedId, { page: ++page }); if (request !== requestId.current) return; all.push(...(j.results || [])); } if (request !== requestId.current) return; setJobs(all); setJobsCompanyId(selectedId); } } catch (e) { if (request === requestId.current) setError(apiMessage(e)); } finally { if (request === requestId.current) setLoading(false); } }, [companyId, chooseCompany]);
  useEffect(() => { refresh(); }, [refresh, user?.id]);
  if (loading) return <div className="page-state"><Spin description="Loading recruiter workspace…" /></div>;
  return <Page><p className="eyebrow">RECRUITER WORKSPACE</p><h1>Welcome{profile?.name ? `, ${profile.name}` : ''}</h1><p className="company-name">Signed in as {user?.email}</p><LoadError error={error} retry={refresh} />
    {!error && companies.length === 0 && <Card><Empty description="You have no active company memberships yet." /></Card>}
    {companies.length > 1 && <CompanyPicker companies={companies} value={companyId} onChange={chooseCompany} />}
    {selected && !error && <><Card title={<Link to={`/recruiter/companies/${selected.id}`}>{selected.name}</Link>}><p>Active membership · {selected.role}</p></Card><div className="recruiter-stats">{['DRAFT', 'PUBLISHED', 'CLOSED'].map((state) => <Card key={state}><span>{statusLabel(state)}</span><strong>{(jobsCompanyId === selected.id ? jobs : []).filter((job) => job.status === state).length}</strong></Card>)}</div><div className="recruiter-actions"><Link to={`/recruiter/jobs?company=${companyId}`}>Company jobs</Link>{['OWNER', 'ADMIN'].includes(selected.role) && <Link to={`/recruiter/jobs/new?company=${companyId}`}>Create job</Link>}</div>{jobsCompanyId === selected.id && jobs.length === 0 && <Empty description="No company jobs yet." />}</>}
  </Page>;
}

export function CompanyJobsPage() {
  const { companyId } = useCompany();
  return <CompanyJobsList key={companyId} />;
}

function CompanyJobsList() {
  const [page, setPage] = useState(1); const [status, setStatus] = useState(''); const [pagination, setPagination] = useState({});
  const { companyId } = useCompany(); const { canManage } = useCompanyMembership(companyId); const [jobs, setJobs] = useState([]); const [jobsCompanyId, setJobsCompanyId] = useState(''); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const requestId = useRef(0);
  const refresh = useCallback(async () => { const request = ++requestId.current; setJobs([]); setJobsCompanyId(''); if (!companyId) { setError('A company ID is required to load jobs.'); setLoading(false); return; } setLoading(true); setError(''); try { const result = await jobsApi.companyJobs(companyId, { page, status: status || undefined }); if (request !== requestId.current) return; setJobs(result.results || []); setPagination(result); setJobsCompanyId(companyId); } catch (e) { if (request === requestId.current) setError(apiMessage(e)); } finally { if (request === requestId.current) setLoading(false); } }, [companyId, page, status]);
  useEffect(() => { refresh(); }, [refresh]);
  if (loading) return <div className="page-state"><Spin description="Loading company jobs…" /></div>;
  const currentJobs = jobsCompanyId === companyId ? jobs : [];
  return <Page><Link to={`/recruiter?company=${companyId}`}>← Dashboard</Link><div className="recruiter-heading"><div><p className="eyebrow">COMPANY JOBS</p><h1>Company jobs</h1><Select aria-label="Job status" value={status} options={[{ value: '', label: 'All statuses' }, ...['DRAFT', 'PUBLISHED', 'CLOSED'].map((value) => ({ value, label: value }))]} onChange={(value) => { setPage(1); setStatus(value); }} /></div>{companyId && canManage && <Link to={`/recruiter/jobs/new?company=${companyId}`}><Button type="primary">Create job</Button></Link>}</div><LoadError error={error} retry={refresh} />{!error && jobsCompanyId === companyId && currentJobs.length === 0 && <Empty description="No jobs found." />}{currentJobs.map((job) => <Card key={job.id} className="recruiter-job"><div><Link to={`/recruiter/jobs/${job.id}?company=${companyId}`}><h2>{job.title}</h2></Link><p>{job.location || 'Location not specified'} · {statusLabel(job.status)}</p></div>{canManage && <Link to={`/recruiter/jobs/${job.id}/applicants?company=${companyId}`}>Applicants</Link>}<Tag>{statusLabel(job.status)}</Tag></Card>)}<Button disabled={loading || !pagination.previous} onClick={() => setPage((value) => value - 1)}>Previous page</Button><span> Page {page} </span><Button disabled={loading || !pagination.next} onClick={() => setPage((value) => value + 1)}>Next page</Button></Page>;
}

export function JobEditorPage() {
  const { id } = useParams(); const [params] = useSearchParams(); const companyId = params.get('company'); const { canManage } = useCompanyMembership(companyId); const navigate = useNavigate(); const [form] = Form.useForm(); const [loading, setLoading] = useState(Boolean(id)); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  useEffect(() => { if (!id) return; const load = async () => { if (companyId) { return jobsApi.companyJob(companyId, id); } return jobsApi.detail(id); }; load().then((job) => { const values = { ...job, skills: job.skills || [], application_deadline: job.application_deadline || undefined }; form.setFieldsValue(values); }).catch((e) => setError(e.message || apiMessage(e))).finally(() => setLoading(false)); }, [id, companyId, form]);
  const submit = async (values) => { setSaving(true); setError(''); try { const payload = { ...values, ...(companyId && !id ? { company_id: companyId } : {}) }; const job = id ? await jobsApi.updateJob(id, payload) : await jobsApi.createJob(payload); message.success(id ? 'Job updated' : 'Job created'); navigate(`/recruiter/jobs/${job.id}?company=${companyId || ''}`); } catch (e) { const fields = e.response?.data; if (fields && typeof fields === 'object') { const errors = Object.entries(fields).filter(([key, value]) => jobFields.includes(key) && value).map(([name, value]) => ({ name, errors: Array.isArray(value) ? value.map(String) : [String(value)] })); form.setFields(errors); } setError(apiMessage(e)); } finally { setSaving(false); } };
  if (loading) return <div className="page-state"><Spin /></div>;
  if (!canManage) return <Page><LoadError error={error || 'Job management requires an active OWNER or ADMIN membership.'} /></Page>;
  return <Page><Link to={`/recruiter/jobs?company=${companyId || ''}`}>← Company jobs</Link><p className="eyebrow">{id ? 'EDIT JOB' : 'NEW JOB'}</p><h1>{id ? 'Edit job' : 'Create a job'}</h1><LoadError error={error} /><Card><Form form={form} layout="vertical" onFinish={submit} disabled={saving}><Form.Item name="title" label="Job title" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="description" label="Description" rules={[{ required: true }]}><Input.TextArea rows={8} /></Form.Item>{['employment_type', 'workplace_type', 'experience_level'].map((field) => <Form.Item key={field} name={field} label={field.replaceAll('_', ' ')} rules={[{ required: true }]}><Select options={options[field].map((value) => ({ value, label: value.replaceAll('_', ' ') }))} /></Form.Item>)}<Form.Item name="location" label="Location"><Input /></Form.Item><Form.Item name="country" label="Country code"><Input maxLength={2} /></Form.Item><Form.Item name="skills" label="Required skills"><Select mode="tags" /></Form.Item><div className="recruiter-form-grid"><Form.Item name="salary_min" label="Salary minimum"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item><Form.Item name="salary_max" label="Salary maximum"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item><Form.Item name="salary_currency" label="Currency"><Input maxLength={3} /></Form.Item><Form.Item name="application_deadline" label="Application deadline"><Input type="date" /></Form.Item></div><Button htmlType="submit" type="primary" loading={saving}>{id ? 'Save changes' : 'Create draft'}</Button></Form></Card></Page>;
}

export function RecruiterJobDetailPage() {
  const { id } = useParams(); const [params] = useSearchParams(); const companyId = params.get('company'); const { canManage } = useCompanyMembership(companyId); const navigate = useNavigate(); const [job, setJob] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => { setLoading(true); setError(''); setJob(null); try { if (!companyId) throw new Error('Select a company to view its job details.'); setJob(await jobsApi.companyJob(companyId, id)); } catch (e) { setError(e.message || apiMessage(e)); } finally { setLoading(false); } }, [id, companyId]); useEffect(() => { refresh(); }, [refresh]);
  const transition = async (action) => { setBusy(true); setError(''); try { setJob(await jobsApi[action](id)); message.success(`Job ${action === 'publishJob' ? 'published' : 'closed'}`); } catch (e) { setError(apiMessage(e)); } finally { setBusy(false); } };
  if (loading) return <div className="page-state"><Spin /></div>; if (error && !job) return <Page><LoadError error={error} retry={refresh} /></Page>;
  return <Page><Link to={`/recruiter/jobs?company=${companyId || ''}`}>← Company jobs</Link><Card><p className="eyebrow">JOB PREVIEW · {statusLabel(job.status)}</p><h1>{job.title}</h1><p>{job.company?.name} · {[job.location, job.country, job.workplace_type, job.employment_type].filter(Boolean).join(' · ')}</p><p className="job-description">{job.description}</p><p>{(job.skills || []).map((skill) => <Tag key={skill}>{skill}</Tag>)}</p>{error && <LoadError error={error} />}<div className="recruiter-actions">{canManage && <><Button onClick={() => navigate(`/recruiter/jobs/${id}/edit?company=${companyId}`)}>Edit</Button>{job.status !== 'CLOSED' && job.status !== 'PUBLISHED' && <Popconfirm title="Publish this job?" onConfirm={() => transition('publishJob')}><Button type="primary" loading={busy}>Publish</Button></Popconfirm>}{job.status !== 'CLOSED' && <Popconfirm title="Close this job? Applicants will no longer be accepted." onConfirm={() => transition('closeJob')}><Button danger loading={busy}>Close job</Button></Popconfirm>}<Link to={`/recruiter/jobs/${id}/applicants?company=${companyId}`}>Applicants</Link></>}</div></Card></Page>;
}

export function RecruiterApplicantsPage() {
  const { id: jobId } = useParams(); const [params] = useSearchParams(); const companyId = params.get('company'); const [data, setData] = useState(null); const [error, setError] = useState(''); const [page, setPage] = useState(1); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState('');
  const refresh = useCallback(async () => { setLoading(true); setError(''); try { setData(await jobsApi.recruiterApplications(jobId, page)); } catch (e) { setError(apiMessage(e)); } finally { setLoading(false); } }, [jobId, page]); useEffect(() => { refresh(); }, [refresh]);
  async function update(applicationId, status) { setBusy(applicationId); setError(''); try { await jobsApi.updateApplicationStatus(jobId, applicationId, status); message.success('Application status updated'); await refresh(); } catch (e) { setError(apiMessage(e)); } finally { setBusy(''); } }
  if (loading) return <div className="page-state"><Spin description="Loading applicants…" /></div>;
  return <Page><Link to={`/recruiter/jobs/${jobId}?company=${companyId || ''}`}>← Job details</Link><p className="eyebrow">APPLICANTS</p><h1>Applicants</h1><LoadError error={error} retry={refresh} />{!error && !(data?.results || []).length && <Empty description="No applicants yet." />}{(data?.results || []).map((app) => <Card key={app.id} className="recruiter-applicant"><div><Link to={`/recruiter/jobs/${jobId}/applicants/${app.id}?company=${companyId || ''}`}><h2>{app.candidate.full_name}</h2></Link><p>{[app.candidate.professional_headline, app.candidate.current_designation, app.candidate.city, app.candidate.country].filter(Boolean).join(' · ')}</p><p>{(app.candidate.skills || []).map((skill) => <Tag key={skill}>{skill}</Tag>)}</p></div><Tag>{app.status}</Tag><Select aria-label={`Update status for ${app.candidate.full_name}`} value={null} placeholder="Update status" loading={busy === app.id} disabled={!transitions[app.status]} options={(transitions[app.status] || []).map((value) => ({ value, label: value }))} onChange={(value) => update(app.id, value)} /></Card>)}{data?.next && <Button onClick={() => setPage((n) => n + 1)}>Next page</Button>}{page > 1 && <Button onClick={() => setPage((n) => n - 1)}>Previous page</Button>}</Page>;
}

export function RecruiterApplicantDetailPage() {
  const { id: jobId, applicationId } = useParams(); const [params] = useSearchParams(); const companyId = params.get('company'); const [application, setApplication] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => { setLoading(true); setError(''); try { setApplication(await jobsApi.recruiterApplication(jobId, applicationId)); } catch (e) { setError(apiMessage(e)); } finally { setLoading(false); } }, [jobId, applicationId]); useEffect(() => { refresh(); }, [refresh]);
  if (loading) return <div className="page-state"><Spin /></div>; if (!application) return <Page><LoadError error={error} retry={refresh} /></Page>; const candidate = application.candidate;
  return <Page><Link to={`/recruiter/jobs/${jobId}/applicants?company=${companyId || ''}`}>← Applicants</Link><Card><p className="eyebrow">APPLICANT DETAIL</p><h1>{candidate.full_name}</h1>{error && <LoadError error={error} />}{application.resume_available ? <Button onClick={async () => { setError(''); try { await resumeApi.applicantDownload(jobId, applicationId); } catch (e) { setError(resumeError(e)); } }}>Download resume</Button> : <p>Resume unavailable.</p>}<p>{application.status}</p><p>{[candidate.professional_headline, candidate.current_designation, candidate.city, candidate.country].filter(Boolean).join(' · ')}</p><p>{candidate.years_of_experience ?? 'Experience not specified'} years of experience</p><h2>Skills</h2>{(candidate.skills || []).map((skill) => <Tag key={skill}>{skill}</Tag>)}{application.cover_letter && <><h2>Cover letter</h2><p className="cover-letter-text">{application.cover_letter}</p></>}</Card></Page>;
}
