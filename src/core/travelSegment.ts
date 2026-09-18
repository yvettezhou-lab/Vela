import type { LedgerEntry, TravelSegment } from './domain';

export const findSegmentByDate = (segments: TravelSegment[], date: number): TravelSegment | undefined => {
  if (!Number.isFinite(date)) return undefined;
  return segments.find((segment) => date >= segment.startDate && date <= segment.endDate);
};

export const getLedgerEntryDate = (entry: LedgerEntry): number => {
  if (entry.entryType === 'flight') return entry.outboundDate;
  return entry.paymentDate;
};

export const getSegmentForLedgerEntry = (
  segments: TravelSegment[],
  entry: LedgerEntry,
): TravelSegment | undefined => findSegmentByDate(segments, getLedgerEntryDate(entry));

export const getSegmentPrimaryCurrency = (segments: TravelSegment[], date: number): string | undefined =>
  findSegmentByDate(segments, date)?.primaryCurrency;

export const resolveLedgerEntryCurrency = (
  segments: TravelSegment[],
  entry: LedgerEntry,
): string => {
  const segment = getSegmentForLedgerEntry(segments, entry);
  if (!segment) {
    throw new Error('Ledger Error: Entry date must fall within a TravelSegment date range');
  }
  return segment.primaryCurrency;
};
