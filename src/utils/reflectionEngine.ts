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

/** Read-only derived insight for one achieved or currently traveling trip. */
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
 * Calculate annual reflection directly from existing source collections.
 * Achieved trips are historical; activeTrip is the live in-progress journey;
 * planningTrips remain future plans and are exposed as planning metrics only.
 * Nothing is persisted or aggregated outside this pure calculation.
 */
export const calculateAnnualTotals = (
  achieveTrips: Trip[],
  activeTrip: Trip | null,
  planningTrips: Trip[],
  targetYear: number,
): AnnualReflection => {
  const annualExpenditure: Record<string, number> = {};
  const topCategories: Record<string, number> = {};
  const yearAchievedTrips = achieveTrips.filter((trip) => new Date(trip.endDate).getFullYear() === targetYear);
  const yearActiveTrip = activeTrip && new Date(activeTrip.endDate).getFullYear() === targetYear ? activeTrip : null;
  const yearPlanningTrips = planningTrips.filter((trip) => new Date(trip.startDate).getFullYear() === targetYear);
  const reflectedTrips = yearActiveTrip ? [...yearAchievedTrips, yearActiveTrip] : yearAchievedTrips;

  reflectedTrips.forEach((trip) => {
    trip.ledger.forEach((entry) => {
      const signedAmount = getSignedAmount(entry);
      addAmount(annualExpenditure, entry.originalCurrency, signedAmount);
      addAmount(topCategories, getCategoryName(trip, entry), signedAmount);
    });
  });

  return {
    year: targetYear,
    totalTripsCompleted: yearAchievedTrips.length,
    activeTripCount: yearActiveTrip ? 1 : 0,
    plannedTripCount: yearPlanningTrips.length,
    totalDaysTraveled: reflectedTrips.reduce((days, trip) => days + getTripDays(trip), 0),
    plannedDays: yearPlanningTrips.reduce((days, trip) => days + getTripDays(trip), 0),
    annualExpenditure,
    topCategories,
  };
};

/** Backward-compatible helper for older callers. */
export const generateAnnualReflection = (achieveTrips: Trip[], targetYear: number): AnnualReflection =>
  calculateAnnualTotals(achieveTrips, null, [], targetYear);
