import { Trip, TripStatus, AllocationMode, Member, Account, Category, Allocation, BaseLedgerEntry, LedgerEntry } from './domain';
export const TRANSPORT_CATEGORY_ID = 'cat_transport';
export const isRecord = (val: unknown): val is Record<string, unknown> => typeof val === 'object' && val !== null && !Array.isArray(val);
const requireFinite = (val: unknown, fieldName: string): number => {
if (typeof val !== 'number' || !Number.isFinite(val)) throw new Error(`Domain Violation: ${fieldName} must be a finite number.`);
return val;
};
const requireString = (val: unknown, fieldName: string): string => {
if (typeof val !== 'string' || val.trim() === '') throw new Error(`Domain Violation: ${fieldName} must be a non-empty string.`);
return val.trim();
};
const requireBoolean = (val: unknown, fieldName: string): boolean => {
if (typeof val !== 'boolean') throw new Error(`Domain Violation: ${fieldName} must be a boolean.`);
return val;
};
const requireAllocationMode = (val: unknown): AllocationMode => {
if (val === 'equal' || val === 'custom_percentage') return val;
throw new Error(`Domain Violation: Invalid allocationMode '${val}'`);
};
const getArray = (val: unknown, fieldName: string): unknown[] => {
if (!Array.isArray(val)) throw new Error(`Domain Violation: ${fieldName} must be an array`);
return val;
};
export const DomainValidator = {
validateTripStatus: (trips: Trip[], targetTripId: string, newStatus: unknown, currentStatus?: unknown) => {
const transitions: Record<string, string[]> = {'planning': ['traveling', 'achieve'], 'traveling': ['achieve'], 'achieve': []};
if (typeof newStatus !== 'string' || !transitions[newStatus]) throw new Error(`Lifecycle Violation: Invalid target status '${newStatus}'`);
if (currentStatus !== undefined) {
if (typeof currentStatus !== 'string' || !transitions[currentStatus]) throw new Error(`Lifecycle Violation: Invalid current status '${currentStatus}'`);
if (!transitions[currentStatus].includes(newStatus)) throw new Error(`Lifecycle Violation: Cannot transition from ${currentStatus} to ${newStatus}`);
}
if (newStatus === 'traveling') {
const active = trips.find(t => t.status === 'traveling' && t.id !== targetTripId);
if (active) throw new Error('Lifecycle Violation: Only one traveling trip allowed');
}
},
validateEntireTrip: (rawTrip: unknown, allTrips: Trip[]): Trip => {
if (!isRecord(rawTrip)) throw new Error('Domain Violation: Trip must be an object');
const tripId = requireString(rawTrip.id, 'Trip ID');
if (allTrips.some(t => t.id === tripId && t !== rawTrip)) throw new Error(`Domain Violation: Trip ID ${tripId} already exists in the system`);
const title = requireString(rawTrip.title, 'Trip title');
const localCurrency = requireString(rawTrip.localCurrency, 'Trip localCurrency');
const destination = typeof rawTrip.destination === 'string' ? rawTrip.destination : '';
const coverImage = typeof rawTrip.coverImage === 'string' ? rawTrip.coverImage : undefined;
const members: Member[] = [];
const memberIds = new Set<string>();
for (const m of getArray(rawTrip.members, 'members')) {
if (!isRecord(m)) throw new Error('Domain Violation: Member must be an object');
const id = requireString(m.id, 'Member ID');
if (memberIds.has(id)) throw new Error(`Domain Violation: Duplicate Member ID detected: ${id}`);
memberIds.add(id); members.push({ id, name: requireString(m.name, 'Member Name') });
}
const accounts: Account[] = [];
const accountIds = new Set<string>();
for (const a of getArray(rawTrip.accounts, 'accounts')) {
if (!isRecord(a)) throw new Error('Domain Violation: Account must be an object');
const id = requireString(a.id, 'Account ID');
if (accountIds.has(id)) throw new Error(`Domain Violation: Duplicate Account ID detected: ${id}`);
accountIds.add(id); accounts.push({ id, name: requireString(a.name, 'Account Name') });
}
const categories: Category[] = [];
const categoryIds = new Set<string>();
for (const c of getArray(rawTrip.categories, 'categories')) {
if (!isRecord(c)) throw new Error('Domain Violation: Category must be an object');
const id = requireString(c.id, 'Category ID');
if (categoryIds.has(id)) throw new Error(`Domain Violation: Duplicate Category ID detected: ${id}`);
categoryIds.add(id); categories.push({ id, name: requireString(c.name, 'Category Name'), type: requireString(c.type, 'Category Type') });
}
DomainValidator.validateTripStatus(allTrips, tripId, rawTrip.status);
const statusValue = rawTrip.status;
if (statusValue !== 'planning' && statusValue !== 'traveling' && statusValue !== 'achieve') throw new Error(`Domain Violation: Invalid Trip status '${statusValue}'`);
const status: TripStatus = statusValue;
const startDate = requireFinite(rawTrip.startDate, 'Trip startDate');
const endDate = requireFinite(rawTrip.endDate, 'Trip endDate');
if (startDate > endDate) throw new Error('Domain Violation: startDate cannot be after endDate');
const createdAt = requireFinite(rawTrip.createdAt, 'Trip createdAt');
const updatedAt = requireFinite(rawTrip.updatedAt, 'Trip updatedAt');
if (updatedAt < createdAt) throw new Error('Domain Violation: updatedAt cannot be before createdAt');
const strictTrip: Trip = { id: tripId, title, destination, startDate, endDate, status, localCurrency, coverImage, members, accounts, categories, ledger: [], createdAt, updatedAt };
const ledgerArray = getArray(rawTrip.ledger, 'ledger');
const ledger: LedgerEntry[] = [];
const entryIds = new Set<string>();
for (const rawEntry of ledgerArray) {
if (!isRecord(rawEntry)) throw new Error('Domain Violation: LedgerEntry must be an object');
const id = requireString(rawEntry.id, 'entry.id');
if (entryIds.has(id)) throw new Error(`Domain Violation: Duplicate LedgerEntry ID detected: ${id}`);
entryIds.add(id);
const originalAmount = requireFinite(rawEntry.originalAmount, 'originalAmount');
if (originalAmount <= 0) throw new Error('Invariant Violation: originalAmount must be > 0');
const cnyEquivalent = requireFinite(rawEntry.cnyEquivalent, 'cnyEquivalent');
if (cnyEquivalent < 0) throw new Error('Invariant Violation: cnyEquivalent must be >= 0');
const originalCurrency = requireString(rawEntry.originalCurrency, 'originalCurrency');
const isRefund = requireBoolean(rawEntry.isRefund, 'isRefund');
const isPending = requireBoolean(rawEntry.isPending, 'isPending');
const allocationMode = requireAllocationMode(rawEntry.allocationMode);
const entryCreatedAt = requireFinite(rawEntry.createdAt, 'entry.createdAt');
const entryUpdatedAt = requireFinite(rawEntry.updatedAt, 'entry.updatedAt');
const payerId = requireString(rawEntry.payerId, 'payerId');
if (!memberIds.has(payerId)) throw new Error(`Invariant Violation: Payer ${payerId} does not exist in Trip`);
const accountId = requireString(rawEntry.accountId, 'accountId');
if (!accountIds.has(accountId)) throw new Error(`Invariant Violation: Account ${accountId} does not exist in Trip`);
const categoryId = requireString(rawEntry.categoryId, 'categoryId');
if (!categoryIds.has(categoryId)) throw new Error(`Invariant Violation: Category ${categoryId} does not exist in Trip`);
const allocationsArray = getArray(rawEntry.allocations, 'allocations');
if (allocationsArray.length === 0) throw new Error('Invariant Violation: allocations must be a non-empty array');
const parsedAllocations: Allocation[] = [];
const seenAllocations = new Set<string>();
let totalAllocated = 0;
let totalPercentage = 0;
for (const rawAlloc of allocationsArray) {
if (!isRecord(rawAlloc)) throw new Error('Invariant Violation: Allocation must be an object');
const memberId = requireString(rawAlloc.memberId, 'allocation.memberId');
if (!memberIds.has(memberId)) throw new Error(`Invariant Violation: Allocated member ${memberId} does not exist`);
if (seenAllocations.has(memberId)) throw new Error(`Invariant Violation: Duplicate allocation for ${memberId}`);
seenAllocations.add(memberId);
const amount = requireFinite(rawAlloc.amount, 'allocation.amount');
if (amount < 0) throw new Error('Invariant Violation: Allocation amount cannot be negative');
totalAllocated += amount;
let percentage: number | undefined;
if (rawAlloc.percentage !== undefined) { percentage = requireFinite(rawAlloc.percentage, 'allocation.percentage'); if (percentage < 0 || percentage > 100) throw new Error('Invariant Violation: Percentage must be between 0 and 100'); totalPercentage += percentage; }
parsedAllocations.push({ memberId, amount, percentage });
}
if (Math.abs(cnyEquivalent - totalAllocated) > 0.001) throw new Error(`Invariant Violation: Allocations total (${totalAllocated}) must equal CNY Equivalent (${cnyEquivalent})`);
if (allocationMode === 'custom_percentage') {
for (const alloc of parsedAllocations) { if (alloc.percentage === undefined) throw new Error('Invariant Violation: Missing percentage in custom mode'); const expectedAmount = cnyEquivalent * (alloc.percentage / 100); if (Math.abs(alloc.amount - expectedAmount) > 0.02) throw new Error(`Invariant Violation: Allocation amount ${alloc.amount} does not match percentage ${alloc.percentage}%`); }
if (Math.abs(totalPercentage - 100) > 0.001) throw new Error('Invariant Violation: Custom percentages must equal 100%');
} else {
const expectedBase = cnyEquivalent / parsedAllocations.length;
for (const alloc of parsedAllocations) if (Math.abs(alloc.amount - expectedBase) > 0.02) throw new Error(`Invariant Violation: Equal allocation amount ${alloc.amount} deviates too far from base split ${expectedBase}`);
}
const baseLedgerEntry: BaseLedgerEntry = { id, categoryId, originalAmount, originalCurrency, cnyEquivalent, isRefund, isPending, payerId, accountId, allocationMode, allocations: parsedAllocations, createdAt: entryCreatedAt, updatedAt: entryUpdatedAt };
if (rawEntry.entryType === 'standard') ledger.push({ ...baseLedgerEntry, entryType: 'standard', paymentDate: requireFinite(rawEntry.paymentDate, 'paymentDate') });
else if (rawEntry.entryType === 'flight') {
if (categoryId !== TRANSPORT_CATEGORY_ID) throw new Error('Domain Violation: Flight entry must belong to the Transport category.');
const outboundDate = requireFinite(rawEntry.outboundDate, 'outboundDate');
if (rawEntry.flightType === 'round_trip') { const returnDate = requireFinite(rawEntry.returnDate, 'returnDate'); if (returnDate < outboundDate) throw new Error('Domain Violation: Return date cannot be before outbound date.'); ledger.push({ ...baseLedgerEntry, entryType: 'flight', flightType: 'round_trip', outboundDate, returnDate }); }
else if (rawEntry.flightType === 'one_way') ledger.push({ ...baseLedgerEntry, entryType: 'flight', flightType: 'one_way', outboundDate });
else throw new Error('Domain Violation: Invalid flightType');
} else if (rawEntry.entryType === 'prepaid_multi_day') { const usageStart = requireFinite(rawEntry.usageStart, 'usageStart'); const usageEnd = requireFinite(rawEntry.usageEnd, 'usageEnd'); if (usageEnd < usageStart) throw new Error('Domain Violation: Usage end date cannot be before usage start date.'); ledger.push({ ...baseLedgerEntry, entryType: 'prepaid_multi_day', paymentDate: requireFinite(rawEntry.paymentDate, 'paymentDate'), usageStart, usageEnd }); }
else throw new Error(`Domain Violation: Unknown entryType '${rawEntry.entryType}'`);
}
strictTrip.ledger = ledger;
return strictTrip;
}
};