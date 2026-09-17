import type { Trip } from '../core/domain';

const DAY_MS = 86_400_000;

export interface HistoricalBudgetReference {
  currency: string;
  comparableTripCount: number;
  historicalDailyAverageMin: number;
  historicalDailyAverageMax: number;
  estimatedRangeMin: number;
  estimatedRangeMax: number;
}

const getTripDays = (trip: Trip): number =>
  Math.max(1, Math.floor((trip.endDate - trip.startDate) / DAY_MS) + 1);

const getTripSpend = (trip: Trip): number =>
  trip.ledger.reduce((sum, entry) => sum + (entry.isRefund ? -entry.originalAmount : entry.originalAmount), 0);

const getDailyAverage = (trip: Trip): number => getTripSpend(trip) / getTripDays(trip);

/**
 * Derive a historical reference for a planned trip from comparable achieved trips.
 * Comparable means same local currency and a historical duration within ±50% of the plan.
 * The returned range is the min/max historical daily average multiplied by planned days.
 * No persistence, mutation, or aggregate state is used.
 */
export const calculateHistoricalBudgetReference = (
  planningTrip: Trip,
  achieveTrips: Trip[],
): HistoricalBudgetReference | null => {
  const plannedDays = getTripDays(planningTrip);
  const lowerDays = plannedDays * 0.5;
  const upperDays = plannedDays * 1.5;
  const comparable = achieveTrips.filter((trip) => {
    const days = getTripDays(trip);
    return trip.localCurrency === planningTrip.localCurrency && days >= lowerDays && days <= upperDays;
  });

  if (comparable.length === 0) return null;

  const dailyAverages = comparable.map(getDailyAverage);
  const historicalDailyAverageMin = Math.min(...dailyAverages);
  const historicalDailyAverageMax = Math.max(...dailyAverages);

  return {
    currency: planningTrip.localCurrency,
    comparableTripCount: comparable.length,
    historicalDailyAverageMin: Math.round(historicalDailyAverageMin * 100) / 100,
    historicalDailyAverageMax: Math.round(historicalDailyAverageMax * 100) / 100,
    estimatedRangeMin: Math.round(historicalDailyAverageMin * plannedDays * 100) / 100,
    estimatedRangeMax: Math.round(historicalDailyAverageMax * plannedDays * 100) / 100,
  };
};
