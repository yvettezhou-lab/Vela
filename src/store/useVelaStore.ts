import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type {
  Account,
  Category,
  Member,
  Trip,
  TripList,
  TripStatus,
} from '../core/domain';
import {
  getDefaultCategories,
  getDefaultCommonAccounts,
  getDefaultTripAccounts,
} from '../core/defaults';
import { migrateLegacyPlanToTrip } from '../core/legacyAdapter';
import { getLedgerEntryPaidTimestamp } from '../core/ledger';
import { findSegmentByDate, getLedgerEntryDate } from '../core/travelSegment';
import { DomainValidator, isRecord } from '../core/validation';

import {
  ensureTripLists,
  createDefaultTripLists,
  cloneList,
  createListFromTemplate,
  listItemKey,
} from '../utils/travelLists';
import type { TravelListTemplate } from '../utils/travelLists';
import { getAutoStartTripId } from '../utils/tripLifecycle';
import { refreshAutoTripTitles } from '../utils/tripTitle';

const LEGACY_STORAGE_KEY = 'vela.plan.v1';

const getTripLists = (trip: Trip, commonMembers: Member[]): TripList[] =>
  Array.isArray(trip.lists)
    ? trip.lists
    : createDefaultTripLists(trip, commonMembers);

const mapTrip = (
  trips: Trip[],
  tripId: string,
  updater: (trip: Trip) => Trip,
): Trip[] => trips.map((trip) => (trip.id === tripId ? updater(trip) : trip));


// -----------------------------------------------------------------------------
// Trip normalization
// -----------------------------------------------------------------------------

const withDefaultCategories = (trip: Trip): Trip => {
  const defaults = getDefaultCategories();
  const categories = trip.categories.map((category) =>
    category.id === 'cat_cash_exchange'
      ? { ...category, excludeFromStats: true }
      : category,
  );
  const existing = new Set(categories.map((category) => category.id));
  const missing = defaults.filter((category) => !existing.has(category.id));
  const mergedCategories =
    missing.length > 0 ? [...categories, ...missing] : categories;

  const categoryById = new Map(
    mergedCategories.map((category) => [category.id, category]),
  );

  const ledger = trip.ledger.map((entry) =>
    entry.includeInCost === undefined
      ? {
          ...entry,
          includeInCost:
            categoryById.get(entry.categoryId)?.excludeFromStats !== true,
        }
      : entry,
  );

  return {
    ...trip,
    categories: mergedCategories,
    ledger,
  };
};

const withDefaultAccounts = (trip: Trip): Trip => ({
  ...trip,
  accounts:
    trip.accounts.length > 0
      ? trip.accounts
      : getDefaultTripAccounts(),
});

const normalizeLedgerEntry = (
  trip: Trip,
  entry: Trip['ledger'][number],
): Trip['ledger'][number] => {
  const rawEntry = entry as unknown as Record<string, unknown>;

  const normalizedEntry =
    rawEntry.entryType === 'flight'
      ? (() => {
          const { flightType, ...rest } = rawEntry;
          return {
            ...rest,
            entryType: 'transport',
            transportMode: 'flight',
            journeyType: flightType,
          } as unknown as Trip['ledger'][number];
        })()
      : entry;

  const paidAt = getLedgerEntryPaidTimestamp(normalizedEntry);
  const withCanonicalPaidAt =
    normalizedEntry.paidAt === paidAt
      ? normalizedEntry
      : { ...normalizedEntry, paidAt };

  if (withCanonicalPaidAt.segmentId) {
    return withCanonicalPaidAt;
  }

  const segment = findSegmentByDate(
    trip.segments,
    getLedgerEntryDate(withCanonicalPaidAt),
  );

  return segment
    ? { ...withCanonicalPaidAt, segmentId: segment.id }
    : withCanonicalPaidAt;
};

const normalizeTrip = (rawTrip: Trip): Trip => {
  const trip = ensureTripLists(
    withDefaultAccounts(withDefaultCategories(rawTrip)),
  );

  return {
    ...trip,
    ledger: trip.ledger.map((entry) => normalizeLedgerEntry(trip, entry)),
  };
};

const normalizeTrips = (trips: Trip[]): Trip[] =>
  refreshAutoTripTitles(trips.map(normalizeTrip));

// -----------------------------------------------------------------------------
// Persisted-state migration
// -----------------------------------------------------------------------------

