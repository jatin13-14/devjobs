import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Empty, Popconfirm, Spin, Tag } from 'antd';
import { Link, useParams } from 'react-router-dom';
import { apiMessage, jobsApi } from '../services/api.js';
import { canWithdraw, formatJobDate, labelFor } from '../utils/format.js';

function StatusTag({ status }) { return <Tag color={{ SUBMITTED: 'blue', REVIEWING: 'gold', SHORTLISTED: 'green', REJECTED: 'red', WITHDRAWN: 'default' }[status]}>{labelFor(status)}</Tag>; }
export function ApplicationsPage() {
  const [data, setData] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => { setLoading(true); setError(''); try { setData(await jobsApi.applications()); } catch (e) { setError(apiMessage(e)); } finally { setLoading(false); } }, []);
  useEffect(() => { refresh(); }, [refresh]);
  if (loading) return <div className="page-state"><Spin description="Loading applications…" /></div>;
  return <section className="container applications-page"><p className="eyebrow">YOUR JOB SEARCH</p><h1>My applications</h1>{error && <Alert type="error" showIcon title={error} action={<Button type="link" onClick={refresh}>Retry</Button>} />}{!error && !data?.results?.length && <Empty description="You haven’t applied to any jobs yet."><Link to="/">Browse jobs</Link></Empty>}
    <div className="application-list">{data?.results?.map((application) => <Card key={application.id} className="application-card"><div><Link to={`/candidate/applications/${application.id}`}><h2>{application.job.title}</h2></Link><p className="company-name">{application.job.company}</p><p className="job-meta">Applied {formatJobDate(application.applied_at)}</p></div><StatusTag status={application.status} />{canWithdraw(application.status) && <Popconfirm title="Withdraw this application?" description="This action cannot be undone." okText="Withdraw" cancelText="Keep application" onConfirm={async () => { try { await jobsApi.withdraw(application.id); await refresh(); } catch (e) { setError(apiMessage(e)); } }}><Button danger>Withdraw</Button></Popconfirm>}</Card>)}</div>
  </section>;
}

export function ApplicationDetailPage() {
  const { applicationId } = useParams(); const [application, setApplication] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => { setLoading(true); try { setApplication(await jobsApi.application(applicationId)); setError(''); } catch (e) { setError(apiMessage(e)); } finally { setLoading(false); } }, [applicationId]);
  useEffect(() => { refresh(); }, [refresh]);
  if (loading) return <div className="page-state"><Spin description="Loading application…" /></div>;
  if (error || !application) return <section className="container page-state"><Alert type="error" showIcon title={error || 'Application could not be loaded.'} /><Link to="/candidate/applications">Back to applications</Link></section>;
  const withdraw = async () => { try { await jobsApi.withdraw(applicationId); await refresh(); } catch (e) { setError(apiMessage(e)); } };
  return <section className="container application-detail"><Link to="/candidate/applications">← My applications</Link><Card><p className="eyebrow">APPLICATION DETAIL</p><h1>{application.job.title}</h1><p className="company-name">{application.job.company}</p><p>Status: <StatusTag status={application.status} /></p><p>Submitted {formatJobDate(application.applied_at)}</p>{application.cover_letter && <section><h2>Cover letter</h2><p className="cover-letter-text">{application.cover_letter}</p></section>}{canWithdraw(application.status) && <Popconfirm title="Withdraw this application?" description="This action cannot be undone." okText="Withdraw" onConfirm={withdraw}><Button danger>Withdraw application</Button></Popconfirm>}</Card></section>;
}
