import { useEffect, useState } from 'react';
import { Alert, Button, Card, Empty, Input, Skeleton } from 'antd';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth.js';
import { jobsApi, apiMessage } from '../services/api.js';
import { PageHeader } from '../../../components/molecules/WorkspaceUI.jsx';
export function CompanyDirectory({ applicants = false }) {
  const { user } = useAuth();
  return user?.id ? <DirectoryResults key={user.id} applicants={applicants} /> : null;
}

function DirectoryResults({ applicants }) {
  const [params, setParams] = useSearchParams();
  const search = params.get('company_search') || '';
  const page = Math.max(1, Number(params.get('company_page')) || 1);
  const key = `${page}:${search}`;
  const [state, setState] = useState({});
  const [revision, setRevision] = useState(0);
  function update(values) { setParams((previous) => { const next = new URLSearchParams(previous); Object.entries(values).forEach(([name, value]) => { if (value) next.set(name, value); else next.delete(name); }); return next; }); }
  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    setState({ key, loading: true });
    jobsApi.recruiterCompanies({ page, search, signal: controller.signal }).then((data) => { if (live) setState({ key, data }); }).catch((error) => { if (live) setState({ key, error: apiMessage(error) }); });
    return () => { live = false; controller.abort(); };
  }, [key, page, search, revision]);
  const current = state.key === key ? state : { loading: true };
  const jobQuery = (id) => { const next = new URLSearchParams(params); next.set('company', id); next.delete('company_page'); next.delete('company_search'); return `/recruiter/jobs?${next}`; };
  return <section className="container recruiter-page"><PageHeader eyebrow="HIRING WORKSPACE" title={applicants ? 'Review applicants' : 'My companies'} description={applicants ? 'Choose a company, then open a job to review its applicants.' : 'Manage your organizations and collaborate with your hiring team.'} action={!applicants && <Link to="/recruiter/companies/new"><Button type="primary">Create company</Button></Link>} /><Input.Search key={search} defaultValue={search} aria-label="Search companies" maxLength={200} onSearch={(value) => update({ company_search: value, company_page: '' })} />{current.error ? <Alert type="error" title={current.error} action={<Button onClick={() => setRevision((v) => v + 1)}>Retry</Button>} /> : current.loading ? <Skeleton active /> : <><p>{current.data.count} companies</p>{!current.data.results.length ? <Empty description={search ? 'No matching companies.' : 'You have no active company memberships yet.'} /> : <div className="dashboard-columns">{current.data.results.map((company) => <Card key={company.id} title={company.name}><p>Active membership · {company.role}</p><Link to={applicants ? jobQuery(company.id) : `/recruiter/companies/${company.id}`}>{applicants ? 'Choose job to review applicants' : 'Manage company'} →</Link><p><Link to={jobQuery(company.id)}>View job postings</Link></p></Card>)}</div>}<Button disabled={!current.data.previous} onClick={() => update({ company_page: page - 1 })}>Previous page</Button><span> Page {page} </span><Button disabled={!current.data.next} onClick={() => update({ company_page: page + 1 })}>Next page</Button></>}</section>;
}
