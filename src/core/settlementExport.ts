import * as XLSX from 'xlsx';
import type { LedgerEntry, Member, Trip } from './domain';
import { getSegmentForLedgerEntry } from './travelSegment';
import { settlementMemberName } from './settlement';

const entryDate = (entry: LedgerEntry) => entry.entryType === 'flight' ? entry.outboundDate : entry.paymentDate;
const entryTypeLabel = (entry: LedgerEntry) => {
  if (entry.entryType === 'flight') return entry.flightType === 'round_trip' ? 'Flight · Round Trip' : 'Flight · One Way';
  if (entry.entryType === 'prepaid_multi_day') return 'Prepaid · Multi-day';
  return 'Standard';
};
const formatDate = (value: number) => new Date(value).toLocaleDateString('en-CA');
const categoryName = (trip: Trip, entry: LedgerEntry) => trip.categories.find((category) => category.id === entry.categoryId)?.name ?? entry.categoryId;
const memberName = (trip: Trip, id: string) => settlementMemberName(trip.members, id);
const splitRule = (entry: LedgerEntry) => {
  if (entry.allocationMode === 'equal') return 'Equal';
  return entry.allocations.map((allocation) => `${allocation.percentage ?? 0}%`).join(' / ');
};
const exchangeRate = (entry: LedgerEntry) => entry.originalAmount ? entry.cnyEquivalent / entry.originalAmount : 0;
const owedByMember = (entry: LedgerEntry, memberId: string) => {
  if (entry.payerId === memberId) return 0;
  const allocation = entry.allocations.find((item) => item.memberId === memberId);
  return entry.isRefund ? -(allocation?.amount ?? 0) : allocation?.amount ?? 0;
};
const originalTotal = (entry: LedgerEntry) => `${entry.originalCurrency} ${entry.originalAmount.toFixed(2)}`;

export const exportSettlementRaw = (trip: Trip) => {
  const rows = trip.ledger
    .filter((entry) => !entry.isPending)
    .map((entry) => {
      const segment = getSegmentForLedgerEntry(trip.segments, entry);
      return {
        Date: formatDate(entryDate(entry)),
        Segment: segment?.destinations.map((destination) => destination.city || destination.country).filter(Boolean).join(' · ') || segment?.primaryCurrency || '—',
        Category: categoryName(trip, entry),
        Item: entryTypeLabel(entry),
        Payer: memberName(trip, entry.payerId),
        'Original Currency': entry.originalCurrency,
        'Original Amount': entry.originalAmount,
        'Exchange Rate': Number(exchangeRate(entry).toFixed(8)),
        'Total (CNY)': entry.isRefund ? -entry.cnyEquivalent : entry.cnyEquivalent,
        'Split Rule': splitRule(entry),
        Notes: entry.isRefund ? 'Refund' : '—',
      };
    });
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet['!cols'] = [{ wch: 13 }, { wch: 22 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 17 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 30 }, { wch: 18 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Raw Audit');
  XLSX.writeFileXLSX(workbook, `vela-settlement-raw-${safeFilePart(trip.title)}.xlsx`);
};

export const exportSettlementCollection = (trip: Trip, memberId: string) => {
  const rows = trip.ledger
    .filter((entry) => !entry.isPending)
    .map((entry) => ({ entry, owed: owedByMember(entry, memberId) }))
    .filter(({ owed }) => Math.abs(owed) >= 0.01)
    .map(({ entry, owed }) => ({
      Item: entryTypeLabel(entry),
      'Original Total': originalTotal(entry),
      'Total (CNY)': entry.isRefund ? -entry.cnyEquivalent : entry.cnyEquivalent,
      [`${memberName(trip, memberId)} Owed`]: owed,
    }));
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet['!cols'] = [{ wch: 22 }, { wch: 20 }, { wch: 16 }, { wch: 24 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Collection Summary');
  XLSX.writeFileXLSX(workbook, `vela-collection-${safeFilePart(trip.title)}-${safeFilePart(memberName(trip, memberId))}.xlsx`);
};

const safeFilePart = (value: string) => value.trim().replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'journey';
