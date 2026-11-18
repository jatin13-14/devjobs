// Test-only Vite middleware server; the runner passes an already bound socket.
import http from 'node:http';
import { createHmac } from 'node:crypto';
import { createServer } from 'vite';

if (process.env.DEVJOBS_E2E !== '1' || !process.env.E2E_READY_TOKEN) throw new Error('Owned E2E environment required');
// The runner's exec helper clears inherited signal masks before Node starts.
const server = http.createServer((request, response) => {
  if (request.url === '/__e2e_ready__') {
    const challenge = request.headers['x-e2e-challenge'];
    if (!/^[a-f0-9]{64}$/.test(challenge || '')) { response.writeHead(404).end(); return; }
    const run = process.env.E2E_RUN_ID;
    const signature = createHmac('sha256', process.env.E2E_READY_TOKEN).update(`${run}:frontend:${process.pid}:${challenge}`).digest('hex');
    response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify({ run, role: 'frontend', pid: process.pid, signature }));
    return;
  }
  vite.middlewares(request, response);
});
// Vite 6 creates a websocket listener even with hmr:false in middleware mode.
// Attach it to the same inherited HTTP socket so no default 24678 port is used.
const vite = await createServer({
  cacheDir: `${process.env.E2E_ARTIFACT_ROOT}/vite`,
  server: { middlewareMode: true, hmr: { server, host: '127.0.0.1', clientPort: Number(new URL(process.env.E2E_FRONTEND_URL).port) } },
  appType: 'spa',
});
server.listen({ fd: Number(process.env.E2E_LISTEN_FD) });
