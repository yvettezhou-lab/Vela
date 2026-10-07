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
import { getLedgerEntryDate } from './travelSegment';
import { findSegmentByDate } from './travelSegment';

export const TRANSPORT_CATEGORY_ID = 'cat_transport';

type EntryDirection = 'expense' | 'income';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const requireFinite = (value: unknown, fieldName: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Domain Violation: ${fieldName} must be a finite number.`);
  }
  return value;
};

const requireString = (value: unknown, fieldName: string): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Domain Violation: ${fieldName} must be a non-empty string.`);
  }
  return value.trim();
};

const requireBoolean = (value: unknown, fieldName: string): boolean => {
  if (typeof value !== 'boolean') {
    throw new Error(`Domain Violation: ${fieldName} must be a boolean.`);
  }
  return value;
};

const requireEntryDirection = (value: unknown): EntryDirection => {
  if (value === 'expense' || value === 'income') return value;
  throw new Error(`Domain Violation: Invalid entryDirection '${value}'`);
};

const requireAllocationMode = (value: unknown): AllocationMode => {
  if (value === 'equal' || value === 'preset_percentage' || value === 'custom_percentage') {
    return value;
  }
  throw new Error(`Domain Violation: Invalid allocationMode '${value}'`);
};

const getArray = (value: unknown, fieldName: string): unknown[] => {
  if (!Array.isArray(value)) {
    throw new Error(`Domain Violation: ${fieldName} must be an array`);
  }
  return value;
};

const parseSegments = (raw: unknown): TravelSegment[] => {
  const segmentsArray = getArray(raw, 'segments');

  if (segmentsArray.length === 0) {
    throw new Error('Domain Violation: Trip must contain at least one TravelSegment');
  }

  const ids = new Set<string>();
  const segments: TravelSegment[] = [];

  for (const rawSegment of segmentsArray) {
    if (!isRecord(rawSegment)) {
      throw new Error('Domain Violation: TravelSegment must be an object');
    }

    const id = requireString(rawSegment.id, 'TravelSegment ID');
    if (ids.has(id)) {
      throw new Error(`Domain Violation: Duplicate TravelSegment ID detected: ${id}`);
    }
    ids.add(id);

    const startDate = requireFinite(rawSegment.startDate, `TravelSegment ${id} startDate`);
    const endDate = requireFinite(rawSegment.endDate, `TravelSegment ${id} endDate`);
    if (startDate > endDate) {
      throw new Error(`Domain Violation: TravelSegment ${id} startDate cannot be after endDate`);
    }

    const destinationsArray = getArray(
      rawSegment.destinations,
      `TravelSegment ${id} destinations`,
    );
    const destinations = destinationsArray.map((rawDestination) => {
      if (!isRecord(rawDestination)) {
        throw new Error('Domain Violation: Destination must be an object');
      }

      const country =
        typeof rawDestination.country === 'string' ? rawDestination.country.trim() : '';
      const region =
        typeof rawDestination.region === 'string' ? rawDestination.region.trim() : '';
      const city = typeof rawDestination.city === 'string' ? rawDestination.city.trim() : '';

      if (!country && !city) {
        throw new Error(
          `Domain Violation: TravelSegment ${id} destination must contain country or city`,
        );
      }

      return {
        country,
        ...(region ? { region } : {}),
        city,
      };
    });

    const segmentCountries = [
      ...new Set(
        destinations
          .map((destination) => destination.country.toLowerCase())
          .filter(Boolean),
      ),
    ];

    if (segmentCountries.length > 1) {
      throw new Error(
        `Domain Violation: TravelSegment ${id} may contain destinations in one country only; create a new segment for another country`,
      );
    }

    const primaryCurrency = requireString(
      rawSegment.primaryCurrency,
      `TravelSegment ${id} primaryCurrency`,
    );

    segments.push({
      id,
      destinations,
      startDate,
      endDate,
      primaryCurrency,
    });
  }

  const ordered = [...segments].sort((a, b) => a.startDate - b.startDate);
  const dayStart = (timestamp: number) => {
    const date = new Date(timestamp);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  };

  for (let index = 1; index < ordered.length; index += 1) {
    if (dayStart(ordered[index].startDate) < dayStart(ordered[index - 1].endDate)) {
      throw new Error(
        `Domain Violation: TravelSegment date ranges cannot overlap (${ordered[index - 1].id} and ${ordered[index].id})`,
      );
    }
  }

  return segments;
};

