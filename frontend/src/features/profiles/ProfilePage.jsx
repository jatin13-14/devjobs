import { Fragment, useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Form, Input, InputNumber, Popconfirm, Spin, message } from 'antd';
import { CandidateSkills } from '../skills/CandidateSkills.jsx';
import { http } from '../auth/api.js';
import { apiMessage } from '../jobs/services/api.js';

const candidateFields = ['full_name', 'professional_headline', 'country', 'city', 'about', 'years_of_experience', 'current_designation', 'portfolio_url', 'github_url', 'linkedin_url'];
const recruiterFields = ['name', 'designation', 'work_email', 'phone'];
export function ProfilePage({ candidate = false, skillsOnly = false }) {
  if (skillsOnly) return <section className="container recruiter-page"><h1>My skills</h1><CandidateSkills /></section>;
  return <ProfileEditor candidate={candidate} />;
}

function ProfileEditor({ candidate }) {
  const base = candidate ? '/candidates/me' : '/recruiters/me';
  const fields = candidate ? candidateFields : recruiterFields;
  const [form] = Form.useForm();
  const [snapshot, setSnapshot] = useState({});
  const [loaded, setLoaded] = useState(false); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const profile = await http.get(`${base}/profile/`); form.setFieldsValue(profile.data); setSnapshot(profile.data); setLoaded(true); }
    catch (e) { setError(apiMessage(e)); } finally { setLoading(false); }
  }, [base, form]);
  useEffect(() => { load(); }, [load]);
  const perform = async (operation) => { setBusy(true); setError(''); try { await operation(); message.success('Changes saved'); } catch (e) { form.setFields(Object.entries(e.response?.data || {}).filter(([name]) => fields.includes(name)).map(([name, errors]) => ({ name, errors: [].concat(errors).map(String) }))); setError(apiMessage(e)); } finally { setBusy(false); } };
  return <section className="container recruiter-page"><h1>{`${candidate ? 'Candidate' : 'Recruiter'} profile`}</h1>{error && <Alert type="error" title={error} action={<Button onClick={load}>Retry</Button>} />}{loading ? <Spin /> : loaded && <><Card title="Professional details"><Form form={form} layout="vertical" disabled={busy} onFinish={(values) => perform(async () => { const { data } = await http.patch(`${base}/profile/`, values); form.setFieldsValue(data); setSnapshot(data); })}>{fields.map((name) => <Fragment key={name}>{['full_name', 'name', 'country', 'portfolio_url'].includes(name) && <h2>{({ full_name: 'Professional identity', name: 'Professional identity', country: 'Location and experience', portfolio_url: 'Your work online' })[name]}</h2>}<Form.Item name={name} label={name.replaceAll('_', ' ')} rules={[{ required: ['full_name', 'name'].includes(name) }, ...(name.endsWith('_url') ? [{ type: 'url' }] : []), ...(name === 'work_email' ? [{ type: 'email' }] : [])]}>{name === 'years_of_experience' ? <InputNumber min={0} max={80} /> : name === 'about' ? <Input.TextArea rows={5} /> : <Input maxLength={name === 'country' ? 2 : undefined} />}</Form.Item></Fragment>)}<Button type="primary" htmlType="submit" loading={busy}>Save profile</Button> <Popconfirm title="Discard unsaved profile changes?" onConfirm={() => { form.resetFields(); form.setFieldsValue(snapshot); }} okText="Discard" cancelText="Keep editing"><Button disabled={busy}>Cancel changes</Button></Popconfirm></Form></Card>{candidate && <CandidateSkills />}</>}</section>;
}
