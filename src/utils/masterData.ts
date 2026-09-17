import { Account, Category, LedgerEntry, Member } from '../core/domain';

export const activeMembers = (items: Member[]) => items.filter((item) => item.archived !== true);
export const activeAccounts = (items: Account[]) => items.filter((item) => item.archived !== true);
export const activeCategories = (items: Category[]) => items.filter((item) => item.archived !== true);

export const referencedMasterData = (ledger: LedgerEntry[], type: 'members' | 'accounts' | 'categories', id: string) => {
  if (type === 'members') return ledger.some((entry) => entry.payerId === id || entry.allocations.some((allocation) => allocation.memberId === id));
  if (type === 'accounts') return ledger.some((entry) => entry.accountId === id);
  return ledger.some((entry) => entry.categoryId === id);
};
