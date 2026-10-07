import { JourneyCheckResolution, Trip } from './domain';
import { getTripStartDate } from './travelSegment';

export type JourneyCheckCheckpoint =
  | '7d'
  | '3d'
  | '1d'
  | `traveling:${string}:morning`
  | `traveling:${string}:evening`;
export type JourneyCheckIssue = {
  id: string;
  from: string;
  to: string;
  fromDate: number;
  toDate: number;
};

const dayStart = (timestamp: number) => {
  const date = new Date(timestamp);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
};

export const getJourneyCheckCheckpoint = (trip: Trip, now = Date.now()): JourneyCheckCheckpoint | null => {
  if (trip.status === 'achieve' || !trip.segments.length) return null;
  const days = Math.ceil((dayStart(getTripStartDate(trip)) - dayStart(now)) / 86400000);
  if (days <= 1 && days >= 0) return '1d';
  if (days <= 3 && days > 1) return '3d';
  if (days <= 7 && days > 3) return '7d';
  return null;
};

const destinationLabel = (destination: { city: string; country: string }) =>
  destination.city || destination.country || 'Unknown';

export const getJourneyCheckIssues = (trip: Trip): JourneyCheckIssue[] => {
  const segments = [...trip.segments].sort((a, b) => a.startDate - b.startDate);
  const stops = segments.flatMap((segment) =>
    segment.destinations.map((destination, index) => ({
      segmentId: segment.id,
      date: index === 0 ? segment.startDate : segment.endDate,
      label: destinationLabel(destination),
    })),
  );
  const issues: JourneyCheckIssue[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const from = stops[i];
    const to = stops[i + 1];
    if (!from.label || !to.label || from.label.trim().toLowerCase() === to.label.trim().toLowerCase()) continue;
    issues.push({
      id: `route:${from.segmentId}:${to.segmentId}:${i}`,
      from: from.label,
      to: to.label,
      fromDate: from.date,
      toDate: to.date,
    });
  }
  return issues;
};

export const hasJourneyCheckBeenShown = (
  trip: Trip,
  checkpoint: JourneyCheckCheckpoint,
) => Boolean(trip.journeyCheck?.shownCheckpoints?.includes(checkpoint));

export const markJourneyCheckShown = (
  trip: Trip,
  checkpoint: JourneyCheckCheckpoint,
): Trip => ({
  ...trip,
  journeyCheck: {
    shownCheckpoints: Array.from(
      new Set([
        ...(trip.journeyCheck?.shownCheckpoints ?? []),
        checkpoint,
      ]),
    ),
    resolutions: {
      ...(trip.journeyCheck?.resolutions ?? {}),
    },
  },
});

export const setJourneyCheckResolution = (
  trip: Trip,
  issueId: string,
  resolution: JourneyCheckResolution,
): Trip => ({
  ...trip,
  journeyCheck: {
    shownCheckpoints: [...(trip.journeyCheck?.shownCheckpoints ?? [])],
    resolutions: {
      ...(trip.journeyCheck?.resolutions ?? {}),
      [issueId]: resolution,
    },
  },
});
export const getTravelingDailyCheckpoint = (trip: Trip, now = Date.now()): JourneyCheckCheckpoint | null => {
  if (trip.status !== 'traveling' || !trip.segments.length) return null;
  const today = new Date(now);
  const hour = today.getHours();
  if (hour >= 6 && hour < 12) return `traveling:${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}:morning`;
  if (hour >= 20) return `traveling:${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}:evening`;
  return null;
};

export const getUnresolvedFutureJourneyIssues = (trip: Trip, now = Date.now()): JourneyCheckIssue[] => {
  const today = dayStart(now);
  return getJourneyCheckIssues(trip).filter((issue) =>
    dayStart(issue.toDate) >= today &&
    trip.journeyCheck?.resolutions?.[issue.id] !== 'self_drive' &&
    trip.journeyCheck?.resolutions?.[issue.id] !== 'local_transport'
  );
};
