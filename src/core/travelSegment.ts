import type { TravelSegment } from './domain';

export const findSegmentByDate = (segments: TravelSegment[], date: number): TravelSegment | undefined => {
  if (!Number.isFinite(date)) return undefined;
  return segments.find((segment) => date >= segment.startDate && date <= segment.endDate);
};

export const getSegmentPrimaryCurrency = (segments: TravelSegment[], date: number): string | undefined =>
  findSegmentByDate(segments, date)?.primaryCurrency;
