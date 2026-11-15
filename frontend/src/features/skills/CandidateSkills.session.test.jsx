import { afterEach, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '../auth/AuthContext.jsx';
import { http, writeAuth } from '../auth/api.js';
import { CandidateSkills } from './CandidateSkills.jsx';
const adapter = http.defaults.adapter;
const credentials = (id) => ({ access: `${id}-access`, refresh: `${id}-refresh`, user: { id, role: 'candidate' } });
const list = { results: [{ id: 'original', name: 'original private skill' }], count: 1, next: null };
afterEach(() => { cleanup(); http.defaults.adapter = adapter; localStorage.clear(); });
for (const method of ['get', 'post', 'delete']) {
  for (const transition of ['B', 'B-A', 'same-user', 'logout', 'unmount']) {
    it(`rejects late ${method} on ${transition} and retains original dispatch ownership`, async () => {
      await writeAuth(credentials('A'));
      const pending = [];
      let hold = method === 'get';
      http.defaults.adapter = (config) => {
        const response = (data) => ({ config, status: 200, statusText: 'OK', headers: {}, data });
        if (hold) return new Promise((resolve) => pending.push({ config, resolve: (data) => resolve(response(data)) }));
        return Promise.resolve(response(list));
      };
      const view = render(<AuthProvider><CandidateSkills /></AuthProvider>);
      if (method !== 'get') {
        await screen.findByText('original private skill');
        hold = true;
        if (method === 'post') {
          fireEvent.change(screen.getByLabelText('Skill'), { target: { value: 'private payload' } });
          fireEvent.click(screen.getByRole('button', { name: 'Add skill' }));
        } else {
          fireEvent.click(screen.getByRole('button', { name: 'Remove original private skill' }));
          fireEvent.click(await screen.findByRole('button', { name: 'Remove', exact: true }));
        }
      }
      await waitFor(() => expect(pending).toHaveLength(1));
      const old = pending[0];
      expect(old.config.method).toBe(method);
      expect(old.config.headers.Authorization).toBe('Bearer A-access');
      hold = false;
      if (transition === 'unmount') view.unmount();
      else await act(async () => {
        if (transition === 'B-A') { await writeAuth(credentials('B')); await writeAuth(credentials('A')); }
        else await writeAuth(transition === 'logout' ? null : credentials(transition === 'same-user' ? 'A' : 'B'));
      });
      expect(() => old.config._assertAuthority()).toThrow();
      await act(async () => old.resolve(method === 'get' ? { ...list, results: [{ id: 'late', name: 'late private skill' }] } : { id: 'late', name: 'late private skill' }));
      expect(screen.queryByText('late private skill')).not.toBeInTheDocument();
    });
  }
}
for (const method of ['get', 'post', 'delete']) {
  it(`cancels queued ${method} before transport after session replacement`, async () => {
    await writeAuth(credentials('A'));
    let release;
    let queued = false;
    let hold = method === 'get';
    const sends = [];
    http.defaults.adapter = async (config) => {
      sends.push(config.method);
      return { config, status: 200, statusText: 'OK', headers: {}, data: list };
    };
    const interceptor = http.interceptors.request.use(async (config) => {
      if (hold && config.method === method) {
        queued = true;
        await new Promise((resolve) => { release = resolve; });
      }
      return config;
    });
    try {
      render(<AuthProvider><CandidateSkills /></AuthProvider>);
      if (method !== 'get') {
        await screen.findByText('original private skill'); hold = true;
        if (method === 'post') {
          fireEvent.change(screen.getByLabelText('Skill'), { target: { value: 'queued private payload' } });
          fireEvent.click(screen.getByRole('button', { name: 'Add skill' }));
        } else {
          fireEvent.click(screen.getByRole('button', { name: 'Remove original private skill' }));
          fireEvent.click(await screen.findByRole('button', { name: 'Remove', exact: true }));
        }
      }
      await waitFor(() => expect(queued).toBe(true));
      hold = false;
      await act(async () => { await writeAuth(credentials('B')); release(); });
      // Only B's new list request may dispatch after replacement.
      expect(sends.filter((sent) => sent === method)).toHaveLength(method === 'get' ? 1 : 0);
    } finally { release?.(); http.interceptors.request.eject(interceptor); }
  });
}
