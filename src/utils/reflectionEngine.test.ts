import { describe, expect, it } from 'vitest';
import type { Trip } from '../core/domain';
import { calculateTravelFrequency, generateTripInsights } from './reflectionEngine';

const trip = (id: string, start: string, end: string, category = 'food', amount = 100): Trip => ({
  id,
  title: id,
  destination: 'Test',
  startDate: Date.parse(start),
  endDate: Date.parse(end),
  status: 'achieve',
  localCurrency: 'CNY',
  members: [],
  accounts: [],
  categories: [{ id: category, name: category === 'food' ? 'Food' : 'Hotel', type: 'expense' }],
  ledger: [{
    id: `${id}-entry`, categoryId: category, entryType: 'standard', paymentDate: Date.parse(start),
    originalAmount: amount, originalCurrency: 'CNY', cnyEquivalent: amount, isRefund: false,
    isPending: false, payerId: '', accountId: '', allocationMode: 'equal', allocations: [],
    createdAt: Date.parse(start), updatedAt: Date.parse(start),
  }],
  createdAt: Date.parse(start), updatedAt: Date.parse(start),
});

describe('reflection deepening', () => {
  it('derives trip expense shares without storing aggregates', () => {
    const source = trip('a', '2026-01-01', '2026-01-02', 'food', 100);
    source.ledger.push({ ...source.ledger[0], id: 'a-2', categoryId: 'hotel', originalAmount: 300, cnyEquivalent: 300 });
    source.categories.push({ id: 'hotel', name: 'Hotel', type: 'expense' });
    const insight = generateTripInsights(source);
    expect(insight.expenseStructure).toEqual([
      { category: 'Hotel', amount: 300, share: 75 },
      { category: 'Food', amount: 100, share: 25 },
    ]);
  });

  it('derives travel frequency and average gap from trip dates', () => {
    const trips = [
      trip('a', '2026-01-01', '2026-01-03'),
      trip('b', '2026-02-10', '2026-02-11'),
      trip('c', '2026-06-01', '2026-06-04'),
    ];
    expect(calculateTravelFrequency(trips, 2026)).toEqual({
      tripsPerYear: 3,
      travelDaysPerYear: 8,
      averageTripLength: 2.67,
      monthsWithTravel: 3,
      averageGapBetweenTrips: 47.5,
    });
  });

  it('returns no gap when there is fewer than two trips', () => {
    expect(calculateTravelFrequency([trip('a', '2026-01-01', '2026-01-02')], 2026).averageGapBetweenTrips).toBeNull();
  });
});
