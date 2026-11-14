import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Card, Empty, Form, Input, Select, Spin, Popconfirm, message } from 'antd';
import { http } from '../auth/api.js';
import { useAuth } from '../auth/useAuth.js';
import { jobsApi, apiMessage } from '../jobs/services/api.js';

import { useCompanyMembership } from './useCompanyMembership.js';

const fields = ['name', 'website', 'description', 'industry', 'company_size', 'headquarters_country', 'headquarters_city'];
export function CompanyPage() {
  const { id } = useParams();
  const { user } = useAuth();
  return <CompanyEditor key={JSON.stringify([user?.id, id || 'new'])} />;
}

function CompanyEditor() {
  const { id } = useParams(); const navigate = useNavigate(); const { user } = useAuth(); const [form] = Form.useForm(); const [memberForm] = Form.useForm();
  const authorization = useCompanyMembership(id);
  const retryAuthorization = authorization.retry;
  const membership = authorization.membership;
  const canManage = authorization.canManage;
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [members, setMembers] = useState([]);
  // Commit-time guard also protects callbacks retained by forms and confirmations.
  const actions = useRef({ allowed: false });
  useLayoutEffect(() => {
    actions.current = { allowed: Boolean(user?.id && (!id || canManage)) };
    return () => { actions.current.allowed = false; };
  }, [user?.id, id, canManage]);
  const load = useCallback(() => {
    actions.current.allowed = false;
    setLoading(true); setError(''); setMembers([]); form.resetFields(); memberForm.resetFields();
    retryAuthorization();
  }, [retryAuthorization, form, memberForm]);
  useEffect(() => {
    let live = true;
    setLoading(true); setError(''); setMembers([]); form.resetFields(); memberForm.resetFields();
    if (!user?.id || authorization.loading) return () => { live = false; };
    if (authorization.status === 'error') { setLoading(false); return () => { live = false; }; }
    (async () => {
      try {
        if (id) {
          const company = await jobsApi.company(id);
          if (!live) return;
          form.setFieldsValue(company);
          if (canManage) {
            const response = await http.get(`/companies/${id}/members/`);
            if (!live) return;
            setMembers(response.data);
          }
        }
      } catch (e) { if (live) setError(apiMessage(e)); }
      finally { if (live) { setLoading(false); setBusy(false); } }
    })();
    return () => { live = false; };
  }, [id, user?.id, authorization.loading, authorization.status, membership, canManage, form, memberForm]);
  const perform = async (operation) => {
    const permit = actions.current;
    if (!permit.allowed) return;
    setBusy(true); setError('');
    try { await operation(() => permit.allowed); if (permit.allowed) message.success('Changes saved'); }
    catch (e) { if (permit.allowed) { form.setFields(Object.entries(e.response?.data || {}).filter(([key]) => fields.includes(key)).map(([name, errors]) => ({ name, errors: [].concat(errors).map(String) }))); setError(apiMessage(e)); } }
    finally { if (permit.allowed) setBusy(false); }
  };
  const changeMember = (member, changes) => perform(async (isCurrent) => { await http.patch(`/companies/${id}/members/${member.id}/`, changes); if (isCurrent()) load(); });
  return <section className="container recruiter-page"><Link to="/recruiter">Dashboard</Link><h1>{id ? 'Company details' : 'Create company'}</h1>{(error || authorization.error) && <Alert type="error" title={error || authorization.error} action={<Button onClick={load}>Retry</Button>} />}{!user?.id || loading || authorization.loading ? <Spin /> : <><Card>{membership && <p>Active membership · {membership.role}</p>}<Form form={form} layout="vertical" disabled={busy || Boolean(id && !canManage)} onFinish={(values) => perform(async (isCurrent) => { if (id) await http.patch(`/companies/${id}/`, values); else { const { data } = await http.post('/companies/', values); if (isCurrent()) navigate(`/recruiter/companies/${data.company.id}`); } })}>{fields.map((name) => <Form.Item key={name} name={name} label={name.replaceAll('_', ' ')} rules={[{ required: name === 'name' }, ...(name === 'website' ? [{ type: 'url' }] : [])]}>{name === 'description' ? <Input.TextArea rows={5} /> : <Input maxLength={name === 'headquarters_country' ? 2 : undefined} />}</Form.Item>)}{(!id || canManage) && <Button type="primary" htmlType="submit" loading={busy}>Save company</Button>}</Form></Card>{id && canManage && <Card title="Memberships">{!members.length && <Empty description="No memberships." />}{members.map((member) => { const protectedMember = member.role === 'OWNER' || member.recruiter_id === user.id; return <Card key={member.id} size="small"><p>{member.recruiter_name} · {member.role} · {member.status}</p>{!protectedMember && <><Select aria-label={`Role for ${member.recruiter_name}`} value={member.role} disabled={busy} options={['ADMIN', 'MEMBER'].map((value) => ({ value, label: value }))} onChange={(role) => changeMember(member, { role })} /><Select aria-label={`Status for ${member.recruiter_name}`} value={member.status} disabled={busy} options={['INVITED', 'ACTIVE', 'SUSPENDED'].map((value) => ({ value, label: value }))} onChange={(status) => changeMember(member, { status })} /><Popconfirm title="Remove this membership?" onConfirm={() => perform(async (isCurrent) => { await http.delete(`/companies/${id}/members/${member.id}/`); if (isCurrent()) load(); })}><Button danger disabled={busy}>Remove membership</Button></Popconfirm></>}</Card>; })}<Form form={memberForm} layout="vertical" disabled={busy} initialValues={{ role: 'MEMBER', status: 'INVITED' }} onFinish={(values) => perform(async (isCurrent) => { await http.post(`/companies/${id}/members/`, values); if (isCurrent()) load(); })}><Form.Item label="Recruiter account ID" name="recruiter_id" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="role" label="Role"><Select options={['ADMIN', 'MEMBER'].map((value) => ({ value, label: value }))} /></Form.Item><Form.Item name="status" label="Status"><Select options={['INVITED', 'ACTIVE'].map((value) => ({ value, label: value }))} /></Form.Item><Button htmlType="submit">Add membership</Button></Form></Card>}</>}</section>;
}
