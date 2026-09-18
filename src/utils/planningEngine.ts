import type { Trip } from '../core/domain';

export interface PlanningContext { durationDays: number; memberCount: number; memberNames: string[]; currency: string; }
const DAY_MS = 86_400_000;
const tripStart = (trip: Trip) => Math.min(...trip.segments.map((segment) => segment.startDate));
const tripEnd = (trip: Trip) => Math.max(...trip.segments.map((segment) => segment.endDate));
export const calculatePlanningContext = (trip: Trip): PlanningContext => ({
  durationDays: Math.max(1, Math.floor((tripEnd(trip) - tripStart(trip)) / DAY_MS) + 1),
  memberCount: trip.members.length,
  memberNames: trip.members.map((member) => member.name),
  currency: trip.segments[0]?.primaryCurrency ?? 'CNY',
});
