import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Card, Empty, Form, Input, Select, Spin, Popconfirm, message } from 'antd';
import { http } from '../auth/api.js';
import { useAuth } from '../auth/useAuth.js';
import { jobsApi, apiMessage } from '../jobs/services/api.js';

const fields = ['name', 'website', 'description', 'industry', 'company_size', 'headquarters_country', 'headquarters_city'];
export function CompanyPage() {
  const { id } = useParams();
  return <CompanyEditor key={id || 'new'} />;
}

function CompanyEditor() {
  const { id } = useParams(); const navigate = useNavigate(); const { user } = useAuth(); const [form] = Form.useForm(); const [memberForm] = Form.useForm();
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [membership, setMembership] = useState(null); const [members, setMembers] = useState([]);
  const canManage = ['OWNER', 'ADMIN'].includes(membership?.role);
  const load = useCallback(async () => {
    setLoading(true); setError(''); setMembership(null); setMembers([]); form.resetFields();
    try { if (id) { const [company, companies] = await Promise.all([jobsApi.company(id), jobsApi.recruiterCompanies()]); const own = companies.find((item) => item.id === id); setMembership(own); form.setFieldsValue(company); if (['OWNER', 'ADMIN'].includes(own?.role)) setMembers((await http.get(`/companies/${id}/members/`)).data); } }
    catch (e) { setError(apiMessage(e)); } finally { setLoading(false); }
  }, [id, form]);
  useEffect(() => { load(); }, [load]);
  const perform = async (operation) => { setBusy(true); setError(''); try { await operation(); message.success('Changes saved'); } catch (e) { form.setFields(Object.entries(e.response?.data || {}).filter(([key]) => fields.includes(key)).map(([name, errors]) => ({ name, errors: [].concat(errors).map(String) }))); setError(apiMessage(e)); } finally { setBusy(false); } };
  const changeMember = (member, changes) => perform(async () => { await http.patch(`/companies/${id}/members/${member.id}/`, changes); await load(); });
  return <section className="container recruiter-page"><Link to="/recruiter">Dashboard</Link><h1>{id ? 'Company details' : 'Create company'}</h1>{error && <Alert type="error" title={error} action={<Button onClick={load}>Retry</Button>} />}{loading ? <Spin /> : <><Card>{membership && <p>Active membership · {membership.role}</p>}<Form form={form} layout="vertical" disabled={busy || Boolean(id && !canManage)} onFinish={(values) => perform(async () => { if (id) await http.patch(`/companies/${id}/`, values); else { const { data } = await http.post('/companies/', values); navigate(`/recruiter/companies/${data.company.id}`); } })}>{fields.map((name) => <Form.Item key={name} name={name} label={name.replaceAll('_', ' ')} rules={[{ required: name === 'name' }, ...(name === 'website' ? [{ type: 'url' }] : [])]}>{name === 'description' ? <Input.TextArea rows={5} /> : <Input maxLength={name === 'headquarters_country' ? 2 : undefined} />}</Form.Item>)}{(!id || canManage) && <Button type="primary" htmlType="submit" loading={busy}>Save company</Button>}</Form></Card>{id && canManage && <Card title="Memberships">{!members.length && <Empty description="No memberships." />}{members.map((member) => { const protectedMember = member.role === 'OWNER' || member.recruiter_id === user.id; return <Card key={member.id} size="small"><p>{member.recruiter_name} · {member.role} · {member.status}</p>{!protectedMember && <><Select aria-label={`Role for ${member.recruiter_name}`} value={member.role} disabled={busy} options={['ADMIN', 'MEMBER'].map((value) => ({ value, label: value }))} onChange={(role) => changeMember(member, { role })} /><Select aria-label={`Status for ${member.recruiter_name}`} value={member.status} disabled={busy} options={['INVITED', 'ACTIVE', 'SUSPENDED'].map((value) => ({ value, label: value }))} onChange={(status) => changeMember(member, { status })} /><Popconfirm title="Remove this membership?" onConfirm={() => perform(async () => { await http.delete(`/companies/${id}/members/${member.id}/`); await load(); })}><Button danger disabled={busy}>Remove membership</Button></Popconfirm></>}</Card>; })}<Form form={memberForm} layout="vertical" disabled={busy} initialValues={{ role: 'MEMBER', status: 'INVITED' }} onFinish={(values) => perform(async () => { await http.post(`/companies/${id}/members/`, values); memberForm.resetFields(); await load(); })}><Form.Item label="Recruiter account ID" name="recruiter_id" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="role" label="Role"><Select options={['ADMIN', 'MEMBER'].map((value) => ({ value, label: value }))} /></Form.Item><Form.Item name="status" label="Status"><Select options={['INVITED', 'ACTIVE'].map((value) => ({ value, label: value }))} /></Form.Item><Button htmlType="submit">Add membership</Button></Form></Card>}</>}</section>;
}
