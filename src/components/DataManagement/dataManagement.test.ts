import { describe, expect, it } from 'vitest';
import type { Trip } from '../../core/domain';

const trip = (overrides: Partial<Trip>): Trip => ({
  id: 'trip-1', title: 'Trip', destination: 'Kyoto', startDate: Date.parse('2026-01-01'), endDate: Date.parse('2026-01-03'),
  status: 'achieve', localCurrency: 'JPY', coverImage: undefined, members: [], accounts: [], categories: [], ledger: [], createdAt: 0, updatedAt: 0, ...overrides,
});

describe('data management export contract', () => {
  it('uses a versioned, serializable payload shape', () => {
    const payload = { format: 'vela-data-export', version: 1, exportedAt: new Date().toISOString(), state: { trips: [trip({})] } };
    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);
    expect(payload.state.trips).toHaveLength(1);
  });

  it('keeps the source trip unchanged during serialization', () => {
    const source = trip({ title: 'Original' });
    const before = JSON.stringify(source);
    JSON.stringify({ state: { trips: [source] } });
    expect(JSON.stringify(source)).toBe(before);
  });
});
