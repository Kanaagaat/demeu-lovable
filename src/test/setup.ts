import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Tests never reach a real server (a dev API on :8000 would make them flaky and call the paid AI): each test that needs the network stubs fetch.
globalThis.fetch = (() => Promise.reject(new TypeError('Network is disabled in tests'))) as typeof fetch;

afterEach(() => { cleanup(); localStorage.clear(); });
