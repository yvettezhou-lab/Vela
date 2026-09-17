import { describe, expect, it } from 'vitest';
import type { Trip } from '../core/domain';
import { generateTripContextHub } from './tripContextHubEngine';

const trip: Trip = {
  id: 'trip-1', title: 'Sabah', destination: 'Kota Kinabalu', startDate: new Date('2026-07-20').getTime(), endDate: new Date('2026-07-24').getTime(), status: 'achieve', localCurrency: 'MYR',
  members: [{ id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' }],
  accounts: [{ id: 'a1', name: 'Visa' }, { id: 'a2', name: 'Cash' }],
  categories: [{ id: 'c1', name: 'Food', type: 'expense' }, { id: 'c2', name: 'Hotel', type: 'expense' }],
  ledger: [
    { id: 'e1', entryType: 'standard', categoryId: 'c2', originalAmount: 400, originalCurrency: 'MYR', cnyEquivalent: 680, isRefund: false, isPending: false, payerId: 'p1', accountId: 'a1', allocationMode: 'equal', allocations: [], paymentDate: new Date('2026-07-20').getTime(), createdAt: 20, updatedAt: 20 },
    { id: 'e2', entryType: 'standard', categoryId: 'c1', originalAmount: 100, originalCurrency: 'MYR', cnyEquivalent: 170, isRefund: false, isPending: false, payerId: 'p2', accountId: 'a2', allocationMode: 'equal', allocations: [], paymentDate: new Date('2026-07-21').getTime(), createdAt: 30, updatedAt: 30 },
    { id: 'e3', entryType: 'standard', categoryId: 'c1', originalAmount: 20, originalCurrency: 'MYR', cnyEquivalent: 34, isRefund: true, isPending: false, payerId: 'p2', accountId: 'a2', allocationMode: 'equal', allocations: [], paymentDate: new Date('2026-07-22').getTime(), createdAt: 40, updatedAt: 40 },
  ],
  createdAt: 1, updatedAt: 1,
};

describe('generateTripContextHub', () => {
  it('derives people, used accounts, categories, history and reflection without mutation', () => {
    const before = JSON.stringify(trip);
    const result = generateTripContextHub(trip);

    expect(result.durationDays).toBe(5);
    expect(result.memberNames).toEqual(['Alice', 'Bob']);
    expect(result.accounts.map((item) => item.account)).toEqual(['Visa', 'Cash']);
    expect(result.categories).toEqual([{ category: 'Hotel', amount: 400, share: 83.33 }, { category: 'Food', amount: 80, share: 16.67 }]);
    expect(result.totalExpenditure).toEqual({ MYR: 480 });
    expect(result.averageCostPerDay).toEqual({ MYR: 96 });
    expect(result.history.map((entry) => entry.id)).toEqual(['e3', 'e2', 'e1']);
    expect(JSON.stringify(trip)).toBe(before);
  });
});
