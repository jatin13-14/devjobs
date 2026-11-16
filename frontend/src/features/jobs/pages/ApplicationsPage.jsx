import { useCallback, useState } from 'react';
import { Alert, Button, Card, Empty, Pagination, Popconfirm, Spin, Tag } from 'antd';
import { Link, useParams } from 'react-router-dom';
import { jobsApi } from '../services/api.js';
import { useApplicationResource } from '../useApplicationResource.js';
import { canWithdraw, formatJobDate, labelFor } from '../utils/format.js';

function StatusTag({ status }) { return <Tag color={{ SUBMITTED: 'blue', REVIEWING: 'gold', SHORTLISTED: 'green', REJECTED: 'red', WITHDRAWN: 'default' }[status]}>{labelFor(status)}</Tag>; }
export function ApplicationsPage() {
  const [page, setPage] = useState(1);
  const load = useCallback((config) => jobsApi.applications({ page }, config), [page]);
  const { data, error, loading, refresh, withdraw } = useApplicationResource(page, load);
  if (loading) return <div className="page-state"><Spin description="Loading applications…" /></div>;
  return <section className="container applications-page"><p className="eyebrow">YOUR JOB SEARCH</p><h1>My applications</h1>{error && <Alert type="error" showIcon title={error} action={<Button type="link" onClick={refresh}>Retry</Button>} />}{!error && !data?.results?.length && <Empty description="You haven’t applied to any jobs yet."><Link to="/">Browse jobs</Link></Empty>}
    <div className="application-list">{data?.results?.map((application) => <Card key={application.id} className="application-card"><div><Link to={`/candidate/applications/${application.id}`}><h2>{application.job.title}</h2></Link><p className="company-name">{application.job.company}</p><p className="job-meta">Applied {formatJobDate(application.applied_at)}</p></div><StatusTag status={application.status} />{canWithdraw(application.status) && <Popconfirm title="Withdraw this application?" description="This action cannot be undone." okText="Withdraw" cancelText="Keep application" onConfirm={() => withdraw(application.id)}><Button danger>Withdraw</Button></Popconfirm>}</Card>)}</div><Pagination current={page} pageSize={20} total={data?.count || 0} showSizeChanger={false} onChange={setPage} hideOnSinglePage />
  </section>;
}

export function ApplicationDetailPage() {
  const { applicationId } = useParams();
  const load = useCallback((config) => jobsApi.application(applicationId, config), [applicationId]);
  const { data: application, error, loading, refresh, withdraw } = useApplicationResource(applicationId, load);
  if (loading) return <div className="page-state"><Spin description="Loading application…" /></div>;
  if (error || !application) return <section className="container page-state"><Alert type="error" showIcon title={error || 'Application could not be loaded.'} action={<Button onClick={refresh}>Retry</Button>} /><Link to="/candidate/applications">Back to applications</Link></section>;
  return <section className="container application-detail"><Link to="/candidate/applications">← My applications</Link><Card><p className="eyebrow">APPLICATION DETAIL</p><h1>{application.job.title}</h1><p className="company-name">{application.job.company}</p><p>Status: <StatusTag status={application.status} /></p><p>Submitted {formatJobDate(application.applied_at)}</p>{application.cover_letter && <section><h2>Cover letter</h2><p className="cover-letter-text">{application.cover_letter}</p></section>}{canWithdraw(application.status) && <Popconfirm title="Withdraw this application?" description="This action cannot be undone." okText="Withdraw" onConfirm={() => withdraw(applicationId)}><Button danger>Withdraw application</Button></Popconfirm>}</Card></section>;
}
