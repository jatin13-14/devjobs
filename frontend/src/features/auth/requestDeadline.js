import axios from 'axios';

export const REQUEST_TIMEOUT = 30_000;
export const REFRESH_TIMEOUT = 10_000;

// Bound interceptor/lock queues as well as transport time. A retry keeps the
// original deadline; a shared refresh gets its own independent, bounded lifetime.
export function withRequestDeadline(config, operation, fallback = REQUEST_TIMEOUT) {
  const duration = Number.isFinite(config.timeout) && config.timeout > 0 ? config.timeout : fallback;
  const deadline = config._deadlineAt ?? Date.now() + duration;
  const controller = new AbortController();
  const source = config.signal;
  const request = { ...config, _deadlineAt: deadline, timeout: Math.max(1, deadline - Date.now()), signal: controller.signal };
  const expire = () => controller.abort(new axios.AxiosError('Request deadline exceeded', 'ECONNABORTED', request));
  const canceled = () => controller.abort(source.reason);
  source?.addEventListener('abort', canceled, { once: true });
  if (source?.aborted) canceled();
  if (deadline <= Date.now()) expire();
  const timer = setTimeout(expire, Math.max(0, deadline - Date.now()));
  let onAbort;
  const interrupted = new Promise((_, reject) => {
    onAbort = () => reject(controller.signal.reason instanceof axios.AxiosError ? controller.signal.reason : new axios.CanceledError('Request canceled', request));
    controller.signal.addEventListener('abort', onAbort, { once: true });
    if (controller.signal.aborted) onAbort();
  });
  const dispose = () => {
    clearTimeout(timer);
    source?.removeEventListener('abort', canceled);
    controller.signal.removeEventListener('abort', onAbort);
  };
  let pending;
  try {
    controller.signal.throwIfAborted();
    pending = operation(request);
  } catch (error) { pending = Promise.reject(error); }
  return Promise.race([pending, interrupted]).finally(dispose);
}
