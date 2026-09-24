import type { Trip } from '../core/domain';
import { getTripStartDate } from '../core/travelSegment';

const getLocalCalendarStart = (timestamp: number): number => {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

/** Purely selects the planning trip that is eligible to auto-start on the local calendar date. */
export const getAutoStartTripId = (trips: Trip[], now: number): string | null => {
  if (trips.some((trip) => trip.status === 'traveling')) return null;
  const today = getLocalCalendarStart(now);
  return trips
    .filter((trip) => trip.status === 'planning' && getLocalCalendarStart(getTripStartDate(trip)) <= today)
     .sort((a, b) => getTripStartDate(a) - getTripStartDate(b) || a.createdAt - b.createdAt)[0]?.id ?? null;
};
