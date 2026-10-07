import {
  AllocationMode,
  LedgerEntry,
  TravelSegment,
  TransportJourneyType,
  TransportMode,
} from '../../core/domain';
import { TRANSPORT_CATEGORY_ID } from '../../core/validation';
import { getLedgerEntryDate, getSegmentsByDate } from '../../core/travelSegment';

export const generateEntryId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `entry_${Math.random().toString(36).slice(2, 11)}`;

export interface QuickEntryBaseDataInput {
  initialEntry?: LedgerEntry | null;
  categoryId: string;
  originalAmount: number;
  currency: string;
  cnyTotal: number;
  includeInCost: boolean;
  isIncomeEntry: boolean;
  refundOf: string;
  deferCny: boolean;
  payerId: string;
  accountId: string;
  note: string;
  allocationMode: AllocationMode;
  allocations: LedgerEntry['allocations'];
  paidAt: number;
  now: number;
}

export const buildQuickEntryBaseData = ({
  initialEntry,
  categoryId,
  originalAmount,
  currency,
  cnyTotal,
  includeInCost,
  isIncomeEntry,
  refundOf,
  deferCny,
  payerId,
  accountId,
  note,
  allocationMode,
  allocations,
  paidAt,
  now,
}: QuickEntryBaseDataInput) => ({
  id: initialEntry?.id ?? `entry_${generateEntryId()}`,
  categoryId,
  originalAmount,
  originalCurrency: currency.trim().toUpperCase(),
  cnyEquivalent: cnyTotal,
  includeInCost,
  entryDirection: isIncomeEntry ? 'income' as const : 'expense' as const,
  isRefund: categoryId === 'cat_refund',
  ...(categoryId === 'cat_refund' && refundOf ? { refundOf } : {}),
  isPending: deferCny,
  payerId,
  accountId,
  ...(note.trim() ? { note: note.trim() } : {}),
  allocationMode,
  allocations,
  createdAt: initialEntry?.createdAt ?? now,
  updatedAt: now,
  paidAt,
});

export interface BuildQuickEntryInput {
  entryType: 'standard' | 'transport' | 'prepaid_multi_day';
  baseData: ReturnType<typeof buildQuickEntryBaseData>;
  paidDateOnly: number;
  paymentDate: string;
  outboundDate: string;
  returnDate: string;
  usageStart: string;
  usageEnd: string;
  transportMode: TransportMode;
  journeyType: TransportJourneyType;
  toDateTimestamp: (value: string) => number;
}

export const buildQuickEntry = ({
  entryType,
  baseData,
  paidDateOnly,
  paymentDate,
  outboundDate,
  returnDate,
  usageStart,
  usageEnd,
  transportMode,
  journeyType,
  toDateTimestamp,
}: BuildQuickEntryInput): LedgerEntry => {
  if (entryType === 'standard') {
    const date = toDateTimestamp(paymentDate);
    if (!Number.isFinite(date)) throw new Error('Payment date is required.');
    return { ...baseData, entryType: 'standard', paymentDate: paidDateOnly };
  }

  if (entryType === 'transport') {
    const outbound = toDateTimestamp(outboundDate);
    if (!Number.isFinite(outbound)) throw new Error('Outbound date is required.');

    if (journeyType === 'round_trip') {
      if (transportMode === 'long_distance_bus') {
        throw new Error('Long-distance bus tickets are one-way only.');
      }
      const returnTimestamp = toDateTimestamp(returnDate);
      if (!Number.isFinite(returnTimestamp)) throw new Error('Return date is required.');
      if (returnTimestamp < outbound) throw new Error('Return date cannot be before outbound date.');

      return {
        ...baseData,
        categoryId: TRANSPORT_CATEGORY_ID,
        entryType: 'transport',
        transportMode,
        journeyType: 'round_trip',
        outboundDate: outbound,
        returnDate: returnTimestamp,
        paymentDate: paidDateOnly,
      };
    }

    return {
      ...baseData,
      categoryId: TRANSPORT_CATEGORY_ID,
      entryType: 'transport',
      transportMode,
      journeyType: 'one_way',
      outboundDate: outbound,
      paymentDate: paidDateOnly,
    };
  }

  const payment = toDateTimestamp(paymentDate);
  const start = toDateTimestamp(usageStart);
  const end = toDateTimestamp(usageEnd);
  if (!Number.isFinite(payment)) throw new Error('Payment date is required.');
  if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error('Usage dates are required.');
  if (end < start) throw new Error('Usage end cannot be before usage start.');

  return {
    ...baseData,
    entryType: 'prepaid_multi_day',
    paymentDate: paidDateOnly,
    usageStart: start,
    usageEnd: end,
  };
};

export interface SegmentHandoffInput {
  targetTrip: {
    segments: TravelSegment[];
    ledger: LedgerEntry[];
  };
  entry: LedgerEntry;
  toDateValue: (date: Date) => string;
}

export const getSegmentHandoff = ({
  targetTrip,
  entry,
  toDateValue,
}: SegmentHandoffInput) => {
  const contextDate = getLedgerEntryDate(entry);
  const daySegments = getSegmentsByDate(targetTrip.segments, contextDate);
  const sameDayEntries = targetTrip.ledger
    .filter((ledgerEntry) => {
      const entryDate = getLedgerEntryDate(ledgerEntry);
      return (
        Number.isFinite(entryDate) &&
        toDateValue(new Date(entryDate)) === toDateValue(new Date(contextDate))
      );
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  const lastSegmentId = sameDayEntries.find((ledgerEntry) => ledgerEntry.segmentId)?.segmentId;
  const currentSegmentIndex = lastSegmentId
    ? daySegments.findIndex((segment) => segment.id === lastSegmentId)
    : 0;
  const safeCurrentIndex = currentSegmentIndex >= 0 ? currentSegmentIndex : 0;

  return {
    currentSegment: daySegments[safeCurrentIndex],
    nextSegment: daySegments[safeCurrentIndex + 1],
  };
};
