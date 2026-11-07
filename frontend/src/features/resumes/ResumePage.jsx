import { useEffect, useState } from 'react';
import { Alert, Button, Card, Popconfirm, Spin, Upload } from 'antd';
import { resumeApi, resumeError } from './api.js';

export function ResumePage() {
  const [resume, setResume] = useState(null); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { let active = true; resumeApi.metadata().then((value) => { if (active) setResume(value); }).catch((e) => { if (active) setError(resumeError(e)); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  async function perform(action) { setBusy(true); setError(''); try { await action(); } catch (e) { setError(resumeError(e)); } finally { setBusy(false); } }
  if (loading) return <div className="page-state"><Spin description="Loading resume…" /></div>;
  return <section className="container applications-page"><h1>My resume</h1><Card><p>Upload a PDF (up to 5 MiB by default). Authorized company owners and admins can download your current resume through your applications. Withdrawing an application removes their access through it.</p>{error && <Alert type="error" title={error} showIcon />}
    {resume ? <p role="status">{resume.filename} · {resume.size} bytes · Updated {new Date(resume.updated_at).toLocaleString()}</p> : <p role="status">No resume uploaded.</p>}
    <Upload accept=".pdf,application/pdf" showUploadList={false} disabled={busy} beforeUpload={(file) => { perform(async () => setResume(await resumeApi.upload(file))); return false; }}><Button loading={busy}>{resume ? 'Replace resume' : 'Upload resume'}</Button></Upload>
    {resume && <><Button disabled={busy} onClick={() => perform(() => resumeApi.download())}>Download resume</Button><Popconfirm title="Remove this resume?" description="This revokes future downloads through all your applications." okText="Remove" cancelText="Keep resume" onConfirm={() => perform(async () => { await resumeApi.remove(); setResume(null); })}><Button danger disabled={busy}>Remove resume</Button></Popconfirm></>}
  </Card></section>;
}
