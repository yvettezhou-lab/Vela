import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Trip, TripStatus, Member, Account, Category } from '../core/domain';
import { getDefaultCategories } from '../core/defaults';
import { DomainValidator, isRecord } from '../core/validation';
import { migrateLegacyPlanToTrip } from '../core/legacyAdapter';
import { getAutoStartTripId } from '../utils/tripLifecycle';
import { resolveLedgerEntryCurrency } from '../core/travelSegment';
import { refreshAutoTripTitles } from '../utils/tripTitle';

const LEGACY_STORAGE_KEY = 'vela.plan.v1';
const withDefaultCategories = (trip: Trip): Trip => {
  const defaults = getDefaultCategories();
  const categories = trip.categories.map((category) => category.id === 'cat_cash_exchange' ? { ...category, excludeFromStats: true } : category);
  const existing = new Set(categories.map((category) => category.id));
  const missing = defaults.filter((category) => !existing.has(category.id));
  const mergedCategories = missing.length ? [...categories, ...missing] : categories;
  const categoryById = new Map(mergedCategories.map((category) => [category.id, category]));
  const ledger = trip.ledger.map((entry) => entry.includeInCost === undefined
    ? { ...entry, includeInCost: categoryById.get(entry.categoryId)?.excludeFromStats !== true }
    : entry);
  return { ...trip, categories: mergedCategories, ledger }; 
};
const withDefaultAccountsAndMember = (trip: Trip): Trip => ({ ...trip, accounts: trip.accounts.length > 0 ? trip.accounts : [{ id: 'default-account-cash', name: 'Cash' }, { id: 'default-account-credit-card', name: 'Credit Card' }], members: trip.members.length > 0 ? trip.members : [{ id: 'default-member-me', name: 'Me' }] });
const normalizeTrips = (trips: Trip[]): Trip[] => trips.map((trip) => withDefaultAccountsAndMember(withDefaultCategories(trip)));

const migratePersistedTrip = (rawTrip: unknown): Trip => {
  if (!isRecord(rawTrip)) throw new Error('Persisted Trip is not an object');
  if (Array.isArray(rawTrip.segments)) return rawTrip as unknown as Trip;

  // V1.0 persisted trips used flat dates/currency/destination fields.
  // Wrap those fields into the first TravelSegment while preserving the
  // already-normalized ledger/member/account/category data byte-for-byte.
  const startDate = Number(rawTrip.startDate);
  const endDate = Number(rawTrip.endDate);
  const currency = typeof rawTrip.localCurrency === 'string' ? rawTrip.localCurrency.trim() : '';
  const destination = typeof rawTrip.destination === 'string' ? rawTrip.destination.trim() : '';
  if (!Number.isFinite(startDate) || !Number.isFinite(endDate) || startDate > endDate || !currency) {
    throw new Error('Persisted Trip has invalid legacy segment fields');
  }

  return DomainValidator.validateEntireTrip({
    ...rawTrip,
    segments: [{
      id: `${String(rawTrip.id)}-segment-1`,
      destinations: destination ? [{ country: '', city: destination }] : [],
      startDate,
      endDate,
      primaryCurrency: currency,
    }],
  });
};

const migratePersistedState = (persistedState: unknown): unknown => {
  if (!isRecord(persistedState) || !Array.isArray(persistedState.trips)) return persistedState;
  const trips = persistedState.trips.map(migratePersistedTrip);
  return { ...persistedState, trips };
};

export type MasterDataType = 'members' | 'categories' | 'accounts';
export type MasterDataItem = Member | Category | Account;

interface VelaState {
  trips: Trip[];
  commonMembers: Member[];
  commonAccounts: Account[];
  addTrip: (rawTrip: unknown) => void;
  updateTripStatus: (tripId: string, newStatus: unknown) => void;
  updateTrip: (tripId: string, trip: Trip) => void;
  updateTripDates: (tripId: string, startDate: number, endDate: number) => void;
  evaluateAutoStart: (now?: number) => void;
  addLedgerEntry: (tripId: string, rawEntry: unknown) => void;
  updateLedgerEntry: (tripId: string, entryId: string, fullReconstructedEntry: unknown) => void;
  deleteLedgerEntry: (tripId: string, entryId: string) => void;
  updateMasterData: (tripId: string, type: MasterDataType, id: string | null, item: MasterDataItem) => void;
  archiveMasterData: (tripId: string, type: MasterDataType, id: string) => void;
  addCommonMember: (name: string) => void;
  renameCommonMember: (id: string, name: string) => void;
  archiveCommonMember: (id: string) => void;
  addCommonAccount: (name: string) => void;
  renameCommonAccount: (id: string, name: string) => void;
  archiveCommonAccount: (id: string) => void;
  getCurrentTrip: () => Trip | null;
}

