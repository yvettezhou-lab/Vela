import type { Trip } from '../core/domain';

export interface PlanningContext {
  durationDays: number;
  memberCount: number;
  memberNames: string[];
  currency: string;
}

const DAY_MS = 86_400_000;

/** Derive planning context directly from an existing Trip. No persistence or mutation. */
export const calculatePlanningContext = (trip: Trip): PlanningContext => ({
  durationDays: Math.max(1, Math.floor((trip.endDate - trip.startDate) / DAY_MS) + 1),
  memberCount: trip.members.length,
  memberNames: trip.members.map((member) => member.name),
  currency: trip.localCurrency,
});
