import { useEffect, useState } from 'react';
import { Alert, Button, Select } from 'antd';
import { jobsApi, apiMessage } from '../jobs/services/api.js';

export function CompanyPicker({ selected, value, onChange }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ items: [], loading: true });
  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    setState((old) => ({ ...old, loading: true, error: '' }));
    const timer = setTimeout(() => {
      jobsApi.recruiterCompanies({ search, page, signal: controller.signal }).then((data) => {
        if (live) setState((old) => ({ items: [...new Map([...(page === 1 ? [] : old.items), ...data.results].map((item) => [item.id, item])).values()], next: data.next, loading: false }));
      }).catch((error) => { if (live) setState((old) => ({ ...old, loading: false, error: apiMessage(error) })); });
    }, search ? 300 : 0);
    return () => { live = false; clearTimeout(timer); controller.abort(); };
  }, [search, page, revision]);
  const items = [...new Map([...(selected ? [selected] : []), ...state.items].map((item) => [item.id, item])).values()];
  return <div className="recruiter-company-picker"><label>Company <Select aria-label="Company" showSearch filterOption={false} value={value || undefined} placeholder="Select a company" loading={state.loading} onSearch={(text) => { setSearch(text); setPage(1); setState({ items: [], loading: true }); }} options={items.map((item) => ({ value: item.id, label: `${item.name} · ${item.role}` }))} onChange={onChange} notFoundContent={state.loading ? 'Loading companies…' : 'No matching companies'} /></label>{state.error && <Alert type="error" title={state.error} action={<Button onClick={() => setRevision((n) => n + 1)}>Retry companies</Button>} />}{state.next && !state.error && <Button disabled={state.loading} onClick={() => setPage((n) => n + 1)}>Load more companies</Button>}</div>;
}
