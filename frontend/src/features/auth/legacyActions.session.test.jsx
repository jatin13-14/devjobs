import { StrictMode } from 'react';
import { message } from 'antd';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './AuthContext.jsx';
import { http, plainHttp, readAuth, writeAuth } from './api.js';
import { ProfilePage } from '../profiles/ProfilePage.jsx';
import { ResumePage } from '../resumes/ResumePage.jsx';
import { JobApplicationPage } from '../jobs/pages/JobDetailPage.jsx';

// Retain the public callbacks handed to Ant Design, including callbacks from
// dialogs/file pickers that may outlive their originating mounted view.
const retained = vi.hoisted(() => ({}));
vi.mock('../skills/CandidateSkills.jsx', () => ({ CandidateSkills: () => null }));
vi.mock('antd', async () => {
  const React = await import('react');
  const Box = ({ children }) => <div>{children}</div>;
  const Form = ({ children, onFinish }) => { retained.profile = onFinish; return <div>{children}</div>; };
  Form.useForm = () => [retained.form = React.useMemo(() => ({ setFieldsValue: vi.fn(), resetFields: vi.fn(), setFields: vi.fn() }), [])];
  Form.Item = Box;
  const Input = () => <input />; Input.TextArea = Input;
  return { Form, Input, InputNumber: Input, Card: Box, Spin: () => null, Alert: Box, Empty: Box,
    Tag: Box, message: { success: vi.fn() },
    Button: ({ children, ...props }) => <button onClick={props.onClick} type={props.htmlType}>{children}</button>,
    Popconfirm: ({ children, onConfirm, title }) => { retained[title.startsWith('Remove') ? 'remove' : 'discard'] = onConfirm; return children; },
    Upload: ({ children, beforeUpload }) => { retained.upload = beforeUpload; return children; },
  };
});
const adapter = http.defaults.adapter;
const refreshAdapter = plainHttp.defaults.adapter;
const credentials = (id) => ({ access: `${id}-access`, refresh: `${id}-refresh`, user: { id, role: 'candidate' } });
const metadata = { filename: 'private-A.pdf', size: 4, updated_at: '2026-11-16' };
const actions = ['candidate', 'recruiter', 'upload', 'remove', 'apply'];
const transitions = ['B', 'B-A', 'same-account', 'logout-login', 'remount', 'view-remount'];
afterEach(() => { cleanup(); http.defaults.adapter = adapter; plainHttp.defaults.adapter = refreshAdapter; message.success.mockClear(); localStorage.clear(); Object.keys(retained).forEach((key) => delete retained[key]); });
function content(action) {
  if (action === 'candidate' || action === 'recruiter') return <ProfilePage candidate={action === 'candidate'} />;
  if (action === 'apply') return <MemoryRouter initialEntries={['/jobs/job-A/apply']}><Routes><Route path="/jobs/:id/apply" element={<JobApplicationPage />} /></Routes></MemoryRouter>;
  return <ResumePage />;
}
async function setup(action, strict = false) {
  await writeAuth(credentials('A'));
  const sends = [];
  http.defaults.adapter = async (config) => {
    sends.push(config);
    return { config, status: 200, statusText: 'OK', headers: {}, data: config.url.includes('resume') ? { resume: metadata } : { id: 'job-A', title: 'Original job', full_name: 'Original', name: 'Original' } };
  };
  const view = render(<AuthProvider>{content(action)}</AuthProvider>, strict ? { wrapper: StrictMode } : {});
  await waitFor(() => expect(sends.some((config) => config.method === 'get')).toBe(true));
  await act(async () => {});
  if (action === 'apply') fireEvent.change(view.container.querySelector('textarea'), { target: { value: 'Private A cover letter' } });
  const callback = action === 'apply' ? view.container.querySelector('form') : retained[actions.includes(action) && ['candidate', 'recruiter'].includes(action) ? 'profile' : action];
  // React exposes the originating event handler through the rendered form props.
  const submit = action === 'apply' ? Object.entries(callback).find(([key]) => key.startsWith('__reactProps'))[1].onSubmit : callback;
  const invoke = () => action === 'apply' ? submit({ preventDefault() {} }) : submit(action === 'upload' ? new File(['private'], 'private-A.pdf', { type: 'application/pdf' }) : { full_name: 'Private A', name: 'Private A' });
  return { view, sends, invoke };
}
for (const action of actions) {
  for (const transition of transitions) {
    it(`rejects retained ${action} callback after ${transition} without replacement-account dispatch`, async () => {
      const { view, sends, invoke } = await setup(action);
      if (transition === 'view-remount') {
        view.rerender(<AuthProvider>{null}</AuthProvider>);
        view.rerender(<AuthProvider>{content(action)}</AuthProvider>);
      } else if (transition === 'remount') {
        view.unmount(); render(<AuthProvider>{content(action)}</AuthProvider>);
      } else await act(async () => {
        if (transition === 'B-A') { await writeAuth(credentials('B')); await writeAuth(credentials('A')); }
        else if (transition === 'logout-login') { await writeAuth(null); await writeAuth(credentials('B')); }
        else await writeAuth(credentials(transition === 'same-account' ? 'A' : 'B'));
      });
      await act(async () => { invoke(); });
      expect(sends.filter((config) => config.method !== 'get')).toEqual([]);
    });
  }
  it(`dispatches current ${action} payload only with originating credentials`, async () => {
    const { sends, invoke } = await setup(action);
    await act(async () => { invoke(); });
    await waitFor(() => expect(sends.filter((config) => config.method !== 'get')).toHaveLength(1));
    const request = sends.find((config) => config.method !== 'get');
    expect(request.headers.Authorization).toBe('Bearer A-access');
    if (action === 'upload') expect(request.data.get('file').name).toBe('private-A.pdf');
    else if (action === 'apply') expect(JSON.parse(request.data)).toEqual({ cover_letter: 'Private A cover letter' });
    else if (action !== 'remove') expect(JSON.parse(request.data)).toEqual({ full_name: 'Private A', name: 'Private A' });
  });
}

