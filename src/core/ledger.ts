import type { LedgerEntry } from './domain';

/**
 * Canonical signed impact of a ledger entry on financial totals.
 * Expense is positive; income/refund is negative.
 */
export const getLedgerFinancialImpact = (entry: LedgerEntry): number =>
  entry.entryDirection === 'income'
    ? -entry.cnyEquivalent
    : entry.cnyEquivalent;

export const getLedgerOriginalAmountImpact = (entry: LedgerEntry): number =>
  entry.entryDirection === 'income'
    ? -entry.originalAmount
    : entry.originalAmount;

const isFiniteTimestamp = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * Canonical paid timestamp, with legacy fallbacks for older entries.
 */
export const getLedgerEntryPaidTimestamp = (entry: LedgerEntry): number => {
  if (isFiniteTimestamp(entry.paidAt)) return entry.paidAt;

  if (
    entry.entryType === 'standard' ||
    entry.entryType === 'prepaid_multi_day'
  ) {
    if (isFiniteTimestamp(entry.paymentDate)) {
      return entry.paymentDate;
    }
  }

  if (entry.entryType === 'transport') {
    if (isFiniteTimestamp(entry.paymentDate)) {
      return entry.paymentDate;
    }

    if (isFiniteTimestamp(entry.outboundDate)) {
      return entry.outboundDate;
    }
  }

  return entry.createdAt;
};

export const compareLedgerEntriesByPaidTimestamp = (
  a: LedgerEntry,
  b: LedgerEntry,
): number => {
  const paidDiff =
    getLedgerEntryPaidTimestamp(b) -
    getLedgerEntryPaidTimestamp(a);

  if (paidDiff !== 0) return paidDiff;

  return (b.createdAt ?? 0) - (a.createdAt ?? 0);
};

export const sortLedgerEntriesByPaidTimestamp = (
  entries: LedgerEntry[],
): LedgerEntry[] => [...entries].sort(compareLedgerEntriesByPaidTimestamp);

export const formatLedgerPaidTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);

  if (!Number.isFinite(date.getTime())) return '—';

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};