const parseLists = (raw: unknown, tripId: string): TripList[] => {
  const listsArray = raw === undefined ? [] : getArray(raw, 'lists');
  const listIds = new Set<string>();
  const itemIds = new Set<string>();

  return listsArray.map((rawList, index) => {
    if (!isRecord(rawList)) {
      throw new Error('Domain Violation: TripList must be an object');
    }

    const id = requireString(rawList.id, 'TripList ID');
    if (listIds.has(id)) {
      throw new Error(`Domain Violation: Duplicate TripList ID detected: ${id}`);
    }
    listIds.add(id);

    const listTripId =
      rawList.tripId === undefined
        ? tripId
        : requireString(rawList.tripId, 'TripList tripId');

    if (listTripId !== tripId) {
      throw new Error('Domain Violation: TripList tripId must match Trip ID');
    }

    const name = requireString(rawList.name, 'TripList name');
    const sortOrder =
      rawList.sortOrder === undefined
        ? index
        : requireFinite(rawList.sortOrder, 'TripList sortOrder');
    const createdAt = requireFinite(
      rawList.createdAt ?? Date.now(),
      'TripList createdAt',
    );
    const updatedAt = requireFinite(
      rawList.updatedAt ?? createdAt,
      'TripList updatedAt',
    );

    if (updatedAt < createdAt) {
      throw new Error('Domain Violation: TripList updatedAt cannot be before createdAt');
    }

    const itemsRaw =
      rawList.items === undefined
        ? []
        : getArray(rawList.items, `TripList ${id} items`);

    const items: ListItem[] = itemsRaw.map((rawItem, itemIndex) => {
      if (!isRecord(rawItem)) {
        throw new Error('Domain Violation: ListItem must be an object');
      }

      const itemId = requireString(rawItem.id, 'ListItem ID');
      if (itemIds.has(itemId)) {
        throw new Error(`Domain Violation: Duplicate ListItem ID detected: ${itemId}`);
      }
      itemIds.add(itemId);

      const itemListId =
        rawItem.listId === undefined
          ? id
          : requireString(rawItem.listId, 'ListItem listId');

      if (itemListId !== id) {
        throw new Error('Domain Violation: ListItem listId must match TripList ID');
      }

      const title = requireString(rawItem.title, 'ListItem title');
      const completed =
        rawItem.completed === undefined
          ? false
          : requireBoolean(rawItem.completed, 'ListItem completed');
      const itemSortOrder =
        rawItem.sortOrder === undefined
          ? itemIndex
          : requireFinite(rawItem.sortOrder, 'ListItem sortOrder');
      const itemCreatedAt = requireFinite(
        rawItem.createdAt ?? createdAt,
        'ListItem createdAt',
      );
      const itemUpdatedAt = requireFinite(
        rawItem.updatedAt ?? itemCreatedAt,
        'ListItem updatedAt',
      );

      if (itemUpdatedAt < itemCreatedAt) {
        throw new Error('Domain Violation: ListItem updatedAt cannot be before createdAt');
      }

      const note =
        typeof rawItem.note === 'string' && rawItem.note.trim()
          ? rawItem.note.trim()
          : undefined;

      return {
        id: itemId,
        listId: id,
        title,
        completed,
        sortOrder: itemSortOrder,
        ...(note ? { note } : {}),
        createdAt: itemCreatedAt,
        updatedAt: itemUpdatedAt,
      };
    });

    return {
      id,
      tripId,
      name,
      sortOrder,
      createdAt,
      updatedAt,
      items,
    };
  });
};

const validateLedgerEntryDates = (
  segments: TravelSegment[],
  entry: LedgerEntry,
): void => {
  const relevantDates =
    entry.entryType === 'transport'
      ? entry.journeyType === 'round_trip'
        ? [entry.outboundDate, entry.returnDate]
        : [entry.outboundDate]
      : entry.entryType === 'prepaid_multi_day'
        ? [entry.usageStart, entry.usageEnd]
        : [entry.paymentDate];

  for (const date of relevantDates) {
    if (!findSegmentByDate(segments, date)) {
      throw new Error('Ledger Error: Entry date must fall within a TravelSegment date range');
    }
  }
};

