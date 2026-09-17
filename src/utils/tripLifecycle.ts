import type { Trip } from '../core/domain';

const getLocalCalendarStart = (timestamp: number): number => {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

/** Purely selects the planning trip that is eligible to auto-start on the local calendar date. */
export const getAutoStartTripId = (trips: Trip[], now: number): string | null => {
  if (trips.some((trip) => trip.status === 'traveling')) return null;
  const today = getLocalCalendarStart(now);
  return trips
    .filter((trip) => trip.status === 'planning' && getLocalCalendarStart(trip.startDate) <= today)
    .sort((a, b) => a.startDate - b.startDate || a.createdAt - b.createdAt)[0]?.id ?? null;
};
