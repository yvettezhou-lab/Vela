import { describe, expect, it } from 'vitest';
import type { TravelSegment } from './domain';
import { findSegmentByDate, getLedgerEntryDate, resolveLedgerEntryCurrency, validateLedgerEntryDates } from './travelSegment';

const day = (value: string, end = false) => new Date(value + 'T' + (end ? '23:59:59.999' : '00:00:00')).getTime();
const segments: TravelSegment[] = [
  { id: 's1', destinations: [{ country: 'Malaysia', city: 'Kuala Lumpur' }], startDate: day('2026-10-01'), endDate: day('2026-10-03', true), primaryCurrency: 'MYR' },
  { id: 's2', destinations: [{ country: 'Singapore', city: 'Singapore' }], startDate: day('2026-10-04'), endDate: day('2026-10-05', true), primaryCurrency: 'SGD' },
];

describe('travel segment resolution', () => {
  it('matches full calendar-day segment ranges', () => {
    expect(findSegmentByDate(segments, day('2026-10-01'))?.id).toBe('s1');
    expect(findSegmentByDate(segments, day('2026-10-03', true))?.id).toBe('s1');
    expect(findSegmentByDate(segments, day('2026-10-04'))?.id).toBe('s2');
    expect(findSegmentByDate(segments, day('2026-10-05', true))?.id).toBe('s2');
    expect(findSegmentByDate(segments, day('2026-10-06'))).toBeUndefined();
  });
  it('uses payment date for standard, usage start for prepaid, and outbound date for flights', () => {
    expect(getLedgerEntryDate({ entryType: 'standard', paymentDate: day('2026-10-02') } as any)).toBe(day('2026-10-02'));
    expect(getLedgerEntryDate({ entryType: 'prepaid_multi_day', paymentDate: day('2026-09-24'), usageStart: day('2026-10-02'), usageEnd: day('2026-10-05', true) } as any)).toBe(day('2026-10-02'));
    expect(getLedgerEntryDate({ entryType: 'flight', flightType: 'one_way', outboundDate: day('2026-10-02') } as any)).toBe(day('2026-10-02'));
  });
  it('resolves prepaid currency from usage start, not payment date', () => {
    expect(resolveLedgerEntryCurrency(segments, { entryType: 'prepaid_multi_day', paymentDate: day('2026-09-24'), usageStart: day('2026-10-02'), usageEnd: day('2026-10-03', true) } as any)).toBe('MYR');
  });
  it('rejects relevant dates outside all segments', () => {
    expect(() => validateLedgerEntryDates(segments, { entryType: 'standard', paymentDate: day('2026-09-24') } as any)).toThrow(/must fall within a TravelSegment/);
    expect(() => validateLedgerEntryDates(segments, { entryType: 'prepaid_multi_day', paymentDate: day('2026-09-24'), usageStart: day('2026-10-02'), usageEnd: day('2026-10-06') } as any)).toThrow(/must fall within a TravelSegment/);
  });
});