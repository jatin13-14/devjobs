import { expect, it } from 'vitest';
import { parseApplicationOverview } from './recruiterOverview.js';

it('preserves server totals, terminal activity, recent order and real zero values', () => {
  const recent = [{ id: 'newer' }, { id: 'older' }];
  const result = parseApplicationOverview({ total: 25, submitted: 0, reviewing: 3, days: [{ date: '2026-11-08', count: 2 }], recent });
  expect(result.total).toBe(25);
  expect(result.submitted).toBe(0);
  expect(result.reviewing).toBe(3);
  expect(result.days[0].count).toBe(2);
  expect(result.recent).toBe(recent);
});

it('renders local calendar labels across month and DST boundaries without UTC parsing', () => {
  const dates = ['2026-02-28', '2026-03-01', '2026-03-08', '2026-11-01'];
  const result = parseApplicationOverview({ total: 0, submitted: 0, reviewing: 0, recent: [], days: dates.map((date) => ({ date, count: 0 })) });
  expect(result.days.map(({ date }) => [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours()])).toEqual([
    [2026, 2, 28, 0], [2026, 3, 1, 0], [2026, 3, 8, 0], [2026, 11, 1, 0],
  ]);
  expect(result.total).toBe(0);
  expect(result.days.map(({ count }) => count)).toEqual([0, 0, 0, 0]);
});

it('rejects malformed activity instead of displaying partial statistics', () => {
  expect(() => parseApplicationOverview({ total: 999 })).toThrow();
});
