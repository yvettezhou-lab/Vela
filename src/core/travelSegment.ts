import type { LedgerEntry, TravelSegment } from './domain';

export const findSegmentByDate = (segments: TravelSegment[], date: number): TravelSegment | undefined => {
  if (!Number.isFinite(date)) return undefined;
  return segments.filter((segment) => date >= segment.startDate && date <= segment.endDate).sort((a, b) => b.startDate - a.startDate)[0];
};

export const getLedgerEntryDate = (entry: LedgerEntry): number => {
  if (entry.entryType === 'flight') return entry.outboundDate;
  return entry.paymentDate;
};

export const getSegmentForLedgerEntry = (
  segments: TravelSegment[],
  entry: LedgerEntry,
): TravelSegment | undefined => findSegmentByDate(segments, getLedgerEntryDate(entry));

export const getTripStartDate = (trip: { segments: TravelSegment[] }): number => Math.min(...trip.segments.map((segment) => segment.startDate));
export const getTripEndDate = (trip: { segments: TravelSegment[] }): number => Math.max(...trip.segments.map((segment) => segment.endDate));
export const getTripPrimaryCurrency = (trip: { segments: TravelSegment[] }): string => trip.segments[0]?.primaryCurrency ?? 'CNY';
export const getTripDestinations = (trip: { segments: TravelSegment[] }): string[] =>
  trip.segments.flatMap((segment) => segment.destinations.map((destination) => destination.city || destination.country)).filter(Boolean);

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