const migratePersistedTrip = (rawTrip: unknown): Trip => {
  if (!isRecord(rawTrip)) {
    throw new Error('Persisted Trip is not an object');
  }

  if (Array.isArray(rawTrip.segments)) {
    return rawTrip as unknown as Trip;
  }

  // V1.0 persisted trips used flat dates/currency/destination fields.
  const startDate = Number(rawTrip.startDate);
  const endDate = Number(rawTrip.endDate);
  const currency =
    typeof rawTrip.localCurrency === 'string'
      ? rawTrip.localCurrency.trim()
      : '';
  const destination =
    typeof rawTrip.destination === 'string'
      ? rawTrip.destination.trim()
      : '';

  if (
    !Number.isFinite(startDate) ||
    !Number.isFinite(endDate) ||
    startDate > endDate ||
    !currency
  ) {
    throw new Error('Persisted Trip has invalid legacy segment fields');
  }

  return DomainValidator.validateEntireTrip({
    ...rawTrip,
    segments: [
      {
        id: `${String(rawTrip.id)}-segment-1`,
        destinations: destination
          ? [{ country: '', city: destination }]
          : [],
        startDate,
        endDate,
        primaryCurrency: currency,
      },
    ],
  });
};

const migratePersistedState = (persistedState: unknown): unknown => {
  if (
    !isRecord(persistedState) ||
    !Array.isArray(persistedState.trips)
  ) {
    return persistedState;
  }

  const trips = persistedState.trips.map(migratePersistedTrip);
  return {
    ...persistedState,
    trips,
  };
};

const migrateLegacyStorageIfNeeded = (currentTrips: Trip[]): Trip[] => {
  if (
    typeof window === 'undefined' ||
    currentTrips.length > 0
  ) {
    return currentTrips;
  }

  const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return currentTrips;

  let legacyData: unknown;

  try {
    legacyData = JSON.parse(raw);
  } catch (error) {
    console.error(
      'Vela legacy migration skipped: invalid JSON.',
      error,
    );
    return currentTrips;
  }

  try {
    return [migrateLegacyPlanToTrip(legacyData)];
  } catch (error) {
    console.error(
      'Vela legacy migration failed; legacy data remains untouched.',
      error,
    );
    return currentTrips;
  }
};

// -----------------------------------------------------------------------------
// Master-data helpers
// -----------------------------------------------------------------------------

const replaceMasterData = (
  trip: Trip,
  type: MasterDataType,
  id: string | null,
  item: MasterDataItem,
): Trip => {
  const collection = trip[type];
  const next = id
    ? collection.map((entry) => (entry.id === id ? item : entry))
    : [...collection, item];

  return {
    ...trip,
    [type]: next,
    updatedAt: Date.now(),
  } as Trip;
};

export type MasterDataType = 'members' | 'categories' | 'accounts';
export type MasterDataItem = Member | Category | Account;

interface VelaState {
  trips: Trip[];
  commonMembers: Member[];
  commonCategories: Category[];
  commonAccounts: Account[];
  addTrip: (rawTrip: unknown) => void;
  updateTripStatus: (tripId: string, newStatus: unknown) => void;
  deleteTrip: (tripId: string) => void;
  updateTrip: (tripId: string, trip: Trip) => void;
  updateTripDates: (tripId: string, startDate: number, endDate: number) => void;
  evaluateAutoStart: (now?: number) => void;
  // ---------------------------------------------------------------------------
  // Ledger
  // ---------------------------------------------------------------------------