for (const action of actions) {
  for (const ending of ['replacement', 'view-unmount']) {
    it(`cancels queued ${action} at dispatch after ${ending}`, async () => {
      const { view, sends, invoke } = await setup(action);
      let release;
      let queued;
      const interceptor = http.interceptors.request.use(async (config) => {
        if (config.method !== 'get') { queued = config; await new Promise((resolve) => { release = resolve; }); }
        return config;
      });
      try {
        await act(async () => { invoke(); });
        await waitFor(() => expect(queued).toBeDefined());
        if (ending === 'replacement') await act(async () => { await writeAuth(credentials('B')); });
        else view.rerender(<AuthProvider>{null}</AuthProvider>);
        await act(async () => { release(); });
        expect(sends.filter((config) => config.method !== 'get')).toEqual([]);
      } finally { release?.(); http.interceptors.request.eject(interceptor); }
    });
  }
  for (const status of [200, 400, 401]) {
    it(`rejects late ${status} ${action} response without UI effects or refresh for B`, async () => {
      const { sends, invoke } = await setup(action);
      let finish;
      const original = http.defaults.adapter;
      http.defaults.adapter = (config) => config.method === 'get' ? original(config) : new Promise((resolve, reject) => {
        sends.push(config);
        finish = () => {
          const response = { config, status, statusText: 'Synthetic', headers: {}, data: { id: 'late-private-A', resume: { ...metadata, filename: 'late-private-A.pdf' }, full_name: 'late-private-A' } };
          if (status === 200) resolve(response);
          else reject({ config, response });
        };
      });
      await act(async () => { invoke(); });
      await waitFor(() => expect(finish).toBeDefined());
      const request = sends.find((config) => config.method !== 'get');
      expect(request.headers.Authorization).toBe('Bearer A-access');
      await act(async () => { await writeAuth(credentials('B')); });
      await act(async () => { finish(); });
      expect(sends.filter((config) => config.method !== 'get')).toHaveLength(1);
      expect(document.body.textContent).not.toContain('late-private-A');
      expect(document.body.textContent).not.toContain('Changes saved');
      expect(message.success).not.toHaveBeenCalled();
      expect(readAuth().user.id).toBe('B');
    });
  }
}

for (const action of actions) {
  it(`revokes ${action} while queued inside the canonical dispatch lock`, async () => {
    const { view, sends, invoke } = await setup(action);
    const locks = navigator.locks;
    const original = locks.request;
    let release;
    locks.request = (name, options, callback) => options.mode === 'shared'
      ? new Promise((resolve, reject) => { release = () => original(name, options, callback).then(resolve, reject); })
      : original(name, options, callback);
    try {
      await act(async () => { invoke(); });
      await waitFor(() => expect(release).toBeDefined());
      view.rerender(<AuthProvider>{null}</AuthProvider>);
      await act(async () => { release(); });
      expect(sends.filter((config) => config.method !== 'get')).toEqual([]);
      expect(readAuth().user.id).toBe('A');
    } finally { locks.request = original; }
  });
  for (const retire of [false, true]) {
    it(`${retire ? 'rejects retired' : 'preserves current'} ${action} authority through refresh and retry`, async () => {
      const { view, sends, invoke } = await setup(action);
      const original = http.defaults.adapter;
      let refresh;
      let attempts = 0;
      http.defaults.adapter = async (config) => {
        if (config.method === 'get') return original(config);
        sends.push(config);
        if (++attempts === 1) throw { config, response: { status: 401, data: {} } };
        return { config, status: 200, headers: {}, data: { id: 'application-A', resume: metadata } };
      };
      plainHttp.defaults.adapter = (config) => new Promise((resolve) => {
        refresh = () => resolve({ config, status: 200, data: { access: 'A-refreshed', refresh: 'A-refresh-2' } });
      });
      await act(async () => { invoke(); });
      await waitFor(() => expect(refresh).toBeDefined());
      if (retire) view.rerender(<AuthProvider>{null}</AuthProvider>);
      await act(async () => { refresh(); });
      expect(attempts).toBe(retire ? 1 : 2);
      const mutations = sends.filter((config) => config.method !== 'get');
      expect(mutations[0].headers.Authorization).toBe('Bearer A-access');
      if (!retire) {
        expect(mutations[1].headers.Authorization).toBe('Bearer A-refreshed');
        expect(mutations[1]._authPermit).toBe(mutations[0]._authPermit);
      }
      expect(readAuth().user.id).toBe('A');
    });
  }
}

for (const action of actions) {
  it(`keeps ${action} usable after Strict Mode effect replay`, async () => {
    const { sends, invoke } = await setup(action, true);
    await act(async () => { invoke(); });
    await waitFor(() => expect(sends.filter((config) => config.method !== 'get')).toHaveLength(1));
    expect(sends.find((config) => config.method !== 'get').headers.Authorization).toBe('Bearer A-access');
  });
}
for (const action of ['candidate', 'recruiter']) {
  it(`rejects retained ${action} discard confirmation after view retirement`, async () => {
    const { view } = await setup(action);
    const discard = retained.discard;
    const form = retained.form;
    view.rerender(<AuthProvider>{null}</AuthProvider>);
    form.resetFields.mockClear(); form.setFieldsValue.mockClear();
    await act(async () => { discard(); });
    expect(form.resetFields).not.toHaveBeenCalled();
    expect(form.setFieldsValue).not.toHaveBeenCalled();
  });
}
