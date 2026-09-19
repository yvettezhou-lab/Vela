export type TripStatus = 'planning' | 'traveling' | 'achieve';
export type AllocationMode = 'equal' | 'custom_percentage';
export type FlightType = 'one_way' | 'round_trip';
export type CashExchangeType = 'cash_withdrawal' | 'currency_exchange';
export interface Member { id: string; name: string; archived?: boolean; }
export interface Account { id: string; name: string; archived?: boolean; }
export interface Category { id: string; name: string; type: string; archived?: boolean; excludeFromStats?: boolean; }
export interface Allocation { memberId: string; percentage?: number; amount: number; }
export interface BaseLedgerEntry { id: string; categoryId: string; originalAmount: number; originalCurrency: string; cnyEquivalent: number; isRefund: boolean; isPending: boolean; payerId: string; accountId: string; allocationMode: AllocationMode; allocations: Allocation[]; createdAt: number; updatedAt: number; }
export interface StandardEntry extends BaseLedgerEntry { entryType: 'standard'; paymentDate: number; }
export interface FlightOneWay extends BaseLedgerEntry { entryType: 'flight'; flightType: 'one_way'; outboundDate: number; }
export interface FlightRoundTrip extends BaseLedgerEntry { entryType: 'flight'; flightType: 'round_trip'; outboundDate: number; returnDate: number; }
export interface PrepaidMultiDayEntry extends BaseLedgerEntry { entryType: 'prepaid_multi_day'; paymentDate: number; usageStart: number; usageEnd: number; }
export interface CashExchangeEntry extends BaseLedgerEntry { entryType: 'cash_exchange'; paymentDate: number; cashExchangeType: CashExchangeType; targetAmount: number; targetCurrency: string; }
export type FlightEntry = FlightOneWay | FlightRoundTrip;
export type LedgerEntry = StandardEntry | FlightEntry | PrepaidMultiDayEntry | CashExchangeEntry;
export interface TripFinancialTotals { financialTotal: number; settledAmount: number; pendingAmount: number; }
export interface Destination { country: string; city: string; }
export interface TravelSegment { id: string; destinations: Destination[]; startDate: number; endDate: number; primaryCurrency: string; }
export interface AllocationRule { allocationMode: AllocationMode; percentages?: Record<string, number>; }
export interface Trip { id: string; title: string; segments: TravelSegment[]; status: TripStatus; allocationRules?: AllocationRule; coverImage?: string; members: Member[]; accounts: Account[]; categories: Category[]; ledger: LedgerEntry[]; createdAt: number; updatedAt: number; }