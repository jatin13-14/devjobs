import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Empty, Form, Input, InputNumber, Spin, Tag, message } from 'antd';
import { http } from '../auth/api.js';
import { apiMessage } from '../jobs/services/api.js';

const candidateFields = ['full_name', 'professional_headline', 'country', 'city', 'about', 'years_of_experience', 'current_designation', 'portfolio_url', 'github_url', 'linkedin_url'];
const recruiterFields = ['name', 'designation', 'work_email', 'phone'];
export function ProfilePage({ candidate = false }) {
  const base = candidate ? '/candidates/me' : '/recruiters/me';
  const fields = candidate ? candidateFields : recruiterFields;
  const [form] = Form.useForm(); const [skillForm] = Form.useForm();
  const [loaded, setLoaded] = useState(false); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [skills, setSkills] = useState([]);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const [profile, list] = await Promise.all([http.get(`${base}/profile/`), candidate ? http.get(`${base}/skills/`) : Promise.resolve({ data: [] })]); form.setFieldsValue(profile.data); setSkills(list.data); setLoaded(true); }
    catch (e) { setError(apiMessage(e)); } finally { setLoading(false); }
  }, [base, candidate, form]);
  useEffect(() => { load(); }, [load]);
  const perform = async (operation) => { setBusy(true); setError(''); try { await operation(); message.success('Changes saved'); } catch (e) { form.setFields(Object.entries(e.response?.data || {}).filter(([name]) => fields.includes(name)).map(([name, errors]) => ({ name, errors: [].concat(errors).map(String) }))); setError(apiMessage(e)); } finally { setBusy(false); } };
  return <section className="container recruiter-page"><h1>{candidate ? 'Candidate' : 'Recruiter'} profile</h1>{error && <Alert type="error" title={error} action={<Button onClick={load}>Retry</Button>} />}{loading ? <Spin /> : loaded && <><Card><Form form={form} layout="vertical" disabled={busy} onFinish={(values) => perform(async () => { const { data } = await http.patch(`${base}/profile/`, values); form.setFieldsValue(data); })}>{fields.map((name) => <Form.Item key={name} name={name} label={name.replaceAll('_', ' ')} rules={[{ required: ['full_name', 'name'].includes(name) }, ...(name.endsWith('_url') ? [{ type: 'url' }] : []), ...(name === 'work_email' ? [{ type: 'email' }] : [])]}>{name === 'years_of_experience' ? <InputNumber min={0} max={80} /> : name === 'about' ? <Input.TextArea rows={5} /> : <Input maxLength={name === 'country' ? 2 : undefined} />}</Form.Item>)}<Button type="primary" htmlType="submit" loading={busy}>Save profile</Button></Form></Card>{candidate && <Card title="Skills">{!skills.length && <Empty description="No skills added." />}{skills.map((skill) => <Tag key={skill.id}>{skill.name}<Button type="text" size="small" disabled={busy} aria-label={`Remove ${skill.name}`} onClick={() => perform(async () => { await http.delete(`${base}/skills/${skill.id}/`); setSkills((items) => items.filter((item) => item.id !== skill.id)); })}>Remove</Button></Tag>)}<Form form={skillForm} layout="inline" onFinish={({ name }) => perform(async () => { const { data } = await http.post(`${base}/skills/`, { name }); setSkills((items) => [...items.filter((item) => item.id !== data.id), data]); skillForm.resetFields(); })}><Form.Item name="name" label="Skill" rules={[{ required: true, whitespace: true }]}><Input maxLength={80} /></Form.Item><Button htmlType="submit" disabled={busy}>Add skill</Button></Form></Card>}</>}</section>;
}
