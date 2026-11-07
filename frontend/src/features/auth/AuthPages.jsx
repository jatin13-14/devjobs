import { useState } from 'react';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { authApi } from './api.js';
import { useAuth } from './useAuth.js';

const { Title, Text } = Typography;
function messageFor(error) { return error.response?.data?.detail || 'We could not complete that request. Please try again.'; }
function fieldErrors(data) {
  if (!data || typeof data !== 'object') return [];
  return Object.entries(data).filter(([, value]) => Array.isArray(value)).map(([name, errors]) => ({ name, errors }));
}
function AuthCard({ title, subtitle, children }) {
  return <section className="auth-page"><Card className="auth-card" variant="borderless">
    <Text className="eyebrow">DEVJOBS ACCOUNT</Text><Title level={2}>{title}</Title><p className="auth-subtitle">{subtitle}</p>{children}
  </Card></section>;
}
function Passwords() {
  return <>
    <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Enter a password.' }, { min: 8, message: 'Use at least 8 characters.' }]}><Input.Password autoComplete="new-password" /></Form.Item>
    <Form.Item name="password_confirmation" label="Confirm password" dependencies={['password']} rules={[{ required: true, message: 'Confirm your password.' }, ({ getFieldValue }) => ({ validator(_, value) { return !value || getFieldValue('password') === value ? Promise.resolve() : Promise.reject(new Error('Passwords do not match.')); } })]}><Input.Password autoComplete="new-password" /></Form.Item>
  </>;
}
export function LoginPage() {
  const [form] = Form.useForm(); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const { user, login } = useAuth(); const navigate = useNavigate(); const location = useLocation();
  if (user) return <Navigate to={user.is_platform_admin ? '/admin' : user.role === 'recruiter' ? '/recruiter' : '/candidate'} replace />;
  async function submit(values) { setBusy(true); setError(''); try { const u = await login(values); navigate(location.state?.from?.pathname || (u.is_platform_admin ? '/admin' : u.role === 'recruiter' ? '/recruiter' : '/candidate'), { replace: true }); } catch (e) { setError(messageFor(e)); } finally { setBusy(false); } }
  return <AuthCard title="Welcome back" subtitle="Sign in to continue to DevJobs.">{error && <Alert role="alert" type="error" title={error} showIcon className="auth-alert" />}<Form form={form} layout="vertical" onFinish={submit} requiredMark={false}>
    <Form.Item name="email" label="Email address" rules={[{ required: true, message: 'Enter your email address.' }, { type: 'email', message: 'Enter a valid email address.' }]}><Input autoComplete="email" /></Form.Item>
    <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Enter your password.' }]}><Input.Password autoComplete="current-password" /></Form.Item>
    <Button type="primary" htmlType="submit" loading={busy} block size="large">Log in</Button>
  </Form><p className="auth-switch">New to DevJobs? <Link to="/register/candidate">Create a candidate account</Link></p><p className="auth-switch"><Link to="/register/recruiter">Recruiter registration</Link></p></AuthCard>;
}
function RegistrationPage({ recruiter = false }) {
  const [form] = Form.useForm(); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState(false);
  const navigate = useNavigate(); const [fieldIssues, setFieldIssues] = useState([]);
  async function submit(values) {
    setBusy(true); setError(''); setFieldIssues([]);
    const { password_confirmation: _confirmation, ...payload } = values;
    try { await (recruiter ? authApi.registerRecruiter(payload) : authApi.registerCandidate(payload)); setSuccess(true); }
    catch (e) { const fields = fieldErrors(e.response?.data); setFieldIssues(fields); if (fields.length) form.setFields(fields.map(({ name, errors }) => ({ name, errors }))); else setError(messageFor(e)); }
    finally { setBusy(false); }
  }
  if (success) return <AuthCard title="Account created" subtitle="Your DevJobs account is ready."><Alert type="success" title="Registration complete. Log in to continue." showIcon /><Button type="primary" block size="large" className="auth-continue" onClick={() => navigate('/login')}>Go to log in</Button></AuthCard>;
  return <AuthCard title={recruiter ? 'Create a recruiter account' : 'Join as a candidate'} subtitle={recruiter ? 'Get started with your recruiter account.' : 'Create your account to get started on DevJobs.'}>
    {error && <Alert role="alert" type="error" title={error} showIcon className="auth-alert" />}{fieldIssues.length > 0 && <Alert type="error" title="Please review the highlighted fields." showIcon className="auth-alert" />}
    <Form form={form} layout="vertical" onFinish={submit} requiredMark={false}>
      <Form.Item name={recruiter ? 'name' : 'full_name'} label="Full name" rules={[{ required: true, message: 'Enter your full name.' }, { max: 160, message: 'Use 160 characters or fewer.' }]}><Input autoComplete="name" /></Form.Item>
      <Form.Item name="email" label="Email address" rules={[{ required: true, message: 'Enter your email address.' }, { type: 'email', message: 'Enter a valid email address.' }]}><Input autoComplete="email" /></Form.Item>
      <Passwords />
      <Button type="primary" htmlType="submit" loading={busy} block size="large">Create account</Button>
    </Form><p className="auth-switch">Already have an account? <Link to="/login">Log in</Link></p>
    {!recruiter && <p className="auth-switch">Hiring? <Link to="/register/recruiter">Create a recruiter account</Link></p>}
    {recruiter && <p className="auth-switch">Looking for work? <Link to="/register/candidate">Create a candidate account</Link></p>}
  </AuthCard>;
}
export function CandidateRegistrationPage() { return <RegistrationPage />; }
export function RecruiterRegistrationPage() { return <RegistrationPage recruiter />; }