const parseAllocationRules = (
  raw: unknown,
): Trip['allocationRules'] => {
  if (raw === undefined) return undefined;

  if (!isRecord(raw)) {
    throw new Error('Domain Violation: allocationRules must be an object');
  }

  const allocationMode = requireAllocationMode(raw.allocationMode);
  const percentagesRaw = raw.percentages;

  if (percentagesRaw === undefined) {
    return { allocationMode };
  }

  if (!isRecord(percentagesRaw)) {
    throw new Error('Domain Violation: allocationRules.percentages must be an object');
  }

  const percentages: Record<string, number> = {};

  for (const [memberId, value] of Object.entries(percentagesRaw)) {
    if (!memberId.trim()) {
      throw new Error('Domain Violation: allocationRules member ID must be non-empty');
    }

    const percentage = requireFinite(
      value,
      `allocationRules percentage for ${memberId}`,
    );

    if (percentage < 0 || percentage > 100) {
      throw new Error(
        'Domain Violation: allocationRules percentage must be between 0 and 100',
      );
    }

    percentages[memberId] = percentage;
  }

  return {
    allocationMode,
    percentages,
  };
};

const parseMembers = (raw: unknown): Member[] => {
  const members: Member[] = [];
  const memberIds = new Set<string>();

  for (const rawMember of getArray(raw, 'members')) {
    if (!isRecord(rawMember)) {
      throw new Error('Domain Violation: Member must be an object');
    }

    const id = requireString(rawMember.id, 'Member ID');
    if (memberIds.has(id)) {
      throw new Error(`Domain Violation: Duplicate Member ID detected: ${id}`);
    }
    memberIds.add(id);

    members.push({
      id,
      name: requireString(rawMember.name, 'Member Name'),
      ...(rawMember.archived === true ? { archived: true } : {}),
    });
  }

  return members;
};

const parseAccounts = (raw: unknown): Account[] => {
  const accounts: Account[] = [];
  const accountIds = new Set<string>();

  for (const rawAccount of getArray(raw, 'accounts')) {
    if (!isRecord(rawAccount)) {
      throw new Error('Domain Violation: Account must be an object');
    }

    const id = requireString(rawAccount.id, 'Account ID');
    if (accountIds.has(id)) {
      throw new Error(`Domain Violation: Duplicate Account ID detected: ${id}`);
    }
    accountIds.add(id);

    accounts.push({
      id,
      name: requireString(rawAccount.name, 'Account Name'),
      ...(rawAccount.archived === true ? { archived: true } : {}),
    });
  }

  return accounts;
};

const parseCategories = (raw: unknown): Category[] => {
  const categories: Category[] = [];
  const categoryIds = new Set<string>();

  for (const rawCategory of getArray(raw, 'categories')) {
    if (!isRecord(rawCategory)) {
      throw new Error('Domain Violation: Category must be an object');
    }

    const id = requireString(rawCategory.id, 'Category ID');
    if (categoryIds.has(id)) {
      throw new Error(`Domain Violation: Duplicate Category ID detected: ${id}`);
    }
    categoryIds.add(id);

    categories.push({
      id,
      name: requireString(rawCategory.name, 'Category Name'),
      type: requireString(rawCategory.type, 'Category Type'),
      ...(rawCategory.archived === true ? { archived: true } : {}),
      ...(rawCategory.excludeFromStats === true ? { excludeFromStats: true } : {}),
    });
  }

  return categories;
};

