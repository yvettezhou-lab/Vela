export type TripStatus = 'planning' | 'traveling' | 'achieve';
export type AllocationMode = 'equal' | 'preset_percentage' | 'custom_percentage';
export interface Member { id: string; name: string; archived?: boolean; personalListItems?: string[]; }
export interface Account { id: string; name: string; archived?: boolean; }
export interface Category { id: string; name: string; type: string; archived?: boolean; excludeFromStats?: boolean; }
export interface Allocation { memberId: string; percentage?: number; amount: number; }
export interface BaseLedgerEntry { id: string; segmentId?: string; note?: string; categoryId: string; originalAmount: number; originalCurrency: string; cnyEquivalent: number; includeInCost: boolean; isRefund: boolean; isPending: boolean; payerId: string; accountId: string; allocationMode: AllocationMode; allocations: Allocation[]; createdAt: number; updatedAt: number; paidAt?: number; }
export interface StandardEntry extends BaseLedgerEntry { entryType: 'standard'; paymentDate: number; }
export type TransportMode = 'flight' | 'train' | 'long_distance_bus' | 'ferry';
export type TransportJourneyType = 'one_way' | 'round_trip';
export interface TransportOneWay extends BaseLedgerEntry { entryType: 'transport'; transportMode: TransportMode; journeyType: 'one_way'; outboundDate: number; paymentDate?: number; }
export interface TransportRoundTrip extends BaseLedgerEntry { entryType: 'transport'; transportMode: Exclude<TransportMode, 'long_distance_bus'>; journeyType: 'round_trip'; outboundDate: number; returnDate: number; paymentDate?: number; }
// Legacy persisted Flight entries are migrated to Transport entries during rehydration.
export interface LegacyFlightOneWay extends BaseLedgerEntry { entryType: 'flight'; flightType: 'one_way'; outboundDate: number; }
export interface LegacyFlightRoundTrip extends BaseLedgerEntry { entryType: 'flight'; flightType: 'round_trip'; outboundDate: number; returnDate: number; }
export type LegacyFlightEntry = LegacyFlightOneWay | LegacyFlightRoundTrip;
export type TransportEntry = TransportOneWay | TransportRoundTrip;
export interface PrepaidMultiDayEntry extends BaseLedgerEntry { entryType: 'prepaid_multi_day'; paymentDate: number; usageStart: number; usageEnd: number; }
export type LedgerEntry = StandardEntry | TransportEntry | PrepaidMultiDayEntry;
export interface TripFinancialTotals { financialTotal: number; settledAmount: number; pendingAmount: number; }
export interface Destination { country: string; region?: string; city: string; }
export interface TravelSegment { id: string; destinations: Destination[]; startDate: number; endDate: number; primaryCurrency: string; }
export interface ListItem { id: string; listId: string; title: string; completed: boolean; sortOrder: number; note?: string; createdAt: number; updatedAt: number; }
export interface TripList { id: string; tripId: string; name: string; sortOrder: number; createdAt: number; updatedAt: number; items: ListItem[]; }
export interface AllocationRule { allocationMode: 'preset_percentage'; percentages: Record<string, number>; }
export type JourneyCheckResolution = 'self_drive' | 'local_transport' | 'later';
export interface JourneyCheckState { shownCheckpoints?: string[]; resolutions?: Record<string, JourneyCheckResolution>; }
export interface Trip { id: string; title: string; titleEdited?: boolean; segments: TravelSegment[]; status: TripStatus; allocationRules?: AllocationRule; coverImage?: string; members: Member[]; accounts: Account[]; categories: Category[]; ledger: LedgerEntry[]; lists: TripList[]; journeyCheck?: JourneyCheckState; createdAt: number; updatedAt: number; }