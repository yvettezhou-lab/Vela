import { Trip, LedgerEntry } from '../core/domain';

export interface TripInsights {
  tripId: string;
  totalDays: number;
  totalExpenditure: Record<string, number>;
  categoryBreakdown: Record<string, number>;
  largestExpense: LedgerEntry | null;
  averageCostPerDay: Record<string, number>;
}

export interface AnnualReflection {
  year: number;
  totalTripsCompleted: number;
  activeTripCount: number;
  plannedTripCount: number;
  totalDaysTraveled: number;
  plannedDays: number;
  annualExpenditure: Record<string, number>;
  topCategories: Record<string, number>;
}

export type { Trip, LedgerEntry };
