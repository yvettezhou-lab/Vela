import { describe, expect, it } from 'vitest';
import type { LedgerEntry, Trip } from './domain';
import { buildSettlementRawRows, buildSettlementSummaryRows } from './settlementExport';

const makeEntry = (overrides: Partial<LedgerEntry> & Pick<LedgerEntry, 'id' | 'cnyEquivalent' | 'includeInCost' | 'isPending'>): LedgerEntry => ({
  id: overrides.id,
  entryType: 'standard',
  entryDirection: 'expense',
  paymentDate: Date.UTC(2026, 0, 1),
  categoryId: 'meal',
  originalAmount: overrides.cnyEquivalent,
  originalCurrency: 'CNY',
  cnyEquivalent: overrides.cnyEquivalent,
  includeInCost: overrides.includeInCost,
  isRefund: false,
  isPending: overrides.isPending,
  payerId: 'a',
  accountId: 'cash',
  allocationMode: 'equal',
  allocations: [
    { memberId: 'a', amount: overrides.cnyEquivalent / 2 },
    { memberId: 'b', amount: overrides.cnyEquivalent / 2 },
  ],
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
} as LedgerEntry);

const makeTrip = (): Trip => ({
  id: 'trip-1',
  title: 'Test Trip',
  status: 'achieve',
  segments: [],
  members: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
  accounts: [],
  categories: [{ id: 'meal', name: 'Meal', type: 'expense' }],
  ledger: [
    makeEntry({ id: 'included', cnyEquivalent: 100, includeInCost: true, isPending: false }),
    makeEntry({ id: 'excluded', cnyEquivalent: 20, includeInCost: false, isPending: false }),
    makeEntry({ id: 'pending', cnyEquivalent: 10, includeInCost: true, isPending: true }),
  ],
  lists: [],
  createdAt: 0,
  updatedAt: 0,
});

describe('settlement export', () => {
  it('exports all ledger entries and explicitly marks the statistics scope', () => {
    const rows = buildSettlementRawRows(makeTrip());

    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row['Included in Stats'])).toEqual(['Yes', 'No', 'No']);
    expect(rows[1]['Stats Exclusion Reason']).toBe('Excluded from statistics');
    expect(rows[2]['Stats Exclusion Reason']).toBe('Pending final settlement');
    expect(rows[0]['A Allocation (CNY)']).toBe(50);
    expect(rows[0]['B Allocation (CNY)']).toBe(50);
  });

  it('summarizes all allocations and the statistics-only subset separately', () => {
    const rows = buildSettlementSummaryRows(makeTrip());
    const allLedger = rows.find((row) => row[0] === 'All ledger entries');
    const included = rows.find((row) => row[0] === 'Included in statistics');
    const excluded = rows.find((row) => row[0] === 'Excluded from statistics');
    const memberA = rows.find((row) => row[0] === 'A');

    expect(allLedger).toEqual(['All ledger entries', 130, 3]);
    expect(included).toEqual(['Included in statistics', 100, 1]);
    expect(excluded).toEqual(['Excluded from statistics', 30, 2]);
    expect(memberA).toEqual(['A', 65, 50]);
  });
});
