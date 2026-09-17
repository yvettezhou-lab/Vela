import { LedgerEntry, Trip } from '../core/domain';
import { AnnualReflection, TripInsights } from '../types/logbook';

const getTripDays = (trip: Trip): number =>
  Math.max(1, Math.floor((trip.endDate - trip.startDate) / 86_400_000) + 1);

const getSignedAmount = (entry: LedgerEntry): number =>
  entry.isRefund ? -entry.originalAmount : entry.originalAmount;

const addAmount = (target: Record<string, number>, key: string, amount: number): void => {
  target[key] = (target[key] ?? 0) + amount;
};

const getCategoryName = (trip: Trip, entry: LedgerEntry): string =>
  trip.categories.find((category) => category.id === entry.categoryId)?.name ?? entry.categoryId;

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

export const generateAnnualReflection = (trips: Trip[], targetYear: number): AnnualReflection => {
  const annualExpenditure: Record<string, number> = {};
  const topCategories: Record<string, number> = {};

  const reflectionTrips = trips.filter((trip) => {
    if (trip.status !== 'achieve' && trip.status !== 'traveling') return false;
    return new Date(trip.endDate).getFullYear() === targetYear;
  });

  reflectionTrips.forEach((trip) => {
    trip.ledger.forEach((entry) => {
      const signedAmount = getSignedAmount(entry);
      addAmount(annualExpenditure, entry.originalCurrency, signedAmount);
      addAmount(topCategories, getCategoryName(trip, entry), signedAmount);
    });
  });

  return {
    year: targetYear,
    totalTripsCompleted: reflectionTrips.length,
    totalDaysTraveled: reflectionTrips.reduce((days, trip) => days + getTripDays(trip), 0),
    annualExpenditure,
    topCategories,
  };
};
