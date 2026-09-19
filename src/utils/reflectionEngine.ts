import { getTripEndDate, getTripStartDate } from '../core/travelSegment';
import { LedgerEntry, Trip } from '../core/domain';
import { AnnualReflection, TripInsights, TravelFrequency, TripExpenseStructure } from '../types/logbook';

const DAY_MS = 86_400_000;

const getTripDays = (trip: Trip): number =>
  Math.max(1, Math.floor((getTripEndDate(trip) - getTripStartDate(trip)) / DAY_MS) + 1);

const getSignedAmount = (entry: LedgerEntry): number =>
  entry.isRefund ? -entry.originalAmount : entry.originalAmount;

const addAmount = (target: Record<string, number>, key: string, amount: number): void => {
  target[key] = (target[key] ?? 0) + amount;
};

const countsInStats = (_trip: Trip, entry: LedgerEntry): boolean => entry.includeInCost && !entry.isPending;

const getCategoryName = (trip: Trip, entry: LedgerEntry): string =>
  trip.categories.find((category) => category.id === entry.categoryId)?.name ?? entry.categoryId;

const round = (value: number): number => Math.round(value * 100) / 100;

const buildExpenseStructure = (breakdown: Record<string, number>): TripExpenseStructure[] => {
  const positive = Object.entries(breakdown).filter(([, amount]) => amount > 0);
  const total = positive.reduce((sum, [, amount]) => sum + amount, 0);
  if (total <= 0) return [];
  return positive
    .map(([category, amount]) => ({ category, amount: round(amount), share: round((amount / total) * 100) }))
    .sort((a, b) => b.amount - a.amount);
};

/** Read-only derived insight for one achieved or currently traveling trip. */
export const generateTripInsights = (trip: Trip): TripInsights => {
  const totalDays = getTripDays(trip);
  const totalExpenditure: Record<string, number> = {};
  const categoryBreakdown: Record<string, number> = {};
  let largestExpense: LedgerEntry | null = null;
  let largestExpenseAmount = 0;

  trip.ledger.filter((entry) => countsInStats(trip, entry)).forEach((entry) => {
    const signedAmount = getSignedAmount(entry);
    addAmount(totalExpenditure, entry.originalCurrency, signedAmount);
    addAmount(categoryBreakdown, getCategoryName(trip, entry), signedAmount);
    if (!entry.isRefund && signedAmount > largestExpenseAmount) {
      largestExpense = entry;
      largestExpenseAmount = signedAmount;
    }
  });

  const averageCostPerDay = Object.fromEntries(
    Object.entries(totalExpenditure).map(([currency, amount]) => [currency, round(amount / totalDays)]),
  );

  return {
    tripId: trip.id,
    totalDays,
    totalExpenditure,
    categoryBreakdown,
    expenseStructure: buildExpenseStructure(categoryBreakdown),
    largestExpense,
    averageCostPerDay,
  };
};

/** Derive travel cadence from the supplied trips; no state is persisted. */
export const calculateTravelFrequency = (trips: Trip[], targetYear: number): TravelFrequency => {
  const yearTrips = trips
    .filter((trip) => new Date(getTripStartDate(trip)).getFullYear() === targetYear)
    .sort((a, b) => a.startDate - b.startDate);
  const travelDays = yearTrips.reduce((sum, trip) => sum + getTripDays(trip), 0);
  const months = new Set<number>();
  yearTrips.forEach((trip) => {
    const cursor = new Date(getTripStartDate(trip));
    const end = new Date(getTripEndDate(trip));
    while (cursor <= end) {
      if (cursor.getFullYear() === targetYear) months.add(cursor.getMonth());
      cursor.setDate(cursor.getDate() + 1);
    }
  });
  const gaps = yearTrips.slice(1).map((trip, index) => Math.max(0, Math.round((getTripStartDate(trip) - yearTrips[index].endDate) / DAY_MS)));
  return {
    tripsPerYear: yearTrips.length,
    travelDaysPerYear: travelDays,
    averageTripLength: yearTrips.length ? round(travelDays / yearTrips.length) : 0,
    monthsWithTravel: months.size,
    averageGapBetweenTrips: gaps.length ? round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length) : null,
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
  const yearAchievedTrips = achieveTrips.filter((trip) => new Date(getTripEndDate(trip)).getFullYear() === targetYear);
  const yearActiveTrip = activeTrip && new Date(getTripEndDate(activeTrip)).getFullYear() === targetYear ? activeTrip : null;
  const yearPlanningTrips = planningTrips.filter((trip) => new Date(getTripStartDate(trip)).getFullYear() === targetYear);
  const reflectedTrips = yearActiveTrip ? [...yearAchievedTrips, yearActiveTrip] : yearAchievedTrips;
  const frequencyTrips = reflectedTrips;

  reflectedTrips.forEach((trip) => {
    trip.ledger.filter((entry) => countsInStats(trip, entry)).forEach((entry) => {
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
    travelFrequency: calculateTravelFrequency(frequencyTrips, targetYear),
  };
};

/** Backward-compatible helper for older callers. */
export const generateAnnualReflection = (achieveTrips: Trip[], targetYear: number): AnnualReflection =>
  calculateAnnualTotals(achieveTrips, null, [], targetYear);
