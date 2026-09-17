import { describe, expect, it } from 'vitest';
import type { Trip } from '../core/domain';
import { calculateHistoricalBudgetReference } from './budgetForecastEngine';

const makeTrip = (id: string, start: string, end: string, currency: string, spend: number, status: Trip['status']): Trip => ({
  id,
  title: id,
  destination: 'Test',
  startDate: Date.parse(`${start}T00:00:00`),
  endDate: Date.parse(`${end}T00:00:00`),
  status,
  localCurrency: currency,
  members: [{ id: 'm', name: 'Me' }],
  accounts: [{ id: 'a', name: 'Cash' }],
  categories: [{ id: 'c', name: 'Other', type: 'expense' }],
  ledger: spend === 0 ? [] : [{
    id: `${id}-entry`, categoryId: 'c', originalAmount: spend, originalCurrency: currency,
    cnyEquivalent: spend, isRefund: false, isPending: false, payerId: 'm', accountId: 'a',
    allocationMode: 'equal', allocations: [{ memberId: 'm', amount: spend }],
    entryType: 'standard', paymentDate: Date.parse(`${start}T00:00:00`),
    createdAt: 1, updatedAt: 1,
  }],
  createdAt: 1,
  updatedAt: 1,
});

describe('budget forecast engine', () => {
  it('uses comparable achieved trips and multiplies historical daily averages by planned days', () => {
    const plan = makeTrip('plan', '2026-10-01', '2026-10-10', 'MYR', 0, 'planning');
    const comparableA = makeTrip('a', '2025-07-01', '2025-07-10', 'MYR', 1000, 'achieve');
    const comparableB = makeTrip('b', '2025-08-01', '2025-08-15', 'MYR', 3000, 'achieve');
    const otherCurrency = makeTrip('c', '2025-09-01', '2025-09-10', 'CNY', 999, 'achieve');

    expect(calculateHistoricalBudgetReference(plan, [comparableA, comparableB, otherCurrency])).toEqual({
      currency: 'MYR',
      comparableTripCount: 2,
      historicalDailyAverageMin: 100,
      historicalDailyAverageMax: 200,
      estimatedRangeMin: 1000,
      estimatedRangeMax: 2000,
    });
  });

  it('returns null when there are no comparable achieved trips', () => {
    const plan = makeTrip('plan', '2026-10-01', '2026-10-10', 'MYR', 0, 'planning');
    const historical = makeTrip('old', '2025-01-01', '2025-01-30', 'MYR', 3000, 'achieve');
    expect(calculateHistoricalBudgetReference(plan, [historical])).toBeNull();
  });

  it('does not mutate source trips', () => {
    const plan = makeTrip('plan', '2026-10-01', '2026-10-10', 'MYR', 0, 'planning');
    const historical = makeTrip('old', '2025-07-01', '2025-07-10', 'MYR', 1000, 'achieve');
    const before = JSON.stringify([plan, historical]);
    calculateHistoricalBudgetReference(plan, [historical]);
    expect(JSON.stringify([plan, historical])).toBe(before);
  });
});