  addLedgerEntry: (tripId, rawEntry) => {
    const trips = get().trips;
    const tripIndex = trips.findIndex((item) => item.id === tripId);
    if (tripIndex === -1) throw new Error(`Store Error: Trip ${tripId} not found`);
    if (!isRecord(rawEntry)) {
      throw new Error('Store Error: Entry must be an object');
    }

    const baseTrip = withDefaultAccounts(withDefaultCategories(trips[tripIndex]));
    const now = Date.now();
    const candidateEntry = {
      ...rawEntry,
      createdAt: now,
      updatedAt: now,
    } as any;
    const requestedCurrency =
      typeof candidateEntry.originalCurrency === 'string'
        ? candidateEntry.originalCurrency.trim().toUpperCase()
        : '';
    const currencyResolvedEntry = {
      ...candidateEntry,
      originalCurrency: requestedCurrency,
    };
    const strictTrip = DomainValidator.validateEntireTrip(
      {
        ...baseTrip,
        ledger: [...baseTrip.ledger, currencyResolvedEntry],
      },
      trips.filter((item) => item.id !== tripId),
    );

    set((state) => ({
      trips: mapTrip(state.trips, tripId, () => strictTrip),
    }));
  },
  updateLedgerEntry: (tripId, entryId, fullReconstructedEntry) => {
    const trips = get().trips;
    const tripIndex = trips.findIndex((item) => item.id === tripId);
    if (tripIndex === -1) {
      throw new Error(`Store Error: Trip ${tripId} not found`);
    }

    const trip = withDefaultAccounts(withDefaultCategories(trips[tripIndex]));
    if (!trip.ledger.some((entry) => entry.id === entryId)) {
      throw new Error(
        `Store Error: Entry ${entryId} not found in Trip ${tripId}`,
      );
    }
    if (!isRecord(fullReconstructedEntry)) {
      throw new Error('Store Error: Entry must be an object');
    }

    const rawClone = {
      ...fullReconstructedEntry,
      updatedAt: Date.now(),
    } as any;
    if (rawClone.id !== entryId) {
      throw new Error(
        `Store Error: Reconstructed entry ID does not match target ID ${entryId}`,
      );
    }

    const requestedCurrency =
      typeof rawClone.originalCurrency === 'string'
        ? rawClone.originalCurrency.trim().toUpperCase()
        : '';
    const currencyResolvedEntry = {
      ...rawClone,
      originalCurrency: requestedCurrency,
    };
    const strictTrip = DomainValidator.validateEntireTrip(
      {
        ...trip,
        ledger: trip.ledger.map((entry) =>
          entry.id === entryId ? currencyResolvedEntry : entry,
        ),
      },
      trips.filter((item) => item.id !== tripId),
    );

    set((state) => ({
      trips: mapTrip(state.trips, tripId, () => strictTrip),
    }));
  },
  deleteLedgerEntry: (tripId, entryId) => {
    const trips = get().trips;
    const trip = trips.find((item) => item.id === tripId);
    if (!trip) throw new Error(`Store Error: Trip ${tripId} not found`);
    if (!trip.ledger.some((entry) => entry.id === entryId)) {
      throw new Error(
        `Store Error: Cannot delete nonexistent Entry ${entryId}`,
      );
    }

    set((state) => ({
      trips: mapTrip(state.trips, tripId, (item) => ({
        ...item,
        ledger: item.ledger.filter((entry) => entry.id !== entryId),
        updatedAt: Date.now(),
      })),
    }));
  },
  updateMasterData: (tripId: string, type: MasterDataType, id: string | null, item: MasterDataItem) => void;
  archiveMasterData: (tripId: string, type: MasterDataType, id: string) => void;
  // ---------------------------------------------------------------------------
  // Common master data management
  // ---------------------------------------------------------------------------

  addCommonCategory: (name: string) => void;
  renameCommonCategory: (id: string, name: string) => void;
  deleteCommonCategory: (id: string) => void;
  reorderCommonCategory: (id: string, direction: 'up' | 'down') => void;
  addCommonMember: (name: string) => void;
  renameCommonMember: (id: string, name: string) => void;
  deleteCommonMember: (id: string) => void;
  addCommonMemberListItem: (id: string, title: string) => void;
  deleteCommonMemberListItem: (id: string, title: string) => void;
  addCommonAccount: (name: string) => void;
  renameCommonAccount: (id: string, name: string) => void;
  deleteCommonAccount: (id: string) => void;
  // ---------------------------------------------------------------------------
  // Current-trip lookup
  // ---------------------------------------------------------------------------

  getCurrentTrip: () => Trip | null;
  addList: (tripId: string, name: string, source?: TripList) => void;
  // ---------------------------------------------------------------------------
  // Travel lists
  // ---------------------------------------------------------------------------

  addListTemplate: (tripId: string, template: TravelListTemplate) => void;
  ensureTripListsForTrip: (tripId: string) => void;
  addListFromTrip: (targetTripId: string, sourceTripId: string, listIds: string[]) => void;
  updateList: (tripId: string, list: TripList) => void;
  deleteList: (tripId: string, listId: string) => void;
  addListItem: (tripId: string, listId: string, title: string) => void;
  updateListItem: (tripId: string, listId: string, itemId: string, patch: Partial<Pick<import('../core/domain').ListItem, 'title'|'completed'|'note'>>) => void;
  deleteListItem: (tripId: string, listId: string, itemId: string) => void;
}

