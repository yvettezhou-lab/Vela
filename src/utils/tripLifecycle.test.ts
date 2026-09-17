import { describe, expect, it } from 'vitest';
import type { Trip } from '../core/domain';
import { getAutoStartTripId } from './tripLifecycle';

const trip = (id: string, startDate: string, status: Trip['status']): Trip => ({
  id,
  title: id,
  destination: '',
  startDate: new Date(`${startDate}T00:00:00`).getTime(),
  endDate: new Date(`${startDate}T00:00:00`).getTime(),
  status,
  localCurrency: 'CNY',
  members: [],
  accounts: [],
  categories: [],
  ledger: [],
  createdAt: 1,
  updatedAt: 1,
});

describe('trip lifecycle auto-start', () => {
  it('selects a planning trip whose start date is today or earlier', () => {
    const trips = [trip('future', '2026-09-20', 'planning'), trip('due', '2026-09-17', 'planning')];
    const now = new Date('2026-09-17T12:00:00').getTime();
    expect(getAutoStartTripId(trips, now)).toBe('due');
  });

  it('does not auto-start a future planning trip', () => {
    const now = new Date('2026-09-17T12:00:00').getTime();
    expect(getAutoStartTripId([trip('future', '2026-09-18', 'planning')], now)).toBeNull();
  });

  it('never selects a planning trip when an active trip already exists', () => {
    const now = new Date('2026-09-17T12:00:00').getTime();
    expect(getAutoStartTripId([trip('active', '2026-09-16', 'traveling'), trip('due', '2026-09-17', 'planning')], now)).toBeNull();
  });

  it('does not mutate the source collection', () => {
    const trips = [trip('b', '2026-09-17', 'planning'), trip('a', '2026-09-16', 'planning')];
    const before = trips.map((item) => item.id);
    getAutoStartTripId(trips, new Date('2026-09-17T12:00:00').getTime());
    expect(trips.map((item) => item.id)).toEqual(before);
  });
});