const validateAllocation = (
  rawAllocations: unknown,
  cnyEquivalent: number,
  allocationMode: AllocationMode,
  memberIds: Set<string>,
): Allocation[] => {
  const allocationsArray = getArray(rawAllocations, 'allocations');

  if (allocationsArray.length === 0) {
    throw new Error('Invariant Violation: allocations must be a non-empty array');
  }

  const parsedAllocations: Allocation[] = [];
  const seenAllocations = new Set<string>();
  let totalAllocated = 0;
  let totalPercentage = 0;

  for (const rawAllocation of allocationsArray) {
    if (!isRecord(rawAllocation)) {
      throw new Error('Invariant Violation: Allocation must be an object');
    }

    const memberId = requireString(rawAllocation.memberId, 'allocation.memberId');
    if (!memberIds.has(memberId)) {
      throw new Error(`Invariant Violation: Allocated member ${memberId} does not exist`);
    }

    if (seenAllocations.has(memberId)) {
      throw new Error(`Invariant Violation: Duplicate allocation for ${memberId}`);
    }
    seenAllocations.add(memberId);

    const amount = requireFinite(rawAllocation.amount, 'allocation.amount');
    if (amount < 0) {
      throw new Error('Invariant Violation: Allocation amount cannot be negative');
    }

    totalAllocated += amount;

    let percentage: number | undefined;
    if (rawAllocation.percentage !== undefined) {
      percentage = requireFinite(
        rawAllocation.percentage,
        'allocation.percentage',
      );

      if (percentage < 0 || percentage > 100) {
        throw new Error('Invariant Violation: Percentage must be between 0 and 100');
      }

      totalPercentage += percentage;
    }

    parsedAllocations.push({
      memberId,
      amount,
      percentage,
    });
  }

  if (Math.abs(cnyEquivalent - totalAllocated) > 0.001) {
    throw new Error(
      `Invariant Violation: Allocations total (${totalAllocated}) must equal CNY Equivalent (${cnyEquivalent})`,
    );
  }

  if (
    allocationMode === 'custom_percentage' ||
    allocationMode === 'preset_percentage'
  ) {
    for (const allocation of parsedAllocations) {
      if (allocation.percentage === undefined) {
        throw new Error(
          'Invariant Violation: Missing percentage in percentage allocation mode',
        );
      }

      const expectedAmount =
        cnyEquivalent * (allocation.percentage / 100);

      if (Math.abs(allocation.amount - expectedAmount) > 0.02) {
        throw new Error(
          `Invariant Violation: Allocation amount ${allocation.amount} does not match percentage ${allocation.percentage}%`,
        );
      }
    }

    if (Math.abs(totalPercentage - 100) > 0.001) {
      throw new Error('Invariant Violation: Percentages must equal 100%');
    }

    return parsedAllocations;
  }

  const totalCents = Math.round(cnyEquivalent * 100);
  const count = parsedAllocations.length;
  const baseCents = count ? Math.floor(totalCents / count) : 0;
  const remainderCents = count ? totalCents - baseCents * count : 0;

  for (const [index, allocation] of parsedAllocations.entries()) {
    const expectedAmount =
      (baseCents + (index < remainderCents ? 1 : 0)) / 100;

    if (
      Math.round(Math.abs(allocation.amount - expectedAmount) * 100) > 1
    ) {
      throw new Error(
        `Invariant Violation: Equal allocation amount ${allocation.amount} deviates too far from rounded split ${expectedAmount}`,
      );
    }
  }

  return parsedAllocations;
};

