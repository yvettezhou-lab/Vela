import { getTripDestinations, getTripEndDate, getTripStartDate } from '../core/travelSegment';
import type { Trip } from '../core/domain';

const DAY_MS = 86_400_000;

export interface DestinationPattern {
  destination: string;
  tripCount: number;
  totalDays: number;
  averageTripLength: number;
  averageDailyCostCny: number;
}

export interface CrossTripIntelligence {
  tripCount: number;
  totalTravelDays: number;
  tripsPerYear: number;
  averageTripLength: number;
  averageDailyCostCny: number;
  averageTripCostCny: number;
  destinations: DestinationPattern[];
}

const tripDays = (trip: Trip): number => Math.max(1, Math.floor((getTripEndDate(trip) - getTripStartDate(trip)) / DAY_MS) + 1);
const tripSpendCny = (trip: Trip): number => trip.ledger.reduce((sum, entry) => sum + (entry.isRefund ? -entry.cnyEquivalent : entry.cnyEquivalent), 0);

/** Pure runtime derivation. No persistence, mutation, or analytics storage. */
export const calculateCrossTripIntelligence = (achieveTrips: Trip[]): CrossTripIntelligence => {
  const totalTravelDays = achieveTrips.reduce((sum, trip) => sum + tripDays(trip), 0);
  const totalSpendCny = achieveTrips.reduce((sum, trip) => sum + tripSpendCny(trip), 0);
  const years = new Set(achieveTrips.map((trip) => new Date(getTripStartDate(trip)).getFullYear()));
  const yearCount = Math.max(1, years.size);
  const byDestination = new Map<string, Trip[]>();
  achieveTrips.forEach((trip) => byDestination.set(getTripDestinations(trip).join(' · '), [...(byDestination.get(getTripDestinations(trip).join(' · ')) ?? []), trip]));

  const destinations = [...byDestination.entries()].map(([destination, trips]) => {
    const days = trips.reduce((sum, trip) => sum + tripDays(trip), 0);
    const spendCny = trips.reduce((sum, trip) => sum + tripSpendCny(trip), 0);
    return { destination, tripCount: trips.length, totalDays: days, averageTripLength: days / trips.length, averageDailyCostCny: days ? spendCny / days : 0 };
  }).sort((a, b) => b.tripCount - a.tripCount || a.destination.localeCompare(b.destination));

  return {
    tripCount: achieveTrips.length,
    totalTravelDays,
    tripsPerYear: achieveTrips.length / yearCount,
    averageTripLength: achieveTrips.length ? totalTravelDays / achieveTrips.length : 0,
    averageDailyCostCny: totalTravelDays ? totalSpendCny / totalTravelDays : 0,
    averageTripCostCny: achieveTrips.length ? totalSpendCny / achieveTrips.length : 0,
    destinations,
  };
};