const migrateLegacyStorageIfNeeded = (currentTrips: Trip[]): Trip[] => {
  if (typeof window === 'undefined' || currentTrips.length > 0) return currentTrips;
  const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY); if (!raw) return currentTrips;
  let legacyData: unknown; try { legacyData = JSON.parse(raw); } catch (error) { console.error('Vela legacy migration skipped: invalid JSON.', error); return currentTrips; }
  try { return [migrateLegacyPlanToTrip(legacyData)]; } catch (error) { console.error('Vela legacy migration failed; legacy data remains untouched.', error); return currentTrips; }
};

const replaceMasterData = (trip: Trip, type: MasterDataType, id: string | null, item: MasterDataItem): Trip => {
  const collection = trip[type];
  const next = id ? collection.map((entry) => entry.id === id ? item : entry) : [...collection, item];
  return { ...trip, [type]: next, updatedAt: Date.now() } as Trip;
};

export const useVelaStore = create<VelaState>()(persist((set, get) => ({
  trips: [],
  commonMembers: [{ id: 'common-member-me', name: 'Me' }],
  commonAccounts: [{ id: 'common-account-cash', name: 'Cash' }, { id: 'common-account-credit-card', name: 'Credit Card' }],
  addTrip: (rawTrip) => { const strictTrip = withDefaultAccountsAndMember(withDefaultCategories(DomainValidator.validateEntireTrip(rawTrip, get().trips))); const refreshedTrips = refreshAutoTripTitles([...get().trips, strictTrip]); set({ trips: refreshedTrips }); get().evaluateAutoStart(); },
  updateTrip: (tripId, trip) => { const trips = get().trips; if (!trips.some((item) => item.id === tripId)) throw new Error(`Store Error: Trip ${tripId} not found`); const strictTrip = DomainValidator.validateEntireTrip({ ...trip, id: tripId, updatedAt: Date.now() }, trips.filter((item) => item.id !== tripId)); const refreshedTrips = refreshAutoTripTitles(trips.map((item) => item.id === tripId ? strictTrip : item)); set({ trips: refreshedTrips }); },
  updateTripStatus: (tripId, newStatus) => { const trips = get().trips; const trip = trips.find((t) => t.id === tripId); if (!trip) throw new Error(`Store Error: Trip ${tripId} not found`); DomainValidator.validateTripStatus(trips, tripId, newStatus, trip.status); if (newStatus !== 'planning' && newStatus !== 'traveling' && newStatus !== 'achieve') throw new Error(`Store Error: Invalid status ${newStatus}`); set({ trips: trips.map((t) => t.id === tripId ? { ...t, status: newStatus as TripStatus, updatedAt: Date.now() } : t) }); },
  updateTripDates: (tripId, startDate, endDate) => { if (!Number.isFinite(startDate) || !Number.isFinite(endDate)) throw new Error('Store Error: Trip dates must be finite numbers'); if (startDate > endDate) throw new Error('Store Error: Start date cannot be after end date'); const trips = get().trips; const trip = trips.find((t) => t.id === tripId); if (!trip) throw new Error(`Store Error: Trip ${tripId} not found`); if (trip.segments.length === 0) throw new Error(`Store Error: Trip ${tripId} has no TravelSegment`); const updatedSegments = trip.segments.map((segment, index) => index === 0 ? { ...segment, startDate, endDate } : segment); const strictTrip = DomainValidator.validateEntireTrip({ ...trip, segments: updatedSegments, updatedAt: Date.now() }, trips.filter((t) => t.id !== tripId)); set((state) => ({ trips: state.trips.map((t) => t.id === tripId ? strictTrip : t) })); get().evaluateAutoStart(); },
  evaluateAutoStart: (now = Date.now()) => { const trips = get().trips; const candidateId = getAutoStartTripId(trips, now); if (!candidateId) return; const candidate = trips.find((trip) => trip.id === candidateId); if (!candidate) return; DomainValidator.validateTripStatus(trips, candidate.id, 'traveling', candidate.status); set((state) => ({ trips: state.trips.map((trip) => trip.id === candidate.id ? { ...trip, status: 'traveling', updatedAt: Date.now() } : trip) })); },
  addLedgerEntry: (tripId, rawEntry) => { const trips = get().trips; const tripIndex = trips.findIndex((t) => t.id === tripId); if (tripIndex === -1) throw new Error(`Store Error: Trip ${tripId} not found`); if (!isRecord(rawEntry)) throw new Error('Store Error: Entry must be an object'); const baseTrip = withDefaultAccountsAndMember(withDefaultCategories(trips[tripIndex])); const now = Date.now(); const candidateEntry = { ...rawEntry, createdAt: now, updatedAt: now } as any; const resolvedCurrency = resolveLedgerEntryCurrency(baseTrip.segments, candidateEntry); const requestedCurrency = typeof candidateEntry.originalCurrency === 'string' ? candidateEntry.originalCurrency.trim().toUpperCase() : ''; const currencyResolvedEntry = { ...candidateEntry, originalCurrency: requestedCurrency || resolvedCurrency }; const strictTrip = DomainValidator.validateEntireTrip({ ...baseTrip, ledger: [...baseTrip.ledger, currencyResolvedEntry] }, trips.filter((t) => t.id !== tripId)); set((state) => ({ trips: state.trips.map((t) => t.id === tripId ? strictTrip : t) })); },
  updateLedgerEntry: (tripId, entryId, fullReconstructedEntry) => { const trips = get().trips; const tripIndex = trips.findIndex((t) => t.id === tripId); if (tripIndex === -1) throw new Error(`Store Error: Trip ${tripId} not found`); const trip = withDefaultAccountsAndMember(withDefaultCategories(trips[tripIndex])); if (!trip.ledger.some((e) => e.id === entryId)) throw new Error(`Store Error: Entry ${entryId} not found in Trip ${tripId}`); if (!isRecord(fullReconstructedEntry)) throw new Error('Store Error: Entry must be an object'); const rawClone = { ...fullReconstructedEntry, updatedAt: Date.now() } as any; if (rawClone.id !== entryId) throw new Error(`Store Error: Reconstructed entry ID does not match target ID ${entryId}`); const resolvedCurrency = resolveLedgerEntryCurrency(trip.segments, rawClone); const requestedCurrency = typeof rawClone.originalCurrency === 'string' ? rawClone.originalCurrency.trim().toUpperCase() : ''; const currencyResolvedEntry = { ...rawClone, originalCurrency: requestedCurrency || resolvedCurrency }; const strictTrip = DomainValidator.validateEntireTrip({ ...trip, ledger: trip.ledger.map((e) => e.id === entryId ? currencyResolvedEntry : e) }, trips.filter((t) => t.id !== tripId)); set((state) => ({ trips: state.trips.map((t) => t.id === tripId ? strictTrip : t) })); },
  deleteLedgerEntry: (tripId, entryId) => { const trips = get().trips; const trip = trips.find((t) => t.id === tripId); if (!trip) throw new Error(`Store Error: Trip ${tripId} not found`); if (!trip.ledger.some((e) => e.id === entryId)) throw new Error(`Store Error: Cannot delete nonexistent Entry ${entryId}`); set((state) => ({ trips: state.trips.map((t) => t.id === tripId ? { ...t, ledger: t.ledger.filter((e) => e.id !== entryId), updatedAt: Date.now() } : t) })); },
  updateMasterData: (tripId, type, id, item) => { const trips = get().trips; const trip = trips.find((t) => t.id === tripId); if (!trip) throw new Error(`Store Error: Trip ${tripId} not found`); if (id && !trip[type].some((entry) => entry.id === id)) throw new Error(`Master Data Error: ${type} ${id} not found`); if (!item.name.trim()) throw new Error('Master Data Error: Name is required'); if (id && item.id !== id) throw new Error('Master Data Error: ID cannot change'); if (!id && trip[type].some((entry) => entry.name.trim().toLowerCase() === item.name.trim().toLowerCase() && !entry.archived)) throw new Error('Master Data Error: An active item with this name already exists'); set({ trips: trips.map((t) => t.id === tripId ? replaceMasterData(t, type, id, { ...item, name: item.name.trim() }) : t) }); },
  archiveMasterData: (tripId, type, id) => { const trips = get().trips; const trip = trips.find((t) => t.id === tripId); if (!trip) throw new Error(`Trip ${tripId} not found`); const entry = trip[type].find((item) => item.id === id); if (!entry) throw new Error(`Master Data Error: ${type} ${id} not found`); set({ trips: trips.map((t) => t.id === tripId ? { ...t, [type]: t[type].map((item) => item.id === id ? { ...item, archived: true } : item), updatedAt: Date.now() } : t) }); },
  addCommonMember: (name) => { const clean = name.trim(); if (!clean) throw new Error('Common person name is required'); const current = get().commonMembers; if (current.some((item) => !item.archived && item.name.toLowerCase() === clean.toLowerCase())) throw new Error('A common person with this name already exists'); set({ commonMembers: [...current, { id: crypto.randomUUID(), name: clean }] }); },
  renameCommonMember: (id, name) => { const clean = name.trim(); if (!clean) throw new Error('Common person name is required'); set({ commonMembers: get().commonMembers.map((item) => item.id === id ? { ...item, name: clean } : item) }); },
  archiveCommonMember: (id) => set({ commonMembers: get().commonMembers.map((item) => item.id === id ? { ...item, archived: true } : item) }),
  addCommonAccount: (name) => { const clean = name.trim(); if (!clean) throw new Error('Account name is required'); const current = get().commonAccounts; if (current.some((item) => !item.archived && item.name.toLowerCase() === clean.toLowerCase())) throw new Error('An account with this name already exists'); set({ commonAccounts: [...current, { id: crypto.randomUUID(), name: clean }] }); },
  renameCommonAccount: (id, name) => { const clean = name.trim(); if (!clean) throw new Error('Account name is required'); set({ commonAccounts: get().commonAccounts.map((item) => item.id === id ? { ...item, name: clean } : item) }); },
  archiveCommonAccount: (id) => set({ commonAccounts: get().commonAccounts.map((item) => item.id === id ? { ...item, archived: true } : item) }),
  getCurrentTrip: () => { const trips = get().trips; const traveling = trips.find((t) => t.status === 'traveling'); if (traveling) return traveling; return trips.filter((t) => t.status === 'planning').sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null; },
}), { name: 'vela-core-v2', version: 1, migrate: (persistedState, _version) => {
      const migrated = migratePersistedState(persistedState);
      if (!isRecord(migrated)) return migrated;
      const trips = Array.isArray(migrated.trips) ? migrated.trips as Trip[] : [];
      const existingMembers = isRecord(migrated) && Array.isArray(migrated.commonMembers) ? migrated.commonMembers as Member[] : [];
      const existingAccounts = isRecord(migrated) && Array.isArray(migrated.commonAccounts) ? migrated.commonAccounts as Account[] : [];
      const memberMap = new Map<string, Member>();
      for (const member of [...existingMembers, ...trips.flatMap((trip) => trip.members)]) if (!memberMap.has(member.name.trim().toLowerCase())) memberMap.set(member.name.trim().toLowerCase(), { id: crypto.randomUUID(), name: member.name.trim() });
      const accountMap = new Map<string, Account>();
      for (const account of [...existingAccounts, ...trips.flatMap((trip) => trip.accounts)]) if (!accountMap.has(account.name.trim().toLowerCase())) accountMap.set(account.name.trim().toLowerCase(), { id: crypto.randomUUID(), name: account.name.trim() });
      return { ...migrated, commonMembers: [...memberMap.values()].filter((item) => item.name), commonAccounts: [...accountMap.values()].filter((item) => item.name) };
    }, onRehydrateStorage: () => (state, error) => { if (error || !state) return; const migratedTrips = migrateLegacyStorageIfNeeded(state.trips); const normalizedTrips = normalizeTrips(migratedTrips);
      const members = state.commonMembers?.length ? state.commonMembers : Array.from(new Map(normalizedTrips.flatMap((trip) => trip.members).map((member) => [member.name.trim().toLowerCase(), { id: crypto.randomUUID(), name: member.name.trim() }])).values());
      const accounts = state.commonAccounts?.length ? state.commonAccounts : Array.from(new Map(normalizedTrips.flatMap((trip) => trip.accounts).map((account) => [account.name.trim().toLowerCase(), { id: crypto.randomUUID(), name: account.name.trim() }])).values());
      useVelaStore.setState({ trips: normalizedTrips, commonMembers: members, commonAccounts: accounts });
      useVelaStore.getState().evaluateAutoStart(); } }));
