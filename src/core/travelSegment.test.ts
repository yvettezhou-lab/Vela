import { describe, expect, it } from 'vitest';
import type { TravelSegment } from './domain';
import { findSegmentByDate, getLedgerEntryDate, resolveLedgerEntryCurrency } from './travelSegment';

const segments: TravelSegment[] = [
  { id: 's1', destinations: [{ country: 'Malaysia', city: 'Kuala Lumpur' }], startDate: 100, endDate: 199, primaryCurrency: 'MYR' },
  { id: 's2', destinations: [{ country: 'Singapore', city: 'Singapore' }], startDate: 199, endDate: 299, primaryCurrency: 'SGD' },
];

describe('travel segment resolution', () => {
  it('matches inclusive segment date ranges', () => {
    expect(findSegmentByDate(segments, 100)?.id).toBe('s1');
    expect(findSegmentByDate(segments, 198)?.id).toBe('s1');
    expect(findSegmentByDate(segments, 199)?.id).toBe('s2');
    expect(findSegmentByDate(segments, 200)?.id).toBe('s2');
    expect(findSegmentByDate(segments, 999)).toBeUndefined();
  });

  it('uses payment date for standard/prepaid entries and outbound date for flights', () => {
    expect(getLedgerEntryDate({ entryType: 'standard', paymentDate: 120 } as any)).toBe(120);
    expect(getLedgerEntryDate({ entryType: 'prepaid_multi_day', paymentDate: 220 } as any)).toBe(220);
    expect(getLedgerEntryDate({ entryType: 'flight', flightType: 'one_way', outboundDate: 240 } as any)).toBe(240);
  });

  it('resolves currency from the matched segment and rejects dates outside all segments', () => {
    expect(resolveLedgerEntryCurrency(segments, { entryType: 'standard', paymentDate: 120 } as any)).toBe('MYR');
    expect(resolveLedgerEntryCurrency(segments, { entryType: 'flight', flightType: 'one_way', outboundDate: 240 } as any)).toBe('SGD');
    expect(() => resolveLedgerEntryCurrency(segments, { entryType: 'standard', paymentDate: 300 } as any)).toThrow(/must fall within a TravelSegment/);
  });
});


describe('boundary day resolution', () => {
  it('prefers the newer segment when a date belongs to both segments', () => {
    expect(resolveLedgerEntryCurrency(segments, { entryType: 'standard', paymentDate: 199 } as any)).toBe('SGD');
  });
});
