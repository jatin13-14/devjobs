import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Empty, Form, Input, Popconfirm, Spin } from 'antd';
import { captureRequestOwnership, http } from '../auth/api.js';
import { apiMessage } from '../jobs/services/api.js';

const base = '/candidates/me/skills/';
export function CandidateSkills() {
  const [form] = Form.useForm();
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState({ results: [], count: 0, next: null });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const current = useRef(null);
  const permit = useMemo(() => ({ live: false, busy: false, page, revision }), [page, revision]);
  useLayoutEffect(() => {
    current.current = permit;
    permit.live = true;
    return () => { permit.live = false; };
  }, [permit]);
  useEffect(() => {
    const controller = new AbortController();
    const request = { live: true };
    const valid = () => request.live && permit.live && current.current === permit;
    const assert = () => { if (!valid()) throw new Error('Skills view changed.'); };
    setLoading(true); setBusy(false); setError('');
    try {
      permit.config = { ...captureRequestOwnership(), _assertAuthority: assert, signal: controller.signal };
      http.get(base, { ...permit.config, params: { pagination: 'page', page, page_size: 20 } })
        .then(({ data: result }) => { if (valid()) setData(result); })
        .catch((e) => {
          if (!valid()) return;
          if (e.response?.status === 404 && page > 1) { permit.live = false; setPage(page - 1); }
          else setError(apiMessage(e));
        }).finally(() => { if (valid()) setLoading(false); });
    } catch (e) { if (valid()) { setError(apiMessage(e)); setLoading(false); } }
    return () => { request.live = false; controller.abort(); };
  }, [page, permit]);
  const mutate = async (operation) => {
    if (!permit.live || current.current !== permit || permit.busy || !permit.config || loading) return;
    permit.busy = true;
    setBusy(true); setError(''); form.setFields([{ name: 'name', errors: [] }]);
    try {
      await operation(permit.config);
      if (!permit.live || current.current !== permit) return;
      form.resetFields(); permit.live = false; setLoading(true); setRevision((value) => value + 1);
    } catch (e) {
      if (!permit.live || current.current !== permit) return;
      const errors = e.response?.data?.name;
      if (errors) form.setFields([{ name: 'name', errors: [].concat(errors).map(String) }]);
      else setError(apiMessage(e));
    } finally { if (permit.live && current.current === permit) { permit.busy = false; setBusy(false); } }
  };
  const switchPage = (next) => { permit.live = false; setLoading(true); setPage(next); };
  return <Card title="Skills">
    {error && <Alert type="error" title={error} action={<Button onClick={() => { permit.live = false; setLoading(true); setRevision((value) => value + 1); }}>Retry skills</Button>} />}
    {loading ? <Spin aria-label="Loading skills" /> : <>
      {!data.results.length && <Empty description="No skills added." />}
      <ul>{data.results.map((skill) => <li key={skill.id} style={{ overflowWrap: 'anywhere' }}>{skill.name} <Popconfirm title={`Remove ${skill.name}?`} okText="Remove" onConfirm={() => mutate((config) => http.delete(`${base}${skill.id}/`, config))}><Button disabled={busy} aria-label={`Remove ${skill.name}`}>Remove</Button></Popconfirm></li>)}</ul>
      <p aria-live="polite">{data.count} skills · Page {page}</p>
      <Button disabled={busy || page === 1} onClick={() => switchPage(page - 1)}>Previous skills page</Button>
      <Button disabled={busy || !data.next} onClick={() => switchPage(page + 1)}>Next skills page</Button>
    </>}
    <Form form={form} layout="vertical" disabled={loading || busy} onFinish={({ name }) => mutate((config) => http.post(base, { name }, config))}>
      <Form.Item name="name" label="Skill" rules={[{ required: true, whitespace: true }]}><Input /></Form.Item>
      <Button aria-label="Add skill" htmlType="submit" disabled={loading || busy} loading={busy}>Add skill</Button>
    </Form>
  </Card>;
}
