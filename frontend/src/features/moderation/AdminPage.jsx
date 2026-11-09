import { useSearchParams } from 'react-router-dom';
import { PageHeader, StatusLabel } from '../../components/molecules/WorkspaceUI.jsx';
import { useEffect, useState } from 'react';
import { Alert, Button, Descriptions, Input, Modal, Select, Space, Table, Typography, message } from 'antd';
import { http } from '../auth/api.js';
import { AdminDashboard } from './AdminDashboard.jsx';
import { apiMessage } from '../jobs/services/api.js';

const kinds = ['companies', 'recruiters', 'candidates', 'jobs', 'history'];
export function AdminPage() {
  const [params, setParams] = useSearchParams();
  const kind = kinds.includes(params.get('section')) ? params.get('section') : 'dashboard';
  const setKind = (section) => setParams({ section });
  const [search, setSearch] = useState('');
  useEffect(() => { setPage(1); setSearch(params.get('q') || ''); setState(undefined); setDetail(null); }, [kind, params]);
  const [state, setState] = useState();
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ results: [], count: 0 });
  const [overview, setOverview] = useState({});
  const [overviewError, setOverviewError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let live = true;
    http.get('/admin/overview/').then(({ data: value }) => { if (live) { setOverview(value); setOverviewError(''); } }).catch((err) => { if (live) { setOverview({}); setOverviewError(apiMessage(err)); } });
    return () => { live = false; };
  }, [revision]);
  useEffect(() => {
    let live = true;
    if (kind === 'dashboard') return;
    setLoading(true);
    setError('');
    http.get(`/admin/${kind}/`, { params: { page, search, state } }).then(({ data: value }) => { if (live) setData(value); }).catch((err) => { if (live) { setError(apiMessage(err)); setData({ results: [], count: 0 }); } }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [kind, page, search, state, revision]);
  async function inspect(row) {
    try { const { data: value } = await http.get(`/admin/${kind}/${row.id}/`); setDetail(value); } catch (err) { setError(apiMessage(err)); }
  }
  async function submit() {
    setSaving(true);
    try {
      await http.post(`/admin/${kind}/${decision.id}/`, { action: decision.action, reason });
      message.success('Moderation decision recorded'); setDecision(null); setDetail(null); setReason(''); setRevision((value) => value + 1);
    } catch (err) { setError(apiMessage(err)); } finally { setSaving(false); }
  }
  const columns = kind === 'history' ? ['administrator', 'action', 'target_type', 'target_id', 'reason', 'created_at'].map((key) => ({ title: key.replaceAll('_', ' '), dataIndex: key, key, render: (value) => key === 'created_at' ? new Date(value).toLocaleString() : value })) : [
    { title: 'Name', render: (_, row) => row.title || row.name || row.email },
    { title: 'Status', render: (_, row) => <StatusLabel value={row.is_suspended || row.is_hidden || row.is_active === false ? 'Restricted' : row.status || 'Active'} /> },
    { title: 'Actions', render: (_, row) => <Space wrap><Button onClick={() => inspect(row)}>Inspect</Button><Button onClick={() => { setReason(''); setDecision({ ...row, action: kind === 'jobs' ? (row.is_hidden ? 'restore' : 'hide') : (row.is_suspended || row.is_active === false ? 'reactivate' : 'suspend') }); }}>Moderate</Button></Space> },
  ];
  if (kind === 'dashboard') return <AdminDashboard overview={overview} error={overviewError} />;
  return <section className="admin-page"><PageHeader eyebrow="PLATFORM CONTROL CENTER" title="Platform administration" description="Review records and make accountable moderation decisions." />
    <h2>{kind === 'history' ? 'Audit history' : `${kind[0].toUpperCase()}${kind.slice(1)} moderation`}</h2>
    {error && <Alert type="error" title={error} role="alert" />}
    <Space wrap><Select aria-label="Moderation resource" value={kind} options={kinds.map((value) => ({ value, label: value }))} onChange={(value) => { setKind(value); setPage(1); setDetail(null); }} />
      {kind !== 'history' && <><Input.Search key={`${kind}:${params.get('q') || ''}`} defaultValue={params.get('q') || ''} aria-label="Search moderation records" placeholder={kind === 'companies' ? 'Search company name' : kind === 'jobs' ? 'Search job title' : 'Search email'} onSearch={(value) => { setSearch(value); setPage(1); }} /><Select aria-label="Moderation state" allowClear placeholder="All states" value={state} options={['active', 'restricted'].map((value) => ({ value, label: value }))} onChange={(value) => { setState(value); setPage(1); }} /></>}
    </Space>
    <Table rowKey="id" loading={loading} dataSource={data.results} columns={columns} scroll={{ x: true }} locale={{ emptyText: 'No records found' }} pagination={{ current: page, pageSize: 20, total: data.count, onChange: setPage, showSizeChanger: false }} />
    <Modal title="Record details" open={!!detail} onCancel={() => setDetail(null)} footer={<Button onClick={() => setDetail(null)}>Close</Button>}><Descriptions column={1} items={Object.entries(detail || {}).map(([key, value]) => ({ key, label: key.replaceAll('_', ' '), children: String(value) }))} /></Modal>
    <Modal title={`Confirm ${decision?.action || 'moderation'}`} open={!!decision} onCancel={() => setDecision(null)} onOk={submit} confirmLoading={saving} okButtonProps={{ disabled: !reason.trim() }}><Typography.Paragraph>This decision is recorded in moderation history. Existing applications are retained.</Typography.Paragraph><Input.TextArea aria-label="Moderation reason" value={reason} maxLength={2000} onChange={(event) => setReason(event.target.value)} /></Modal>
  </section>;
}
