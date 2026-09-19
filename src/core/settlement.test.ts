import { describe, expect, it } from 'vitest';
import { calculateSegmentSettlements } from './settlement';
import type { Trip } from './domain';

const trip = (overrides: Partial<Trip> = {}): Trip => ({
  id: 'trip-1',
  title: 'Hong Kong',
  status: 'achieve',
  segments: [
    { id: 'seg-hk', destinations: [{ country: 'Hong Kong', city: 'Hong Kong' }], startDate: 100, endDate: 200, primaryCurrency: 'HKD' },
    { id: 'seg-macau', destinations: [{ country: 'Macau', city: 'Macau' }], startDate: 200, endDate: 300, primaryCurrency: 'CNY' },
  ],
  members: [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
    { id: 'c', name: 'C' },
  ],
  accounts: [],
  categories: [],
  ledger: [],
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
});

describe('calculateSegmentSettlements', () => {
  it('groups paid and owed amounts by segment and payer', () => {
    const result = calculateSegmentSettlements(trip({
      ledger: [{
        id: 'e1',
        entryType: 'standard',
        paymentDate: 150,
        categoryId: 'food',
        originalAmount: 1200,
        originalCurrency: 'HKD',
        cnyEquivalent: 1080,
        isRefund: false,
        isPending: false,
        payerId: 'a',
        accountId: 'cash',
        allocationMode: 'equal',
        allocations: [
          { memberId: 'a', amount: 360 },
          { memberId: 'b', amount: 360 },
          { memberId: 'c', amount: 360 },
        ],
        createdAt: 0,
        updatedAt: 0,
      }],
    }));

    expect(result[0].label).toBe('Hong Kong');
    expect(result[0].payers[0].payerId).toBe('a');
    expect(result[0].payers[0].paidCny).toBe(1080);
    expect(result[0].payers[0].originalPaid).toEqual({ HKD: 1200 });
    expect(result[0].payers[0].debts).toEqual([
      { memberId: 'b', amountCny: 360 },
      { memberId: 'c', amountCny: 360 },
    ]);
  });

  it('prefers the later-starting segment on a boundary date', () => {
    const result = calculateSegmentSettlements(trip({
      ledger: [{
        id: 'e2',
        entryType: 'standard',
        paymentDate: 200,
        categoryId: 'hotel',
        originalAmount: 500,
        originalCurrency: 'CNY',
        cnyEquivalent: 500,
        isRefund: false,
        isPending: false,
        payerId: 'b',
        accountId: 'cash',
        allocationMode: 'equal',
        allocations: [{ memberId: 'a', amount: 250 }, { memberId: 'b', amount: 250 }],
        createdAt: 0,
        updatedAt: 0,
      }],
    }));

    expect(result[0].payers).toHaveLength(0);
    expect(result[1].payers[0].payerId).toBe('b');
    expect(result[1].payers[0].debts).toEqual([{ memberId: 'a', amountCny: 250 }]);
  });

  it('subtracts refunds from both the payer total and member debt', () => {
    const result = calculateSegmentSettlements(trip({
      segments: [{ id: 'seg-hk', destinations: [{ country: 'Hong Kong', city: 'Hong Kong' }], startDate: 100, endDate: 200, primaryCurrency: 'HKD' }],
      ledger: [{
        id: 'e3',
        entryType: 'standard',
        paymentDate: 150,
        categoryId: 'food',
        originalAmount: 100,
        originalCurrency: 'HKD',
        cnyEquivalent: 90,
        isRefund: true,
        isPending: false,
        payerId: 'a',
        accountId: 'cash',
        allocationMode: 'equal',
        allocations: [{ memberId: 'a', amount: 30 }, { memberId: 'b', amount: 30 }, { memberId: 'c', amount: 30 }],
        createdAt: 0,
        updatedAt: 0,
      }],
    }));

    expect(result[0].payers[0].paidCny).toBe(-90);
    expect(result[0].payers[0].debts).toEqual([
      { memberId: 'b', amountCny: -30 },
      { memberId: 'c', amountCny: -30 },
    ]);
  });
});
