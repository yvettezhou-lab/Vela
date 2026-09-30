import { JourneyCheckResolution, Trip } from './domain';
import { getTripStartDate } from './travelSegment';

export type JourneyCheckCheckpoint = '7d' | '3d' | '1d';
export type JourneyCheckIssue = { id: string; from: string; to: string; fromDate: number; toDate: number };

const dayStart = (timestamp: number) => { const d = new Date(timestamp); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };

export const getJourneyCheckCheckpoint = (trip: Trip, now = Date.now()): JourneyCheckCheckpoint | null => {
  if (trip.status === 'achieve' || !trip.segments.length) return null;
  const days = Math.ceil((dayStart(getTripStartDate(trip)) - dayStart(now)) / 86400000);
  if (days <= 1 && days >= 0) return '1d';
  if (days <= 3 && days > 1) return '3d';
  if (days <= 7 && days > 3) return '7d';
  return null;
};

const destinationLabel = (destination: { city: string; country: string }) => destination.city || destination.country || 'Unknown';

export const getJourneyCheckIssues = (trip: Trip): JourneyCheckIssue[] => {
  const segments = [...trip.segments].sort((a, b) => a.startDate - b.startDate);
  const issues: JourneyCheckIssue[] = [];
  for (let i = 0; i < segments.length - 1; i++) {
    const from = segments[i].destinations.at(-1);
    const to = segments[i + 1].destinations[0];
    if (!from || !to) continue;
    const fromLabel = destinationLabel(from); const toLabel = destinationLabel(to);
    if (!fromLabel || !toLabel || fromLabel.trim().toLowerCase() === toLabel.trim().toLowerCase()) continue;
    issues.push({ id: `route:${segments[i].id}:${segments[i + 1].id}`, from: fromLabel, to: toLabel, fromDate: segments[i].endDate, toDate: segments[i + 1].startDate });
  }
  return issues;
};

export const hasJourneyCheckBeenShown = (trip: Trip, checkpoint: JourneyCheckCheckpoint) => Boolean(trip.journeyCheck?.shownCheckpoints?.includes(checkpoint));

export const markJourneyCheckShown = (trip: Trip, checkpoint: JourneyCheckCheckpoint): Trip => ({
  ...trip, journeyCheck: { shownCheckpoints: Array.from(new Set([...(trip.journeyCheck?.shownCheckpoints ?? []), checkpoint])), resolutions: { ...(trip.journeyCheck?.resolutions ?? {}) } },
});

export const setJourneyCheckResolution = (trip: Trip, issueId: string, resolution: JourneyCheckResolution): Trip => ({
  ...trip, journeyCheck: { shownCheckpoints: [...(trip.journeyCheck?.shownCheckpoints ?? [])], resolutions: { ...(trip.journeyCheck?.resolutions ?? {}), [issueId]: resolution } },
});