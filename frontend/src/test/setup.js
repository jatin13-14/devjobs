import '@testing-library/jest-dom/vitest';

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return false; },
  }),
});

// Serialized same-origin Web Locks stand-in for JSDOM. Browser coverage must use
// native navigator.locks; all independent stores in a test share this queue.
let sessionLock = Promise.resolve();
Object.defineProperty(window.navigator, 'locks', { configurable: true, value: {
  request: (_name, _options, callback) => {
    const result = sessionLock.then(callback);
    sessionLock = result.catch(() => {});
    return result;
  },
} });
