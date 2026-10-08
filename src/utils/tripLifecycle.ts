import type { Trip } from '../core/domain';
import { getTripEndDate, getTripStartDate, toDayStart } from '../core/travelSegment';

/**
 * Selects traveling trips whose final travel date has passed.
 */
export const getAutoEndTripIds = (
  trips: Trip[],
  now: number,
): string[] => {
  const today = toDayStart(now);

  return trips
    .filter(
      (trip) =>
        trip.status === 'traveling' &&
        toDayStart(getTripEndDate(trip)) < today,
    )
    .map((trip) => trip.id);
};

/**
 * Selects the planning trip that is eligible to auto-start
 * on the local calendar date.
 */
export const getAutoStartTripId = (
  trips: Trip[],
  now: number,
): string | null => {
  if (trips.some((trip) => trip.status === 'traveling')) return null;

  const today = toDayStart(now);

  return trips
    .filter(
      (trip) =>
        trip.status === 'planning' &&
        toDayStart(getTripStartDate(trip)) <= today,
    )
    .sort(
      (a, b) =>
        getTripStartDate(a) - getTripStartDate(b) ||
        a.createdAt - b.createdAt,
    )[0]?.id ?? null;
};
