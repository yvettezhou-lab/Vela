import type { Trip } from '../core/domain';

const DAY_MS = 86_400_000;
const getTripDays = (trip: Trip): number => {
  if (!trip.segments.length) return 1;
  const start = Math.min(...trip.segments.map((segment) => segment.startDate));
  const end = Math.max(...trip.segments.map((segment) => segment.endDate));
  return Math.max(1, Math.floor((end - start) / DAY_MS) + 1);
};
const getPrimaryCurrency = (trip: Trip) => trip.segments[0]?.primaryCurrency ?? 'CNY';

export interface HistoricalBudgetReference {
  currency: string; comparableTripCount: number; historicalDailyAverageMin: number; historicalDailyAverageMax: number; estimatedRangeMin: number; estimatedRangeMax: number;
}
const getTripSpend = (trip: Trip): number => {
  const currency = getPrimaryCurrency(trip);
  return trip.ledger.reduce((sum, entry) => sum + (entry.originalCurrency === currency ? (entry.isRefund ? -entry.originalAmount : entry.originalAmount) : 0), 0);
};
const getDailyAverage = (trip: Trip): number => getTripSpend(trip) / getTripDays(trip);
export const calculateHistoricalBudgetReference = (planningTrip: Trip, achieveTrips: Trip[]): HistoricalBudgetReference | null => {
  const plannedDays = getTripDays(planningTrip);
  const lowerDays = plannedDays * 0.5, upperDays = plannedDays * 1.5;
  const planningCurrency = getPrimaryCurrency(planningTrip);
  const comparable = achieveTrips.filter((trip) => {
    const days = getTripDays(trip);
    return getPrimaryCurrency(trip) === planningCurrency && days >= lowerDays && days <= upperDays;
  });
  if (!comparable.length) return null;
  const dailyAverages = comparable.map(getDailyAverage);
  const historicalDailyAverageMin = Math.min(...dailyAverages), historicalDailyAverageMax = Math.max(...dailyAverages);
  return { currency: planningCurrency, comparableTripCount: comparable.length, historicalDailyAverageMin: Math.round(historicalDailyAverageMin * 100) / 100, historicalDailyAverageMax: Math.round(historicalDailyAverageMax * 100) / 100, estimatedRangeMin: Math.round(historicalDailyAverageMin * plannedDays * 100) / 100, estimatedRangeMax: Math.round(historicalDailyAverageMax * plannedDays * 100) / 100 };
};
