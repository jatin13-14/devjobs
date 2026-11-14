/* eslint-disable react-refresh/only-export-components -- Test harness exports a mount function. */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from '../../src/features/auth/AuthContext.jsx';
import { useAuth } from '../../src/features/auth/useAuth.js';

function Probe() {
  window.lifetimeContext = useAuth();
  return <p>{window.lifetimeContext.user?.id ?? 'anonymous'}</p>;
}
// Test-only entry point served by the runner-owned Vite instance.
export function mount() {
  const root = createRoot(document.getElementById('root'));
  root.render(<StrictMode><AuthProvider><Probe /></AuthProvider></StrictMode>);
  window.unmountLifetime = () => root.unmount();
}
