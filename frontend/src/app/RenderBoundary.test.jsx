import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RenderBoundary } from './RenderBoundary.jsx';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('contains rendering failures, preserves diagnostics and retries without exposing the error payload', () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  let failed = true;
  function Child() { if (failed) throw new Error('Synthetic private payload'); return <h1>Recovered page</h1>; }
  render(<RenderBoundary><Child /></RenderBoundary>);
  expect(screen.getByRole('alert')).toHaveTextContent('This page could not be displayed');
  expect(screen.queryByText('Synthetic private payload')).not.toBeInTheDocument();
  expect(log).toHaveBeenCalledWith('DevJobs rendering failed', expect.objectContaining({ name: 'Error', componentStack: expect.stringContaining('Child') }));
  failed = false;
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(screen.getByRole('heading', { name: 'Recovered page' })).toBeInTheDocument();
});
it('clears a failed boundary when its navigation/session key changes', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  function Crash() { throw new Error('Synthetic'); }
  const view = render(<RenderBoundary key="old"><Crash /></RenderBoundary>);
  expect(screen.getByRole('alert')).toBeVisible();
  view.rerender(<RenderBoundary key="new"><h1>Other route</h1></RenderBoundary>);
  expect(screen.getByRole('heading', { name: 'Other route' })).toBeVisible();
});