const parseBaseLedgerEntry = (
  rawEntry: Record<string, unknown>,
  members: Member[],
  accounts: Account[],
  categories: Category[],
): {
  base: BaseLedgerEntry;
  entryCreatedAt: number;
  entryUpdatedAt: number;
} => {
  const memberIds = new Set(members.map((member) => member.id));
  const accountIds = new Set(accounts.map((account) => account.id));
  const categoryIds = new Set(categories.map((category) => category.id));

  const id = requireString(rawEntry.id, 'entry.id');
  const segmentId =
    rawEntry.segmentId === undefined
      ? undefined
      : requireString(rawEntry.segmentId, 'segmentId');

  const originalAmount = requireFinite(
    rawEntry.originalAmount,
    'originalAmount',
  );
  if (originalAmount <= 0) {
    throw new Error('Invariant Violation: originalAmount must be > 0');
  }

  const cnyEquivalent = requireFinite(
    rawEntry.cnyEquivalent,
    'cnyEquivalent',
  );
  if (cnyEquivalent < 0) {
    throw new Error('Invariant Violation: cnyEquivalent must be >= 0');
  }

  const originalCurrency = requireString(
    rawEntry.originalCurrency,
    'originalCurrency',
  );
  const isRefund = requireBoolean(rawEntry.isRefund, 'isRefund');
  const entryDirection =
    rawEntry.entryDirection === undefined
      ? isRefund
        ? 'income'
        : 'expense'
      : requireEntryDirection(rawEntry.entryDirection);

  if (isRefund && entryDirection !== 'income') {
    throw new Error('Invariant Violation: Refund entries must have income direction');
  }

  const refundOf =
    rawEntry.refundOf === undefined
      ? undefined
      : requireString(rawEntry.refundOf, 'refundOf');

  const isPending = requireBoolean(rawEntry.isPending, 'isPending');
  const allocationMode = requireAllocationMode(rawEntry.allocationMode);
  const entryCreatedAt = requireFinite(rawEntry.createdAt, 'entry.createdAt');
  const entryUpdatedAt = requireFinite(rawEntry.updatedAt, 'entry.updatedAt');

  const payerId = requireString(rawEntry.payerId, 'payerId');
  if (!memberIds.has(payerId)) {
    throw new Error(`Invariant Violation: Payer ${payerId} does not exist in Trip`);
  }

  const accountId = requireString(rawEntry.accountId, 'accountId');
  if (!accountIds.has(accountId)) {
    throw new Error(`Invariant Violation: Account ${accountId} does not exist in Trip`);
  }

  const categoryId = requireString(rawEntry.categoryId, 'categoryId');
  if (!categoryIds.has(categoryId)) {
    throw new Error(`Invariant Violation: Category ${categoryId} does not exist in Trip`);
  }

  const category = categories.find((item) => item.id === categoryId);

  if (!category && categoryId !== 'cat_income' && categoryId !== 'cat_refund') {
    throw new Error(`Invariant Violation: Category ${categoryId} does not exist in Trip`);
  }

  if (
    entryDirection === 'income' &&
    categoryId !== 'cat_income' &&
    categoryId !== 'cat_refund'
  ) {
    throw new Error(
      'Invariant Violation: Income entries must use Income or Refund category',
    );
  }

  if (
    entryDirection === 'expense' &&
    (categoryId === 'cat_income' || categoryId === 'cat_refund')
  ) {
    throw new Error(
      'Invariant Violation: Expense entries cannot use Income or Refund category',
    );
  }

  const includeInCost =
    rawEntry.includeInCost === undefined
      ? category?.excludeFromStats !== true
      : requireBoolean(rawEntry.includeInCost, 'includeInCost');

  const parsedAllocations = validateAllocation(
    rawEntry.allocations,
    cnyEquivalent,
    allocationMode,
    memberIds,
  );

  const note =
    typeof rawEntry.note === 'string' && rawEntry.note.trim()
      ? rawEntry.note.trim()
      : undefined;

  const paidAt =
    rawEntry.paidAt === undefined
      ? (() => {
          const candidate =
            rawEntry.entryType === 'transport' ||
            rawEntry.entryType === 'flight'
              ? rawEntry.paymentDate ?? rawEntry.outboundDate
              : rawEntry.paymentDate;
          return requireFinite(candidate, 'paidAt');
        })()
      : requireFinite(rawEntry.paidAt, 'paidAt');

  return {
    base: {
      id,
      ...(segmentId ? { segmentId } : {}),
      ...(note ? { note } : {}),
      categoryId,
      originalAmount,
      originalCurrency,
      cnyEquivalent,
      includeInCost,
      entryDirection,
      isRefund,
      ...(refundOf ? { refundOf } : {}),
      isPending,
      payerId,
      accountId,
      allocationMode,
      allocations: parsedAllocations,
      createdAt: entryCreatedAt,
      updatedAt: entryUpdatedAt,
      ...(paidAt !== undefined ? { paidAt } : {}),
    },
    entryCreatedAt,
    entryUpdatedAt,
  };
};

