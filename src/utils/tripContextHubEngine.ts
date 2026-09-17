import type { LedgerEntry, Trip } from '../core/domain';

const DAY_MS = 86_400_000;

export interface ContextHubCategory {
  category: string;
  amount: number;
  share: number;
}

export interface ContextHubAccount {
  accountId: string;
  account: string;
  entryCount: number;
  amount: number;
}

export interface ContextHubHistoryEntry {
  id: string;
  category: string;
  account: string;
  amount: number;
  currency: string;
  isRefund: boolean;
  createdAt: number;
}

export interface TripContextHub {
  tripId: string;
  durationDays: number;
  memberNames: string[];
  accounts: ContextHubAccount[];
  categories: ContextHubCategory[];
  ledgerCount: number;
  totalExpenditure: Record<string, number>;
  averageCostPerDay: Record<string, number>;
  history: ContextHubHistoryEntry[];
}

const round = (value: number): number => Math.round(value * 100) / 100;
const getDays = (trip: Trip): number => Math.max(1, Math.floor((trip.endDate - trip.startDate) / DAY_MS) + 1);
const signedAmount = (entry: LedgerEntry): number => entry.isRefund ? -entry.originalAmount : entry.originalAmount;
const categoryName = (trip: Trip, entry: LedgerEntry): string => trip.categories.find((item) => item.id === entry.categoryId)?.name ?? entry.categoryId;
const accountName = (trip: Trip, entry: LedgerEntry): string => trip.accounts.find((item) => item.id === entry.accountId)?.name ?? entry.accountId;

/** Derive the complete read-only context for one Trip from existing source entities. */
export const generateTripContextHub = (trip: Trip): TripContextHub => {
  const totals: Record<string, number> = {};
  const categoryTotals: Record<string, number> = {};
  const accountTotals: Record<string, ContextHubAccount> = {};

  trip.ledger.forEach((entry) => {
    const amount = signedAmount(entry);
    const currency = entry.originalCurrency;
    totals[currency] = (totals[currency] ?? 0) + amount;

    const category = categoryName(trip, entry);
    categoryTotals[category] = (categoryTotals[category] ?? 0) + amount;

    const accountId = entry.accountId;
    const account = accountName(trip, entry);
    accountTotals[accountId] ??= { accountId, account, entryCount: 0, amount: 0 };
    accountTotals[accountId].entryCount += 1;
    accountTotals[accountId].amount += amount;
  });

  const positiveCategoryTotal = Object.values(categoryTotals).filter((amount) => amount > 0).reduce((sum, amount) => sum + amount, 0);
  const days = getDays(trip);

  return {
    tripId: trip.id,
    durationDays: days,
    memberNames: trip.members.map((member) => member.name),
    accounts: Object.values(accountTotals).sort((a, b) => b.amount - a.amount).map((account) => ({ ...account, amount: round(account.amount) })),
    categories: Object.entries(categoryTotals)
      .filter(([, amount]) => amount > 0)
      .map(([category, amount]) => ({ category, amount: round(amount), share: positiveCategoryTotal ? round((amount / positiveCategoryTotal) * 100) : 0 }))
      .sort((a, b) => b.amount - a.amount),
    ledgerCount: trip.ledger.length,
    totalExpenditure: Object.fromEntries(Object.entries(totals).map(([currency, amount]) => [currency, round(amount)])),
    averageCostPerDay: Object.fromEntries(Object.entries(totals).map(([currency, amount]) => [currency, round(amount / days)])),
    history: [...trip.ledger]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((entry) => ({
        id: entry.id,
        category: categoryName(trip, entry),
        account: accountName(trip, entry),
        amount: round(signedAmount(entry)),
        currency: entry.originalCurrency,
        isRefund: entry.isRefund,
        createdAt: entry.createdAt,
      })),
  };
};
