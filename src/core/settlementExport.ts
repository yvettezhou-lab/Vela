import * as XLSX from 'xlsx';
import type { LedgerEntry, Trip } from './domain';
import { isLedgerEntryIncludedInCost } from './ledger';
import { getSegmentForLedgerEntry } from './travelSegment';
import { settlementMemberName } from './settlement';

const entryDate = (entry: LedgerEntry) =>
  entry.entryType === 'flight'
    ? entry.outboundDate
    : entry.entryType === 'transport'
      ? entry.paymentDate ?? entry.outboundDate
      : entry.paymentDate;

const entryTypeLabel = (entry: LedgerEntry) => {
  if (entry.entryType === 'flight') return entry.flightType === 'round_trip' ? 'Flight · Round Trip' : 'Flight · One Way';
  if (entry.entryType === 'transport') return entry.journeyType === 'round_trip'
    ? `Transport · ${entry.transportMode} · Round Trip`
    : `Transport · ${entry.transportMode} · One Way`;
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

const isIncludedInStats = (entry: LedgerEntry) => isLedgerEntryIncludedInCost(entry);
const signedAmount = (entry: LedgerEntry) =>
  entry.isRefund || entry.entryDirection === 'income'
    ? -Math.abs(entry.cnyEquivalent)
    : Math.abs(entry.cnyEquivalent);
const signedAllocation = (entry: LedgerEntry, amount: number) =>
  entry.isRefund || entry.entryDirection === 'income' ? -Math.abs(amount) : Math.abs(amount);

const getMemberAllocationColumns = (trip: Trip) => {
  const seen = new Set<string>();
  return trip.members.map((member) => {
    const base = `${member.name} Allocation (CNY)`;
    const column = seen.has(base) ? `${base} [${member.id}]` : base;
    seen.add(column);
    return { member, column };
  });
};

const statsExclusionReason = (entry: LedgerEntry) => {
  if (entry.isPending) return 'Pending final settlement';
  if (!entry.includeInCost) return 'Excluded from statistics';
  return '—';
};

const entryNotes = (entry: LedgerEntry) => {
  const note = entry.note?.trim();
  if (note && entry.isRefund) return `Refund · ${note}`;
  if (note) return note;
  return entry.isRefund ? 'Refund' : '—';
};

/** Build the auditable ledger rows, including pending and excluded entries. */
export const buildSettlementRawRows = (trip: Trip): Record<string, string | number>[] => {
  const memberColumns = getMemberAllocationColumns(trip);
  return trip.ledger.map((entry) => {
    const segment = getSegmentForLedgerEntry(trip.segments, entry);
    const included = isIncludedInStats(entry);
    const allocations = Object.fromEntries(memberColumns.map(({ member, column }) => {
      const allocation = entry.allocations.find((item) => item.memberId === member.id);
      return [column, signedAllocation(entry, allocation?.amount ?? 0)];
    }));

    return {
      Date: formatDate(entryDate(entry)),
      Segment: segment?.destinations.map((destination) => destination.city || destination.country).filter(Boolean).join(' · ') || segment?.primaryCurrency || '—',
      Category: categoryName(trip, entry),
      Item: entryTypeLabel(entry),
      Payer: memberName(trip, entry.payerId),
      'Original Currency': entry.originalCurrency,
      'Original Amount': entry.originalAmount,
      'Exchange Rate': Number(exchangeRate(entry).toFixed(8)),
      'Total (CNY)': signedAmount(entry),
      'Split Rule': splitRule(entry),
      ...allocations,
      'Included in Stats': included ? 'Yes' : 'No',
      'Stats Exclusion Reason': statsExclusionReason(entry),
      Notes: entryNotes(entry),
    };
  });
};

/** Summary includes both the full ledger and the exact subset used by statistics. */
export const buildSettlementSummaryRows = (trip: Trip): (string | number)[][] => {
  const entries = trip.ledger;
  const includedEntries = entries.filter(isIncludedInStats);
  const excludedEntries = entries.filter((entry) => !isIncludedInStats(entry));
  const totalAll = entries.reduce((sum, entry) => sum + signedAmount(entry), 0);
  const totalIncluded = includedEntries.reduce((sum, entry) => sum + signedAmount(entry), 0);
  const totalExcluded = excludedEntries.reduce((sum, entry) => sum + signedAmount(entry), 0);
  const memberColumns = getMemberAllocationColumns(trip);

  const allAllocations = memberColumns.map(({ member }) => entries.reduce((sum, entry) => {
    const allocation = entry.allocations.find((item) => item.memberId === member.id);
    return sum + signedAllocation(entry, allocation?.amount ?? 0);
  }, 0));
  const includedAllocations = memberColumns.map(({ member }) => includedEntries.reduce((sum, entry) => {
    const allocation = entry.allocations.find((item) => item.memberId === member.id);
    return sum + signedAllocation(entry, allocation?.amount ?? 0);
  }, 0));

  const allAllocationTotal = allAllocations.reduce((sum, amount) => sum + amount, 0);
  const includedAllocationTotal = includedAllocations.reduce((sum, amount) => sum + amount, 0);
  const roundCny = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;

  return [
    ['Vela Settlement Summary', trip.title],
    ['Generated At', new Date().toISOString()],
    [],
    ['Ledger Totals', 'Amount (CNY)', 'Entries'],
    ['All ledger entries', roundCny(totalAll), entries.length],
    ['Included in statistics', roundCny(totalIncluded), includedEntries.length],
    ['Excluded from statistics', roundCny(totalExcluded), excludedEntries.length],
    [],
    ['Member Allocation Summary'],
    ['Member', 'All Allocations (CNY)', 'Included in Stats Allocations (CNY)'],
    ...memberColumns.map(({ member }, index) => [
      member.name,
      roundCny(allAllocations[index]),
      roundCny(includedAllocations[index]),
    ]),
    ['TOTAL', roundCny(allAllocationTotal), roundCny(includedAllocationTotal)],
    [],
    ['Allocation Reconciliation', 'Difference (CNY)'],
    ['All allocations minus all ledger total', roundCny(allAllocationTotal - totalAll)],
    ['Included allocations minus included ledger total', roundCny(includedAllocationTotal - totalIncluded)],
  ];
};

export const exportSettlementRaw = (trip: Trip) => {
  const rows = buildSettlementRawRows(trip);
  const rawSheet = XLSX.utils.json_to_sheet(rows);
  const memberColumnCount = trip.members.length;
  rawSheet['!cols'] = [
    { wch: 13 }, { wch: 22 }, { wch: 18 }, { wch: 24 }, { wch: 18 },
    { wch: 17 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 30 },
    ...Array.from({ length: memberColumnCount }, () => ({ wch: 24 })),
    { wch: 17 }, { wch: 28 }, { wch: 40 },
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(buildSettlementSummaryRows(trip));
  summarySheet['!cols'] = [{ wch: 42 }, { wch: 28 }, { wch: 18 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, rawSheet, 'Raw Audit');
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
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
  sheet['!cols'] = [{ wch: 24 }, { wch: 20 }, { wch: 16 }, { wch: 24 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Collection Summary');
  XLSX.writeFileXLSX(workbook, `vela-collection-${safeFilePart(trip.title)}-${safeFilePart(memberName(trip, memberId))}.xlsx`);
};

const safeFilePart = (value: string) => value.trim().replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'journey';
