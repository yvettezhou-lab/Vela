import { Trip, LedgerEntry } from '../core/domain';

export interface TripExpenseStructure {
  category: string;
  amount: number;
  share: number;
}

export interface TripInsights {
  tripId: string;
  totalDays: number;
  totalExpenditure: Record<string, number>;
  categoryBreakdown: Record<string, number>;
  expenseStructure: TripExpenseStructure[];
  largestExpense: LedgerEntry | null;
  averageCostPerDay: Record<string, number>;
}

export interface TravelFrequency {
  tripsPerYear: number;
  travelDaysPerYear: number;
  averageTripLength: number;
  monthsWithTravel: number;
  averageGapBetweenTrips: number | null;
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
  travelFrequency: TravelFrequency;
}

export type { Trip, LedgerEntry };