export const useVelaStore = create<VelaState>()(persist((set, get) => ({
  trips: [],
  commonMembers: [],

  // ---------------------------------------------------------------------------
  // Common master data defaults
  // ---------------------------------------------------------------------------
  commonCategories: getDefaultCategories(),
  commonAccounts: getDefaultCommonAccounts(),

  // ---------------------------------------------------------------------------
  // Trip lifecycle
  // ---------------------------------------------------------------------------
  addTrip: (rawTrip) => {
    const validated = DomainValidator.validateEntireTrip(rawTrip, get().trips);
    const tripWithLists = ensureTripLists(validated, get().commonMembers);
    const strictTrip = withDefaultAccounts(withDefaultCategories(tripWithLists));
    const refreshedTrips = refreshAutoTripTitles([
      ...get().trips,
      strictTrip,
    ]);
    set({ trips: refreshedTrips });
    get().evaluateAutoStart();
  },
  updateTrip: (tripId, trip) => {
    const trips = get().trips;
    if (!trips.some((item) => item.id === tripId)) {
      throw new Error(`Store Error: Trip ${tripId} not found`);
    }

    const strictTrip = ensureTripLists(
      DomainValidator.validateEntireTrip(
        { ...trip, id: tripId, updatedAt: Date.now() },
        trips.filter((item) => item.id !== tripId),
      ),
      get().commonMembers,
    );
    const refreshedTrips = refreshAutoTripTitles(
      trips.map((item) => (item.id === tripId ? strictTrip : item)),
    );
    set({ trips: refreshedTrips });
  },
  updateTripStatus: (tripId, newStatus) => { const trips = get().trips; const trip = trips.find((t) => t.id === tripId); if (!trip) throw new Error(`Store Error: Trip ${tripId} not found`); DomainValidator.validateTripStatus(trips, tripId, newStatus, trip.status); if (newStatus !== 'planning' && newStatus !== 'traveling' && newStatus !== 'achieve') throw new Error(`Store Error: Invalid status ${newStatus}`); set({ trips: trips.map((t) => t.id === tripId ? { ...t, status: newStatus as TripStatus, updatedAt: Date.now() } : t) }); },
  updateTripDates: (tripId, startDate, endDate) => { if (!Number.isFinite(startDate) || !Number.isFinite(endDate)) throw new Error('Store Error: Trip dates must be finite numbers'); if (startDate > endDate) throw new Error('Store Error: Start date cannot be after end date'); const trips = get().trips; const trip = trips.find((t) => t.id === tripId); if (!trip) throw new Error(`Store Error: Trip ${tripId} not found`); if (trip.segments.length === 0) throw new Error(`Store Error: Trip ${tripId} has no TravelSegment`); const updatedSegments = trip.segments.map((segment, index) => index === 0 ? { ...segment, startDate, endDate } : segment); const strictTrip = DomainValidator.validateEntireTrip({ ...trip, segments: updatedSegments, updatedAt: Date.now() }, trips.filter((t) => t.id !== tripId)); const refreshedTrips = refreshAutoTripTitles(trips.map((item) => item.id === tripId ? strictTrip : item)); set({ trips: refreshedTrips }); get().evaluateAutoStart(); },
  evaluateAutoStart: (now = Date.now()) => {
    const trips = get().trips;
    const candidateId = getAutoStartTripId(trips, now);
    if (!candidateId) return;

    const candidate = trips.find((trip) => trip.id === candidateId);
    if (!candidate) return;

    DomainValidator.validateTripStatus(
      trips,
      candidate.id,
      'traveling',
      candidate.status,
    );
    set((state) => ({
      trips: state.trips.map((trip) =>
        trip.id === candidate.id
          ? { ...trip, status: 'traveling', updatedAt: Date.now() }
          : trip,
      ),
    }));
  },
  addLedgerEntry: (tripId, rawEntry) => { const trips = get().trips; const tripIndex = trips.findIndex((t) => t.id === tripId); if (tripIndex === -1) throw new Error(`Store Error: Trip ${tripId} not found`); if (!isRecord(rawEntry)) throw new Error('Store Error: Entry must be an object'); const baseTrip = withDefaultAccounts(withDefaultCategories(trips[tripIndex])); const now = Date.now(); const candidateEntry = { ...rawEntry, createdAt: now, updatedAt: now } as any; const requestedCurrency = typeof candidateEntry.originalCurrency === 'string' ? candidateEntry.originalCurrency.trim().toUpperCase() : ''; const currencyResolvedEntry = { ...candidateEntry, originalCurrency: requestedCurrency }; const strictTrip = DomainValidator.validateEntireTrip({ ...baseTrip, ledger: [...baseTrip.ledger, currencyResolvedEntry] }, trips.filter((t) => t.id !== tripId)); set((state) => ({ trips: state.trips.map((t) => t.id === tripId ? strictTrip : t) })); },
  updateLedgerEntry: (tripId, entryId, fullReconstructedEntry) => { const trips = get().trips; const tripIndex = trips.findIndex((t) => t.id === tripId); if (tripIndex === -1) throw new Error(`Store Error: Trip ${tripId} not found`); const trip = withDefaultAccounts(withDefaultCategories(trips[tripIndex])); if (!trip.ledger.some((e) => e.id === entryId)) throw new Error(`Store Error: Entry ${entryId} not found in Trip ${tripId}`); if (!isRecord(fullReconstructedEntry)) throw new Error('Store Error: Entry must be an object'); const rawClone = { ...fullReconstructedEntry, updatedAt: Date.now() } as any; if (rawClone.id !== entryId) throw new Error(`Store Error: Reconstructed entry ID does not match target ID ${entryId}`); const requestedCurrency = typeof rawClone.originalCurrency === 'string' ? rawClone.originalCurrency.trim().toUpperCase() : ''; const currencyResolvedEntry = { ...rawClone, originalCurrency: requestedCurrency }; const strictTrip = DomainValidator.validateEntireTrip({ ...trip, ledger: trip.ledger.map((e) => e.id === entryId ? currencyResolvedEntry : e) }, trips.filter((t) => t.id !== tripId)); set((state) => ({ trips: state.trips.map((t) => t.id === tripId ? strictTrip : t) })); },
  deleteLedgerEntry: (tripId, entryId) => { const trips = get().trips; const trip = trips.find((t) => t.id === tripId); if (!trip) throw new Error(`Store Error: Trip ${tripId} not found`); if (!trip.ledger.some((e) => e.id === entryId)) throw new Error(`Store Error: Cannot delete nonexistent Entry ${entryId}`); set((state) => ({ trips: state.trips.map((t) => t.id === tripId ? { ...t, ledger: t.ledger.filter((e) => e.id !== entryId), updatedAt: Date.now() } : t) })); },
  updateMasterData: (tripId, type, id, item) => { const trips = get().trips; const trip = trips.find((t) => t.id === tripId); if (!trip) throw new Error(`Trip ${tripId} not found`); if (id && !trip[type].some((entry) => entry.id === id)) throw new Error(`Master Data Error: ${type} ${id} not found`); if (!item.name.trim()) throw new Error('Master Data Error: Name is required'); if (id && item.id !== id) throw new Error('Master Data Error: ID cannot change'); if (!id && trip[type].some((entry) => entry.name.trim().toLowerCase() === item.name.trim().toLowerCase() && !entry.archived)) throw new Error('Master Data Error: An active item with this name already exists'); set({ trips: trips.map((t) => t.id === tripId ? replaceMasterData(t, type, id, { ...item, name: item.name.trim() }) : t) }); },
  archiveMasterData: (tripId, type, id) => { const trips = get().trips; const trip = trips.find((t) => t.id === tripId); if (!trip) throw new Error(`Trip ${tripId} not found`); const entry = trip[type].find((item) => item.id === id); if (!entry) throw new Error(`Master Data Error: ${type} ${id} not found`); set({ trips: trips.map((t) => t.id === tripId ? { ...t, [type]: t[type].map((item) => item.id === id ? { ...item, archived: true } : item), updatedAt: Date.now() } : t) }); },
  addCommonCategory: (name) => { const clean = name.trim(); if (!clean) throw new Error('Category name is required'); const current = get().commonCategories ?? getDefaultCategories(); if (current.some((item) => !item.archived && item.name.toLowerCase() === clean.toLowerCase())) throw new Error('A category with this name already exists'); const category = { id: crypto.randomUUID(), name: clean, type: 'expense' }; set({ commonCategories: [...current, category], trips: get().trips.map((trip) => (trip.status === 'planning' || trip.status === 'traveling') && !trip.categories.some((item) => item.name.trim().toLowerCase() === clean.toLowerCase()) ? withDefaultCategories({ ...trip, categories: [...trip.categories, { ...category }] }) : trip) }); },
  renameCommonCategory: (id, name) => { const clean = name.trim(); if (!clean) throw new Error('Category name is required'); set({ commonCategories: (get().commonCategories ?? getDefaultCategories()).map((item) => item.id === id ? { ...item, name: clean } : item) }); },
  deleteCommonCategory: (id) => { const current = get().commonCategories ?? getDefaultCategories(); const category = current.find((item) => item.id === id); if (!category) throw new Error('Common category not found'); if (get().trips.some((trip) => (trip.status === 'planning' || trip.status === 'traveling') && trip.ledger.some((entry) => entry.categoryId === id))) throw new Error('Cannot delete a category used by an active trip.'); set({ commonCategories: current.filter((item) => item.id !== id) }); },
  reorderCommonCategory: (id, direction) => { const current = get().commonCategories ?? getDefaultCategories(); const index = current.findIndex((item) => item.id === id); if (index < 0) return; const nextIndex = direction === 'up' ? index - 1 : index + 1; if (nextIndex < 0 || nextIndex >= current.length) return; const next = [...current]; [next[index], next[nextIndex]] = [next[nextIndex], next[index]]; set({ commonCategories: next }); },
  addCommonMember: (name) => { const clean = name.trim(); if (!clean) throw new Error('Common person name is required'); const current = get().commonMembers; if (current.some((item) => !item.archived && item.name.toLowerCase() === clean.toLowerCase())) throw new Error('A common person with this name already exists'); set({ commonMembers: [...current, { id: crypto.randomUUID(), name: clean }] }); },
  renameCommonMember: (id, name) => { const clean = name.trim(); if (!clean) throw new Error('Common person name is required'); set({ commonMembers: get().commonMembers.map((item) => item.id === id ? { ...item, name: clean } : item) }); },
  deleteCommonMember: (id) => {
    set({
      commonMembers: get().commonMembers.filter((item) => item.id !== id),
    });
  },
  addCommonMemberListItem: (id, title) => {
    const clean = title.trim();
    if (!clean) throw new Error('Personal list item is required');

    set({
      commonMembers: get().commonMembers.map((item) =>
        item.id === id
          ? {
              ...item,
              personalListItems: Array.from(
                new Set([...(item.personalListItems ?? []), clean]),
              ),
            }
          : item,
      ),
    });
  },
  deleteCommonMemberListItem: (id, title) => {
    const key = title.trim().toLowerCase();

    set({
      commonMembers: get().commonMembers.map((item) =>
        item.id === id
          ? {
              ...item,
              personalListItems: (item.personalListItems ?? []).filter(
                (entry) => entry.trim().toLowerCase() !== key,
              ),
            }
          : item,
      ),
    });
  },
  addCommonAccount: (name) => { const clean = name.trim(); if (!clean) throw new Error('Account name is required'); const current = get().commonAccounts; if (current.some((item) => !item.archived && item.name.toLowerCase() === clean.toLowerCase())) throw new Error('An account with this name already exists'); set({ commonAccounts: [...current, { id: crypto.randomUUID(), name: clean }] }); },
  renameCommonAccount: (id, name) => { const clean = name.trim(); if (!clean) throw new Error('Account name is required'); set({ commonAccounts: get().commonAccounts.map((item) => item.id === id ? { ...item, name: clean } : item) }); },
  deleteCommonAccount: (id) => {
    const account = get().commonAccounts.find((item) => item.id === id);
    if (!account) throw new Error(`Common account ${id} not found`);
    const cleanName = account.name.trim().toLowerCase();
    const inActiveTrip = get().trips.some((trip) =>
      (trip.status === 'planning' || trip.status === 'traveling') &&
      trip.accounts.some((item) => item.name.trim().toLowerCase() === cleanName && !item.archived)
    );
    if (inActiveTrip) throw new Error(`Cannot delete ${account.name}: it is used by a planning or current trip.`);
    set({ commonAccounts: get().commonAccounts.filter((item) => item.id !== id) });
  },
  addListTemplate: (tripId, template) => { const trips=get().trips; const trip=trips.find(t=>t.id===tripId); if(!trip) throw new Error(`Trip ${tripId} not found`); const existingLists=Array.isArray(trip.lists)?trip.lists:createDefaultTripLists(trip, get().commonMembers); const clean=template.name.trim(); if(existingLists.some(list=>list.name.trim().toLowerCase()===clean.toLowerCase())) throw new Error('A list with this name already exists'); const t=Date.now(); const list=createListFromTemplate(tripId, template, existingLists.length, existingLists); set({trips:trips.map(item=>item.id===tripId?{...item,lists:[...existingLists,list],updatedAt:t}:item)}); },
  ensureTripListsForTrip: (tripId) => { const trips=get().trips; const trip=trips.find(t=>t.id===tripId); if(!trip) return; const ensured=ensureTripLists(trip, get().commonMembers); if(ensured===trip) return; set({trips:trips.map(item=>item.id===tripId?{...ensured,updatedAt:Date.now()}:item)}); },
  addList: (tripId, name, source) => { const clean = name.trim(); if (!clean) throw new Error('List name is required'); const trips=get().trips; const trip=trips.find(t=>t.id===tripId); if(!trip) throw new Error(`Trip ${tripId} not found`); if((Array.isArray(trip.lists)?trip.lists:createDefaultTripLists(trip, get().commonMembers)).some(list=>list.name.trim().toLowerCase()===clean.toLowerCase())) throw new Error('A list with this name already exists'); const t=Date.now(); const list=source ? cloneList({ ...source, name:clean }, tripId, (Array.isArray(trip.lists)?trip.lists:createDefaultTripLists(trip, get().commonMembers)).length) : { id:crypto.randomUUID(), tripId, name:clean, sortOrder:(Array.isArray(trip.lists)?trip.lists:createDefaultTripLists(trip, get().commonMembers)).length, createdAt:t, updatedAt:t, items:[] }; set({trips:trips.map(item=>item.id===tripId?{...item,lists:[...(Array.isArray(item.lists)?item.lists:createDefaultTripLists(item, get().commonMembers)),list],updatedAt:t}:item)}); },
  addListFromTrip: (targetTripId, sourceTripId, listIds) => { const trips=get().trips; const target=trips.find(t=>t.id===targetTripId); const source=trips.find(t=>t.id===sourceTripId); if(!target||!source) throw new Error('Trip not found'); const sourceLists=Array.isArray(source.lists)?source.lists:createDefaultTripLists(source); const targetLists=Array.isArray(target.lists)?target.lists:createDefaultTripLists(target); const selected=sourceLists.filter(list=>listIds.includes(list.id)); const existing=new Set(targetLists.map(list=>list.name.trim().toLowerCase())); const clones=selected.filter(list=>!existing.has(list.name.trim().toLowerCase())).map((list,index)=>cloneList(list,targetTripId,targetLists.length+index,targetLists)); if(!clones.length) throw new Error('All selected lists already exist in this trip'); const t=Date.now(); set({trips:trips.map(item=>item.id===targetTripId?{...item,lists:[...(Array.isArray(item.lists)?item.lists:createDefaultTripLists(item, get().commonMembers)),...clones],updatedAt:t}:item)}); },
  updateList: (tripId, list) => { const trips=get().trips; const trip=trips.find(t=>t.id===tripId); if(!trip) throw new Error('Trip not found'); const clean=list.name.trim(); if(!clean) throw new Error('List name is required'); const currentLists=Array.isArray(trip.lists)?trip.lists:createDefaultTripLists(trip, get().commonMembers); if(currentLists.some(item=>item.id!==list.id&&item.name.trim().toLowerCase()===clean.toLowerCase())) throw new Error('A list with this name already exists'); const t=Date.now(); set({trips:trips.map(item=>item.id===tripId?{...item,lists:(Array.isArray(item.lists)?item.lists:createDefaultTripLists(item, get().commonMembers)).map(x=>x.id===list.id?{...list,name:clean,tripId,updatedAt:t}:x),updatedAt:t}:item)}); },
  deleteList: (tripId, listId) => { const trips=get().trips; set({trips:trips.map(trip=>trip.id===tripId?{...trip,lists:(Array.isArray(trip.lists)?trip.lists:createDefaultTripLists(trip, get().commonMembers)).filter(list=>list.id!==listId).map((list,index)=>({...list,sortOrder:index})),updatedAt:Date.now()}:trip)}); },
  addListItem: (tripId,listId,title) => { const clean=title.trim(); if(!clean) throw new Error('Item is required'); const trips=get().trips; const trip=trips.find(t=>t.id===tripId); if(!trip) throw new Error('Trip not found'); const lists=Array.isArray(trip.lists)?trip.lists:createDefaultTripLists(trip, get().commonMembers); const target=lists.find(list=>list.id===listId); if(!target) throw new Error('List not found'); const key=listItemKey(clean); const targetAllowsShared = target.name.trim().toLowerCase() === 'medicine' || target.name.trim().toLowerCase().endsWith(' · personal'); const duplicate=lists.some(list=>list.id!==listId&&list.items.some(item=>listItemKey(item.title)===key)); if(duplicate && !targetAllowsShared) throw new Error('This item already exists in another list'); const t=Date.now(); set({trips:trips.map(item=>item.id===tripId?{...item,lists:(Array.isArray(item.lists)?item.lists:createDefaultTripLists(item, get().commonMembers)).map(list=>list.id===listId?{...list,updatedAt:t,items:[...list.items,{id:crypto.randomUUID(),listId,title:clean,completed:false,sortOrder:list.items.length,createdAt:t,updatedAt:t}]}:list),updatedAt:t}:item)}); },
  updateListItem: (tripId,listId,itemId,patch) => {
    const trips=get().trips;
    const t=Date.now();
    set({trips:trips.map(trip=>{
      if(trip.id!==tripId) return trip;
      const lists=Array.isArray(trip.lists)?trip.lists:createDefaultTripLists(trip, get().commonMembers);
      const targetItem=lists.find(list=>list.id===listId)?.items.find(item=>item.id===itemId);
      if(!targetItem) return trip;
      const nextTitle=patch.title?.trim()||targetItem.title;
      const completionChanged=typeof patch.completed==='boolean';
      const nextCompleted=completionChanged?patch.completed:targetItem.completed;
      const key=listItemKey(nextTitle);
      return {
        ...trip,
        lists:lists.map(list=>({
          ...list,
          updatedAt:t,
          items:list.items.map(item=>{
            const isTarget=item.id===itemId&&list.id===listId;
            const isDuplicate=listItemKey(item.title)===key;
            if(!isTarget&&!isDuplicate) return item;
            return {
              ...item,
              ...patch,
              title:isTarget?nextTitle:item.title,
              ...(completionChanged&&isDuplicate?{completed:nextCompleted}:{}),
              updatedAt:t,
            };
          }),
        })),
        updatedAt:t,
      };
    })});
  },
  deleteListItem: (tripId,listId,itemId) => { const trips=get().trips; set({trips:trips.map(trip=>trip.id===tripId?{...trip,lists:trip.lists.map(list=>list.id===listId?{...list,items:list.items.filter(item=>item.id!==itemId).map((item,index)=>({...item,sortOrder:index})),updatedAt:Date.now()}:list),updatedAt:Date.now()}:trip)}); },
  getCurrentTrip: () => { const trips = get().trips; const traveling = trips.find((t) => t.status === 'traveling'); if (traveling) return traveling; return trips.filter((t) => t.status === 'planning').sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null; },
}), {
  // ---------------------------------------------------------------------------
  // Persistence and migration
  // ---------------------------------------------------------------------------

  name: 'vela-core-v2',
  version: 1,
  migrate: (persistedState, _version) => {
      const migrated = migratePersistedState(persistedState);
      if (!isRecord(migrated)) return migrated;
      const trips = Array.isArray(migrated.trips) ? migrated.trips as Trip[] : [];
      const existingMembers = isRecord(migrated) && Array.isArray(migrated.commonMembers) ? migrated.commonMembers as Member[] : [];
      const existingCategories = isRecord(migrated) && Array.isArray(migrated.commonCategories) ? migrated.commonCategories as Category[] : [];
      const existingAccounts = isRecord(migrated) && Array.isArray(migrated.commonAccounts) ? migrated.commonAccounts as Account[] : [];
      const memberMap = new Map<string, Member>();
      for (const member of [...existingMembers, ...trips.flatMap((trip) => trip.members)]) if (!memberMap.has(member.name.trim().toLowerCase())) memberMap.set(member.name.trim().toLowerCase(), { id: crypto.randomUUID(), name: member.name.trim() });
      const categoryMap = new Map<string, Category>();
      for (const category of [...existingCategories, ...trips.flatMap((trip) => trip.categories)]) if (!categoryMap.has(category.name.trim().toLowerCase())) categoryMap.set(category.name.trim().toLowerCase(), { ...category, id: category.id || crypto.randomUUID(), name: category.name.trim() });
      const accountMap = new Map<string, Account>();
      for (const account of [...existingAccounts, ...trips.flatMap((trip) => trip.accounts)]) if (!accountMap.has(account.name.trim().toLowerCase())) accountMap.set(account.name.trim().toLowerCase(), { id: crypto.randomUUID(), name: account.name.trim() });
      return { ...migrated, commonMembers: [...memberMap.values()].filter((item) => item.name), commonCategories: [...categoryMap.values()].filter((item) => item.name), commonAccounts: [...accountMap.values()].filter((item) => item.name) };
    },

  onRehydrateStorage: () => (state, error) => { if (error || !state) return; const migratedTrips = migrateLegacyStorageIfNeeded(state.trips); const normalizedTrips = normalizeTrips(migratedTrips);
    const members = state.commonMembers ?? [];
    const accounts = state.commonAccounts?.length
      ? state.commonAccounts
      : Array.from(
          new Map(
            normalizedTrips
              .flatMap((trip) => trip.accounts)
              .map((account) => [
                account.name.trim().toLowerCase(),
                {
                  id: crypto.randomUUID(),
                  name: account.name.trim(),
                },
              ]),
          ).values(),
        );
    useVelaStore.setState({
      trips: normalizedTrips,
      commonMembers: members,
      commonAccounts: accounts,
    });
    useVelaStore.getState().evaluateAutoStart();
  },
}));
