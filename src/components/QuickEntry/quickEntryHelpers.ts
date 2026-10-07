import { LedgerEntry, Trip } from '../../core/domain';

export const getNearestTrips = (trips: Trip[]) => {
  const eligibleTrips = trips.filter(
    (trip) => trip && (trip.status === 'traveling' || trip.status === 'planning'),
  );
  const currentTrip = eligibleTrips.find((trip) => trip.status === 'traveling') ?? null;
  const nearestTrips = eligibleTrips
    .filter((trip) => trip.id !== currentTrip?.id)
    .sort((a, b) => {
      const aStart = Math.min(
        ...(a.segments ?? [])
          .map((segment) => segment.startDate)
          .filter(Number.isFinite),
      );
      const bStart = Math.min(
        ...(b.segments ?? [])
          .map((segment) => segment.startDate)
          .filter(Number.isFinite),
      );
      return aStart - bStart;
    });

  return {
    eligibleTrips,
    currentTrip,
    tripChoices: currentTrip
      ? [currentTrip, ...nearestTrips].slice(0, 4)
      : nearestTrips.slice(0, 4),
  };
};

export const isDomesticTrip = (trip: Trip | null) =>
  Boolean(trip?.segments?.length) &&
  trip.segments.every(
    (segment) =>
      segment.destinations?.length > 0 &&
      segment.destinations.every((destination) =>
        ['china', '中国'].includes(destination.country.trim().toLowerCase()),
      ),
  );

export const getTripDateBounds = (trip: Trip | null) => {
  if (!trip?.segments?.length) {
    return {
      minDate: undefined as string | undefined,
      maxDate: undefined as string | undefined,
    };
  }

  const starts = trip.segments
    .map((segment) => segment.startDate)
    .filter(Number.isFinite);
  const ends = trip.segments
    .map((segment) => segment.endDate)
    .filter(Number.isFinite);

  if (!starts.length || !ends.length) {
    return {
      minDate: undefined as string | undefined,
      maxDate: undefined as string | undefined,
    };
  }

  const toDateValue = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    minDate: toDateValue(new Date(Math.min(...starts))),
    maxDate: toDateValue(new Date(Math.max(...ends))),
  };
};

export const getRefundOptions = (
  trip: Trip | null,
  initialEntry: LedgerEntry | null | undefined,
) => {
  if (!trip) return [];

  return trip.ledger
    .filter((entry) => entry.entryDirection !== 'income' && !entry.isRefund)
    .map((entry) => {
      const refunded = trip.ledger
        .filter((item) => item.isRefund && item.refundOf === entry.id)
        .reduce((sum, item) => sum + item.cnyEquivalent, 0);
      const current = initialEntry?.refundOf === entry.id
        ? initialEntry.cnyEquivalent
        : 0;

      return {
        entry,
        remaining: Math.max(0, entry.cnyEquivalent - refunded + current),
      };
    })
    .filter((item) => item.remaining > 0.001);
};

export const getLastUsedIds = (
  trip: Trip | null,
  field: 'accountId' | 'payerId',
) => {
  const lastUsedAt = new Map<string, number>();

  if (field === 'accountId') {
    (trip?.ledger ?? []).forEach((entry) => {
      if (!entry.accountId) return;
      lastUsedAt.set(
        entry.accountId,
        Math.max(lastUsedAt.get(entry.accountId) ?? 0, entry.createdAt ?? 0),
      );
    });
  } else {
    (trip?.ledger ?? []).forEach((entry) => {
      if (!entry.payerId) return;
      lastUsedAt.set(
        entry.payerId,
        Math.max(lastUsedAt.get(entry.payerId) ?? 0, entry.createdAt ?? 0),
      );
    });
  }

  return lastUsedAt;
};
