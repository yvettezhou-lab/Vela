import { describe, expect, it } from 'vitest';
import { activeAccounts, activeCategories, activeMembers, referencedMasterData } from './masterData';

const ledger = [{ payerId: 'p1', accountId: 'a1', categoryId: 'c1', allocations: [{ memberId: 'p2', amount: 10 }] }] as any;

describe('master data lifecycle helpers', () => {
  it('treats missing archived as active and filters archived items', () => {
    expect(activeMembers([{ id: 'p1', name: 'Me' }, { id: 'p2', name: 'Old', archived: true }])).toHaveLength(1);
    expect(activeAccounts([{ id: 'a1', name: 'Cash' }, { id: 'a2', name: 'Old', archived: true }])).toHaveLength(1);
    expect(activeCategories([{ id: 'c1', name: 'Food', type: 'expense' }, { id: 'c2', name: 'Old', type: 'expense', archived: true }])).toHaveLength(1);
  });
  it('detects historical references without mutating the ledger', () => {
    expect(referencedMasterData(ledger, 'members', 'p1')).toBe(true);
    expect(referencedMasterData(ledger, 'members', 'p2')).toBe(true);
    expect(referencedMasterData(ledger, 'accounts', 'a1')).toBe(true);
    expect(referencedMasterData(ledger, 'categories', 'c1')).toBe(true);
    expect(referencedMasterData(ledger, 'accounts', 'a9')).toBe(false);
  });
});
