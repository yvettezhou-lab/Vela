import { describe, expect, it } from 'vitest';
import { migrateLegacyPlanToTrip } from './legacyAdapter';

describe('legacy trip migration to travel segments', () => {
  it('wraps legacy trip-level dates, currency and destination into segments[0]', () => {
    const migrated = migrateLegacyPlanToTrip({
      id: 'trip-1',
      title: 'Paris',
      startDate: 100,
      endDate: 200,
      currency: 'EUR',
      destination: 'Paris',
      status: 'planning',
      members: [],
      accounts: [],
      categories: [],
      entries: [],
      createdAt: 1,
      updatedAt: 2,
    });

    expect(migrated.segments).toEqual([{
      id: 'trip-1-segment-1',
      destinations: [{ country: '', city: 'Paris' }],
      startDate: 100,
      endDate: 200,
      primaryCurrency: 'EUR',
    }]);
    expect((migrated as any).localCurrency).toBeUndefined();
    expect((migrated as any).destination).toBeUndefined();
  });

  it('keeps migration pure when the legacy destination is absent', () => {
    const migrated = migrateLegacyPlanToTrip({
      id: 'trip-2',
      title: 'Unknown',
      startDate: 100,
      endDate: 200,
      currency: 'CNY',
      status: 'planning',
      members: [],
      accounts: [],
      categories: [],
      entries: [],
      createdAt: 1,
      updatedAt: 1,
    });
    expect(migrated.segments[0].destinations).toEqual([]);
  });
});