const parseLedgerEntry = (
  rawEntry: Record<string, unknown>,
  members: Member[],
  accounts: Account[],
  categories: Category[],
): LedgerEntry => {
  const { base } = parseBaseLedgerEntry(
    rawEntry,
    members,
    accounts,
    categories,
  );

  const entryType = rawEntry.entryType;

  if (entryType === 'standard') {
    return {
      ...base,
      entryType: 'standard',
      paymentDate: requireFinite(rawEntry.paymentDate, 'paymentDate'),
    };
  }

  if (entryType === 'transport' || entryType === 'flight') {
    if (base.categoryId !== TRANSPORT_CATEGORY_ID) {
      throw new Error(
        'Domain Violation: Transport entry must belong to the Transport category.',
      );
    }

    const transportMode = (
      entryType === 'flight' ? 'flight' : rawEntry.transportMode
    ) as TransportMode;

    if (
      transportMode !== 'flight' &&
      transportMode !== 'train' &&
      transportMode !== 'long_distance_bus' &&
      transportMode !== 'ferry'
    ) {
      throw new Error('Domain Violation: Invalid transportMode');
    }

    const outboundDate = requireFinite(
      rawEntry.outboundDate,
      'outboundDate',
    );

    const journeyType = (
      entryType === 'flight'
        ? rawEntry.flightType
        : rawEntry.journeyType
    ) as TransportJourneyType;

    if (journeyType === 'round_trip') {
      if (transportMode === 'long_distance_bus') {
        throw new Error(
          'Domain Violation: Long-distance bus entries are one-way only.',
        );
      }

      const returnDate = requireFinite(rawEntry.returnDate, 'returnDate');

      if (returnDate < outboundDate) {
        throw new Error(
          'Domain Violation: Return date cannot be before outbound date.',
        );
      }

      return {
        ...base,
        entryType: 'transport',
        transportMode,
        journeyType: 'round_trip',
        outboundDate,
        returnDate,
      };
    }

    if (journeyType === 'one_way') {
      return {
        ...base,
        entryType: 'transport',
        transportMode,
        journeyType: 'one_way',
        outboundDate,
      };
    }

    throw new Error('Domain Violation: Invalid journeyType');
  }

  if (entryType === 'prepaid_multi_day') {
    const usageStart = requireFinite(rawEntry.usageStart, 'usageStart');
    const usageEnd = requireFinite(rawEntry.usageEnd, 'usageEnd');

    if (usageEnd < usageStart) {
      throw new Error(
        'Domain Violation: Usage end date cannot be before usage start date.',
      );
    }

    return {
      ...base,
      entryType: 'prepaid_multi_day',
      paymentDate: requireFinite(rawEntry.paymentDate, 'paymentDate'),
      usageStart,
      usageEnd,
    };
  }

  throw new Error(`Domain Violation: Unknown entryType '${entryType}'`);
};

const validateLedgerEntries = (
  ledger: LedgerEntry[],
  segments: TravelSegment[],
): void => {
  for (const entry of ledger) {
    validateLedgerEntryDates(segments, entry);

    if (!entry.segmentId) continue;

    const segment = segments.find((item) => item.id === entry.segmentId);
    if (
      !segment ||
      !findSegmentByDate([segment], getLedgerEntryDate(entry))
    ) {
      throw new Error(
        `Invariant Violation: LedgerEntry ${entry.id} is assigned to a Segment that does not cover its primary date`,
      );
    }
  }
};

const validateRefundLinks = (ledger: LedgerEntry[]): void => {
  for (const entry of ledger) {
    if (!entry.isRefund || !entry.refundOf) continue;

    const original = ledger.find((item) => item.id === entry.refundOf);
    if (!original) {
      throw new Error(
        `Invariant Violation: Refund entry ${entry.id} references missing expense ${entry.refundOf}`,
      );
    }

    if (original.isRefund || original.entryDirection !== 'expense') {
      throw new Error(
        `Invariant Violation: Refund entry ${entry.id} must reference an expense entry`,
      );
    }

    const refunded = ledger
      .filter((item) => item.isRefund && item.refundOf === original.id)
      .reduce((sum, item) => sum + item.cnyEquivalent, 0);

    if (refunded - original.cnyEquivalent > 0.001) {
      throw new Error(
        `Invariant Violation: Refunds for ${original.id} exceed the original expense`,
      );
    }
  }
};

