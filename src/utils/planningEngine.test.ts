import { describe, expect, it } from 'vitest';
import type { Trip } from '../core/domain';
import { calculatePlanningContext } from './planningEngine';

const makeTrip = (): Trip => ({
  id: 'planning-1',
  title: 'Sabah 2026',
  destination: 'Sabah',
  startDate: Date.parse('2026-07-20T00:00:00'),
  endDate: Date.parse('2026-07-30T00:00:00'),
  status: 'planning',
  localCurrency: 'MYR',
  members: [{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }],
  accounts: [],
  categories: [],
  ledger: [],
  createdAt: Date.parse('2026-01-01T00:00:00'),
  updatedAt: Date.parse('2026-01-01T00:00:00'),
});

describe('planning engine', () => {
  it('derives duration, entities, and currency from the existing trip', () => {
    expect(calculatePlanningContext(makeTrip())).toEqual({
      durationDays: 11,
      memberCount: 2,
      memberNames: ['Alice', 'Bob'],
      currency: 'MYR',
    });
  });

  it('does not mutate the source trip', () => {
    const source = makeTrip();
    const before = JSON.stringify(source);
    calculatePlanningContext(source);
    expect(JSON.stringify(source)).toBe(before);
  });
});
