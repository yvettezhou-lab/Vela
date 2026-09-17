import { describe, expect, it } from 'vitest';
import { calculateCrossTripIntelligence } from './crossTripIntelligenceEngine';
import type { Trip } from '../core/domain';

const trip = (overrides: Partial<Trip> = {}): Trip => ({
  id: crypto.randomUUID(), title: '', destination: 'Tokyo', startDate: Date.UTC(2025, 0, 1), endDate: Date.UTC(2025, 0, 3), status: 'achieve', localCurrency: 'JPY',
  members: [], accounts: [], categories: [], ledger: [], createdAt: 0, updatedAt: 0, ...overrides,
});

describe('calculateCrossTripIntelligence', () => {
  it('returns an empty, stable result without trips', () => {
    expect(calculateCrossTripIntelligence([])).toEqual({ tripCount: 0, totalTravelDays: 0, tripsPerYear: 0, averageTripLength: 0, averageDailyCostCny: 0, averageTripCostCny: 0, destinations: [] });
  });

  it('derives frequency, duration and destination patterns at runtime', () => {
    const trips = [trip(), trip({ id: 'two', destination: 'Tokyo', startDate: Date.UTC(2026, 0, 1), endDate: Date.UTC(2026, 0, 4) }), trip({ id: 'three', destination: 'Osaka', startDate: Date.UTC(2026, 0, 10), endDate: Date.UTC(2026, 0, 10) })];
    const result = calculateCrossTripIntelligence(trips);
    expect(result.tripCount).toBe(3);
    expect(result.totalTravelDays).toBe(8);
    expect(result.tripsPerYear).toBe(1.5);
    expect(result.averageTripLength).toBeCloseTo(8 / 3);
    expect(result.destinations[0]).toMatchObject({ destination: 'Tokyo', tripCount: 2, totalDays: 7 });
    expect(result.destinations[1]).toMatchObject({ destination: 'Osaka', tripCount: 1, totalDays: 1 });
  });

  it('calculates CNY cost with refunds subtracted', () => {
    const trips = [trip({ ledger: [{ cnyEquivalent: 100, isRefund: false } as never, { cnyEquivalent: 20, isRefund: true } as never] })];
    const result = calculateCrossTripIntelligence(trips);
    expect(result.averageTripCostCny).toBe(80);
    expect(result.averageDailyCostCny).toBeCloseTo(80 / 3);
  });
});