const validateTripStatus = (
  trips: Trip[],
  targetTripId: string,
  newStatus: unknown,
  currentStatus?: unknown,
): void => {
  const transitions: Record<string, string[]> = {
    planning: ['traveling'],
    traveling: ['achieve'],
    achieve: ['traveling'],
  };

  if (typeof newStatus !== 'string' || !transitions[newStatus]) {
    throw new Error(`Lifecycle Violation: Invalid target status '${newStatus}'`);
  }

  if (currentStatus !== undefined) {
    if (
      typeof currentStatus !== 'string' ||
      !transitions[currentStatus]
    ) {
      throw new Error(
        `Lifecycle Violation: Invalid current status '${currentStatus}'`,
      );
    }

    if (!transitions[currentStatus].includes(newStatus)) {
      throw new Error(
        `Lifecycle Violation: Cannot transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  if (
    newStatus === 'traveling' &&
    trips.some((trip) => trip.status === 'traveling' && trip.id !== targetTripId)
  ) {
    throw new Error('Lifecycle Violation: Only one traveling trip allowed');
  }
};

const validateTripBasics = (
  rawTrip: Record<string, unknown>,
  allTrips: Trip[],
): {
  tripId: string;
  title: string;
  segments: TravelSegment[];
  lists: TripList[];
  status: TripStatus;
  allocationRules: Trip['allocationRules'];
  coverImage?: string;
  titleEdited?: boolean;
  createdAt: number;
  updatedAt: number;
} => {
  const tripId = requireString(rawTrip.id, 'Trip ID');

  if (allTrips.some((trip) => trip.id === tripId && trip !== rawTrip)) {
    throw new Error(
      `Domain Violation: Trip ID ${tripId} already exists in the system`,
    );
  }

  const title = requireString(rawTrip.title, 'Trip title');
  const segments = parseSegments(rawTrip.segments);
  const lists = parseLists(rawTrip.lists, tripId);
  const allocationRules = parseAllocationRules(rawTrip.allocationRules);

  validateTripStatus(allTrips, tripId, rawTrip.status);

  if (
    rawTrip.status !== 'planning' &&
    rawTrip.status !== 'traveling' &&
    rawTrip.status !== 'achieve'
  ) {
    throw new Error(
      `Domain Violation: Invalid Trip status '${rawTrip.status}'`,
    );
  }

  const status: TripStatus = rawTrip.status;
  const createdAt = requireFinite(rawTrip.createdAt, 'Trip createdAt');
  const updatedAt = requireFinite(rawTrip.updatedAt, 'Trip updatedAt');

  if (updatedAt < createdAt) {
    throw new Error('Domain Violation: updatedAt cannot be before createdAt');
  }

  return {
    tripId,
    title,
    segments,
    lists,
    status,
    allocationRules,
    coverImage:
      typeof rawTrip.coverImage === 'string'
        ? rawTrip.coverImage
        : undefined,
    titleEdited:
      typeof rawTrip.titleEdited === 'boolean'
        ? rawTrip.titleEdited
        : undefined,
    createdAt,
    updatedAt,
  };
};

export const DomainValidator = {
  validateTripStatus,

  validateEntireTrip: (rawTrip: unknown, allTrips: Trip[]): Trip => {
    if (!isRecord(rawTrip)) {
      throw new Error('Domain Violation: Trip must be an object');
    }

    const basics = validateTripBasics(rawTrip, allTrips);
    const members = parseMembers(rawTrip.members);
    const accounts = parseAccounts(rawTrip.accounts);
    const categories = parseCategories(rawTrip.categories);

    const strictTrip: Trip = {
      id: basics.tripId,
      title: basics.title,
      ...(basics.titleEdited !== undefined
        ? { titleEdited: basics.titleEdited }
        : {}),
      segments: basics.segments,
      status: basics.status,
      allocationRules: basics.allocationRules,
      coverImage: basics.coverImage,
      members,
      accounts,
      categories,
      ledger: [],
      lists: basics.lists,
      createdAt: basics.createdAt,
      updatedAt: basics.updatedAt,
    };

    const ledgerArray = getArray(rawTrip.ledger, 'ledger');
    const ledger: LedgerEntry[] = [];
    const entryIds = new Set<string>();

    for (const rawEntry of ledgerArray) {
      if (!isRecord(rawEntry)) {
        throw new Error('Domain Violation: LedgerEntry must be an object');
      }

      const id = requireString(rawEntry.id, 'entry.id');
      if (entryIds.has(id)) {
        throw new Error(`Domain Violation: Duplicate LedgerEntry ID detected: ${id}`);
      }
      entryIds.add(id);

      const segmentId =
        rawEntry.segmentId === undefined
          ? undefined
          : requireString(rawEntry.segmentId, 'segmentId');

      if (
        segmentId &&
        !basics.segments.some((segment) => segment.id === segmentId)
      ) {
        throw new Error(
          `Invariant Violation: LedgerEntry segment ${segmentId} does not exist in Trip`,
        );
      }

      ledger.push(
        parseLedgerEntry(rawEntry, members, accounts, categories),
      );
    }

    validateLedgerEntries(ledger, basics.segments);
    validateRefundLinks(ledger);

    strictTrip.ledger = ledger;
    return strictTrip;
  },
};
