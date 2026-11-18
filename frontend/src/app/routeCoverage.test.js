import source from './App.jsx?raw';
import { expect, it } from 'vitest';
import { routeMatrix } from '../../e2e/route-matrix.js';

it('keeps the real route configuration and browser audit matrix in sync', () => {
  const paths = [...source.matchAll(/<Route path="([^"]+)"/g)].map((match) => match[1]).filter((path) => path !== '*');
  const matrix = routeMatrix({ company: 'company', job: 'job', application: 'application' });
  expect(new Set(matrix.map((row) => row.pattern))).toEqual(new Set(paths));
  expect(paths).toHaveLength(26);
  expect(matrix.filter((row) => row.pattern === '/admin')).toHaveLength(6);
});
