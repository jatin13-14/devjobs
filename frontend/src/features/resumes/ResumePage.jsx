import { useEffect, useState } from 'react';
import { Alert, Button, Card, Popconfirm, Spin, Upload } from 'antd';
import { useViewAuthority } from '../auth/useViewAuthority.js';
import { resumeApi, resumeError } from './api.js';

export function ResumePage() {
  const view = useViewAuthority();
  const [revision, setRevision] = useState(0);
  const [resume, setResume] = useState(null); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { let active = true; const config = view.config; const valid = () => active && view.valid() && view.config === config; setLoading(true); setError(''); resumeApi.metadata(config).then((value) => { if (valid()) setResume(value); }).catch((e) => { if (valid()) setError(resumeError(e)); }).finally(() => { if (valid()) setLoading(false); }); return () => { active = false; }; }, [revision, view]);
  async function perform(action) { if (!view.valid() || view.busy) return; const config = view.config; const valid = () => view.valid() && view.config === config; view.busy = true; setBusy(true); setError(''); try { await action(config, valid); } catch (e) { if (valid()) setError(resumeError(e)); } finally { if (valid()) { view.busy = false; setBusy(false); } } }
  if (loading) return <div className="page-state"><Spin description="Loading resume…" /></div>;
  return <section className="container applications-page"><h1>My resume</h1><Card><p>Upload a PDF (up to 5 MiB by default). Authorized company owners and admins can download your current resume through your applications. Withdrawing an application removes their access through it.</p>{error && <Alert type="error" title={error} showIcon action={<Button onClick={() => { if (view.valid()) setRevision((value) => value + 1); }}>Retry</Button>} />}
    {resume ? <p role="status">{resume.filename} · {resume.size} bytes · Updated {new Date(resume.updated_at).toLocaleString()}</p> : <p role="status">No resume uploaded.</p>}
    <div className="resume-actions"><Upload accept=".pdf,application/pdf" showUploadList={false} disabled={busy} beforeUpload={(file) => { perform(async (config, valid) => { const result = await resumeApi.upload(file, config); if (valid()) setResume(result); }); return false; }}><Button loading={busy}>{resume ? 'Replace resume' : 'Upload resume'}</Button></Upload>
    {resume && <><Button disabled={busy} onClick={() => perform((config) => resumeApi.download(config))}>Download resume</Button><Popconfirm title="Remove this resume?" description="This revokes future downloads through all your applications." okText="Remove" cancelText="Keep resume" onConfirm={() => perform(async (config, valid) => { await resumeApi.remove(config); if (valid()) setResume(null); })}><Button danger disabled={busy}>Remove resume</Button></Popconfirm></>}</div>
  </Card></section>;
}
