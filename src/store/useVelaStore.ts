import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Trip, TripStatus } from '../core/domain';
import { getDefaultCategories } from '../core/defaults';
import { DomainValidator, isRecord } from '../core/validation';
import { migrateLegacyPlanToTrip } from '../core/legacyAdapter';

const LEGACY_STORAGE_KEY = 'vela.plan.v1';

const withDefaultCategories = (trip: Trip): Trip =>
  trip.categories.length > 0 ? trip : { ...trip, categories: getDefaultCategories() };

const withDefaultAccountsAndMember = (trip: Trip): Trip => ({
  ...trip,
  accounts: trip.accounts.length > 0
    ? trip.accounts
    : [
        { id: 'default-account-cash', name: 'Cash' },
        { id: 'default-account-credit-card', name: 'Credit Card' },
      ],
  members: trip.members.length > 0
    ? trip.members
    : [{ id: 'default-member-me', name: 'Me' }],
});

const normalizeTrips = (trips: Trip[]): Trip[] =>
  trips.map((trip) => withDefaultAccountsAndMember(withDefaultCategories(trip)));

interface VelaState {
  trips: Trip[];
  addTrip: (rawTrip: unknown) => void;
  updateTripStatus: (tripId: string, newStatus: unknown) => void;
  addLedgerEntry: (tripId: string, rawEntry: unknown) => void;
  updateLedgerEntry: (tripId: string, entryId: string, fullReconstructedEntry: unknown) => void;
  deleteLedgerEntry: (tripId: string, entryId: string) => void;
  getCurrentTrip: () => Trip | null;
}

const migrateLegacyStorageIfNeeded = (currentTrips: Trip[]): Trip[] => {
  if (typeof window === 'undefined' || currentTrips.length > 0) return currentTrips;
  const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return currentTrips;

  let legacyData: unknown;
  try {
    legacyData = JSON.parse(raw);
  } catch (error) {
    console.error('Vela legacy migration skipped: invalid JSON.', error);
    return currentTrips;
  }

  try {
    return [migrateLegacyPlanToTrip(legacyData)];
  } catch (error) {
    console.error('Vela legacy migration failed; legacy data remains untouched.', error);
    return currentTrips;
  }
};

export const useVelaStore = create<VelaState>()(
  persist(
    (set, get) => ({
      trips: [],
      addTrip: (rawTrip: unknown) => {
        const strictTrip = withDefaultAccountsAndMember(
          withDefaultCategories(
            DomainValidator.validateEntireTrip(rawTrip, get().trips),
          ),
        );
        set((state) => ({ trips: [...state.trips, strictTrip] }));
      },
      updateTripStatus: (tripId: string, newStatus: unknown) => {
        const trips = get().trips;
        const trip = trips.find((t) => t.id === tripId);
        if (!trip) throw new Error(`Store Error: Trip ${tripId} not found`);
        DomainValidator.validateTripStatus(trips, tripId, newStatus, trip.status);
        if (newStatus !== 'planning' && newStatus !== 'traveling' && newStatus !== 'achieve') {
          throw new Error(`Store Error: Invalid status ${newStatus}`);
        }
        const status: TripStatus = newStatus;
        set({ trips: trips.map((t) => t.id === tripId ? { ...t, status, updatedAt: Date.now() } : t) });
      },
      addLedgerEntry: (tripId: string, rawEntry: unknown) => {
        const trips = get().trips;
        const tripIndex = trips.findIndex((t) => t.id === tripId);
        if (tripIndex === -1) throw new Error(`Store Error: Trip ${tripId} not found`);
        if (!isRecord(rawEntry)) throw new Error('Store Error: Entry must be an object');
        const now = Date.now();
        const baseTrip = withDefaultAccountsAndMember(withDefaultCategories(trips[tripIndex]));
        const rawClone = { ...rawEntry, createdAt: now, updatedAt: now };
        const tripClone = { ...baseTrip, ledger: [...baseTrip.ledger, rawClone] };
        const strictTrip = DomainValidator.validateEntireTrip(tripClone, trips.filter((t) => t.id !== tripId));
        set((state) => ({ trips: state.trips.map((t) => t.id === tripId ? strictTrip : t) }));
      },
      updateLedgerEntry: (tripId: string, entryId: string, fullReconstructedEntry: unknown) => {
        const trips = get().trips;
        const tripIndex = trips.findIndex((t) => t.id === tripId);
        if (tripIndex === -1) throw new Error(`Store Error: Trip ${tripId} not found`);
        const trip = withDefaultAccountsAndMember(withDefaultCategories(trips[tripIndex]));
        if (!trip.ledger.some((e) => e.id === entryId)) throw new Error(`Store Error: Entry ${entryId} not found in Trip ${tripId}`);
        if (!isRecord(fullReconstructedEntry)) throw new Error('Store Error: Entry must be an object');
        const rawClone = { ...fullReconstructedEntry, updatedAt: Date.now() };
        if (rawClone.id !== entryId) throw new Error(`Store Error: Reconstructed entry ID does not match target ID ${entryId}`);
        const tripClone = { ...trip, ledger: trip.ledger.map((e) => e.id === entryId ? rawClone : e) };
        const strictTrip = DomainValidator.validateEntireTrip(tripClone, trips.filter((t) => t.id !== tripId));
        set((state) => ({ trips: state.trips.map((t) => t.id === tripId ? strictTrip : t) }));
      },
      deleteLedgerEntry: (tripId: string, entryId: string) => {
        const trips = get().trips;
        const trip = trips.find((t) => t.id === tripId);
        if (!trip) throw new Error(`Store Error: Trip ${tripId} not found`);
        if (!trip.ledger.some((e) => e.id === entryId)) throw new Error(`Store Error: Cannot delete nonexistent Entry ${entryId}`);
        set((state) => ({ trips: state.trips.map((t) => t.id === tripId ? { ...t, ledger: t.ledger.filter((e) => e.id !== entryId), updatedAt: Date.now() } : t) }));
      },
      getCurrentTrip: () => {
        const trips = get().trips;
        const traveling = trips.find((t) => t.status === 'traveling');
        if (traveling) return traveling;
        const planningTrips = trips.filter((t) => t.status === 'planning').sort((a, b) => b.updatedAt - a.updatedAt);
        if (planningTrips.length > 0) return planningTrips[0];
        return null;
      },
    }),
    {
      name: 'vela-core-v2',
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) return;
        const migratedTrips = migrateLegacyStorageIfNeeded(state.trips);
        const normalizedTrips = normalizeTrips(migratedTrips);
        if (normalizedTrips !== state.trips) {
          useVelaStore.setState({ trips: normalizedTrips });
        }
      },
    },
  ),
);
