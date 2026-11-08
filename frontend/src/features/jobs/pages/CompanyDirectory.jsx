import { useEffect, useState } from 'react';
import { Alert, Button, Card, Empty, Skeleton } from 'antd';
import { Link } from 'react-router-dom';
import { jobsApi, apiMessage } from '../services/api.js';
import { PageHeader } from '../../../components/molecules/WorkspaceUI.jsx';
export function CompanyDirectory({ applicants = false }) {
  const [companies, setCompanies] = useState(null); const [error, setError] = useState(''); const [revision, setRevision] = useState(0);
  useEffect(() => { let live = true; jobsApi.recruiterCompanies().then((data) => { if (live) setCompanies(data); }).catch((e) => { if (live) setError(apiMessage(e)); }); return () => { live = false; }; }, [revision]);
  return <section className="container recruiter-page"><PageHeader eyebrow="HIRING WORKSPACE" title={applicants ? 'Review applicants' : 'My companies'} description={applicants ? 'Choose a company, then open a job to review its applicants.' : 'Manage your organizations and collaborate with your hiring team.'} action={!applicants && <Link to="/recruiter/companies/new"><Button type="primary">Create company</Button></Link>} />{error ? <Alert type="error" title={error} action={<Button onClick={() => { setError(''); setRevision((v) => v + 1); }}>Retry</Button>} /> : !companies ? <Skeleton active /> : !companies.length ? <Empty description="You have no active company memberships yet."><Link to="/recruiter/companies/new">Create your first company</Link></Empty> : <div className="dashboard-columns">{companies.map((company) => <Card key={company.id} title={company.name}><p>Active membership · {company.role}</p><Link to={applicants ? `/recruiter/jobs?company=${company.id}` : `/recruiter/companies/${company.id}`}>{applicants ? 'Choose job to review applicants' : 'Manage company'} →</Link><p><Link to={`/recruiter/jobs?company=${company.id}`}>View job postings</Link></p></Card>)}</div>}</section>;
}
