import type {
  Account,
  Allocation,
  AllocationMode,
  BaseLedgerEntry,
  Category,
  LedgerEntry,
  ListItem,
  Member,
  TravelSegment,
  Trip,
  TripList,
  TripStatus,
  TransportJourneyType,
  TransportMode,
} from './domain';
import {
  findSegmentByDate,
  getLedgerEntryDate,
  toDayStart,
  validateLedgerEntryDates,
} from './travelSegment';

export const TRANSPORT_CATEGORY_ID = 'cat_transport';

type EntryDirection = 'expense' | 'income';

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const requireFinite = (value: unknown, fieldName: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Domain Violation: ${fieldName} must be a finite number.`);
  }
  return value;