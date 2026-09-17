import { LedgerEntry, Trip } from '../core/domain';
import { AnnualReflection, TripInsights } from '../types/logbook';

const DAY_MS = 86_400_000;

const getTripDays = (trip: Trip): number =>
  Math.max(1, Math.floor((trip.endDate - trip.startDate) / DAY_MS) + 1);

const getSignedAmount = (entry: LedgerEntry): number =>
  entry.isRefund ? -entry.originalAmount : entry.originalAmount;

const addAmount = (target: Record<string, number>, key: string, amount: number): void => {
  target[key] = (target[key] ?? 0) + amount;
};

const getCategoryName = (trip: Trip, entry: LedgerEntry): string =>
  trip.categories.find((category) => category.id === entry.categoryId)?.name ?? entry.categoryId;

/** Read-only derived insight for one achieved/traveling trip. */
export const generateTripInsights = (trip: Trip): TripInsights => {
  const totalDays = getTripDays(trip);
  const totalExpenditure: Record<string, number> = {};
  const categoryBreakdown: Record<string, number> = {};
  let largestExpense: LedgerEntry | null = null;
  let largestExpenseAmount = 0;

  trip.ledger.forEach((entry) => {
    const signedAmount = getSignedAmount(entry);
    addAmount(totalExpenditure, entry.originalCurrency, signedAmount);
    addAmount(categoryBreakdown, getCategoryName(trip, entry), signedAmount);

    if (!entry.isRefund && signedAmount > largestExpenseAmount) {
      largestExpense = entry;
      largestExpenseAmount = signedAmount;
    }
  });

  const averageCostPerDay = Object.fromEntries(
    Object.entries(totalExpenditure).map(([currency, amount]) => [currency, amount / totalDays]),
  );

  return {
    tripId: trip.id,
    totalDays,
    totalExpenditure,
    categoryBreakdown,
    largestExpense,
    averageCostPerDay,
  };
};

/**
 * Calculate annual totals from achieved trips only.
 * No persistence or aggregate state is created; every value is recomputed from source trips.
 */
export const calculateAnnualTotals = (achieveTrips: Trip[], targetYear: number): AnnualReflection => {
  const annualExpenditure: Record<string, number> = {};
  const topCategories: Record<string, number> = {};
  const yearTrips = achieveTrips.filter((trip) => new Date(trip.endDate).getFullYear() === targetYear);

  yearTrips.forEach((trip) => {
    trip.ledger.forEach((entry) => {
      const signedAmount = getSignedAmount(entry);
      addAmount(annualExpenditure, entry.originalCurrency, signedAmount);
      addAmount(topCategories, getCategoryName(trip, entry), signedAmount);
    });
  });

  return {
    year: targetYear,
    totalTripsCompleted: yearTrips.length,
    totalDaysTraveled: yearTrips.reduce((days, trip) => days + getTripDays(trip), 0),
    annualExpenditure,
    topCategories,
  };
};

/** Backward-compatible alias for callers that used the Phase 3A prototype name. */
export const generateAnnualReflection = calculateAnnualTotals;
