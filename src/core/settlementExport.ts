import * as XLSX from 'xlsx-js-style';
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

const roundCny = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;

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
  const detailRows = trip.ledger.map((entry) => {
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

  const includedEntries = trip.ledger.filter(isIncludedInStats);
  const makeTotalRow = (label: string, entries: LedgerEntry[]): Record<string, string | number> => {
    const allocations = Object.fromEntries(memberColumns.map(({ member, column }) => [
      column,
      roundCny(entries.reduce((sum, entry) => {
        const allocation = entry.allocations.find((item) => item.memberId === member.id);
        return sum + signedAllocation(entry, allocation?.amount ?? 0);
      }, 0)),
    ]));

    return {
      Date: '',
      Segment: '',
      Category: '',
      Item: label,
      Payer: '',
      'Original Currency': '',
      'Original Amount': '',
      'Exchange Rate': '',
      'Total (CNY)': roundCny(entries.reduce((sum, entry) => sum + signedAmount(entry), 0)),
      'Split Rule': '',
      ...allocations,
      'Included in Stats': '',
      'Stats Exclusion Reason': '',
      Notes: '',
    };
  };

  return [
    ...detailRows,
    makeTotalRow('总合计', trip.ledger),
    makeTotalRow('统计项目合计', includedEntries),
  ];
};

export const exportSettlementRaw = (trip: Trip) => {
  const rows = buildSettlementRawRows(trip);
  const headers = Object.keys(rows[0] ?? {});
  const detailRowCount = trip.ledger.length;
  const headerRow = 2; // zero-based: title, spacer, then table header
  const firstDetailRow = headerRow + 1;
  const totalRow = firstDetailRow + detailRowCount;
  const statsTotalRow = totalRow + 1;
  const lastDetailExcelRow = firstDetailRow + detailRowCount;
  const lastColumn = XLSX.utils.encode_col(headers.length - 1);
  const dateValues = trip.segments.flatMap((segment) => [segment.startDate, segment.endDate]).filter(Number.isFinite);
  const compactDate = (value: number) => {
    const date = new Date(value);
    return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
  };
  const period = dateValues.length
    ? `${compactDate(Math.min(...dateValues))}-${compactDate(Math.max(...dateValues))}`
    : '';
  const destinations = [...new Set(trip.segments.flatMap((segment) =>
    segment.destinations.map((destination) => [destination.region, destination.city].filter(Boolean).join(''))
  ).filter(Boolean))];
  const destinationLabel = destinations.join(' · ');
  const title = [`Vela/${period}`, destinationLabel].filter(Boolean).join('  ');

  const headerStyle = {
    fill: { fgColor: { rgb: 'E9E1D2' } },
    font: { bold: true, color: { rgb: '28332D' }, sz: 10 },
    alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
    border: { bottom: { style: 'medium', color: { rgb: 'B79A62' } } },
  };
  const bodyStyle = {
    font: { color: { rgb: '28312D' }, sz: 10 },
    alignment: { vertical: 'center' },
    border: { bottom: { style: 'hair', color: { rgb: 'E7E0D5' } } },
  };
  const totalStyle = {
    fill: { fgColor: { rgb: 'F2EAD9' } },
    font: { bold: true, color: { rgb: '28332D' }, sz: 10 },
    alignment: { vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: 'B79A62' } },
      bottom: { style: 'thin', color: { rgb: 'B79A62' } },
    },
  };
  const statsTotalStyle = {
    fill: { fgColor: { rgb: 'E8EFE9' } },
    font: { bold: true, color: { rgb: '28332D' }, sz: 10 },
    alignment: { vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: '91A997' } },
      bottom: { style: 'thin', color: { rgb: '91A997' } },
    },
  };
  const metadataTitleStyle = {
    fill: { fgColor: { rgb: '28332D' } },
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 15 },
    alignment: { vertical: 'center' },
  };
  const titleStyle = {
    fill: { fgColor: { rgb: '28332D' } },
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 15 },
    alignment: { vertical: 'center', horizontal: 'center' },
  };

  // One centered report title, followed by a small spacer and the table.
  const rawSheet = XLSX.utils.aoa_to_sheet([[title], []]);
  XLSX.utils.sheet_add_json(rawSheet, rows, { origin: 'A3' });
  const mergeEnd = Math.max(headers.length - 1, 2);
  rawSheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: mergeEnd } }];
  rawSheet['A1'].s = titleStyle;
  for (let col = 0; col < headers.length; col += 1) {
    const headerAddress = XLSX.utils.encode_cell({ r: headerRow, c: col });
    if (rawSheet[headerAddress]) rawSheet[headerAddress].s = headerStyle;
  }

  for (let row = firstDetailRow; row <= statsTotalRow; row += 1) {
    const style = row === totalRow ? totalStyle : row === statsTotalRow ? statsTotalStyle : bodyStyle;
    for (let col = 0; col < headers.length; col += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: col });
      if (rawSheet[address]) rawSheet[address].s = style;
    }
  }

  const moneyFormat = '#,##0.00;[Red]-#,##0.00;–';
  const columnIndex = (name: string) => headers.indexOf(name);
  const formatColumn = (name: string, format: string) => {
    const col = columnIndex(name);
    if (col < 0) return;
    for (let row = firstDetailRow; row <= statsTotalRow; row += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: col });
      if (rawSheet[address] && typeof rawSheet[address].v === 'number') rawSheet[address].z = format;
    }
  };
  formatColumn('Original Amount', moneyFormat);
  // Four decimal places are enough for travel exchange-rate auditing.
  formatColumn('Exchange Rate', '0.0000');
  formatColumn('Total (CNY)', moneyFormat);
  headers.filter((header) => header.endsWith('Allocation (CNY)')).forEach((header) => formatColumn(header, moneyFormat));

  // Conditional-style equivalents: highlight inclusion status and the two summary rows.
  const includedCol = columnIndex('Included in Stats');
  if (includedCol >= 0) {
    for (let row = firstDetailRow; row < totalRow; row += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: includedCol });
      const cell = rawSheet[address];
      if (!cell) continue;
      cell.s = cell.v === 'Yes'
        ? { fill: { fgColor: { rgb: 'E5F1E8' } }, font: { color: { rgb: '276749' }, bold: true }, alignment: { horizontal: 'center', vertical: 'center' } }
        : { fill: { fgColor: { rgb: 'FBE9E7' } }, font: { color: { rgb: '9B2C2C' }, bold: true }, alignment: { horizontal: 'center', vertical: 'center' } };
    }
  }

  const noteColumn = columnIndex('Notes');
  if (noteColumn >= 0) {
    for (let row = firstDetailRow; row <= statsTotalRow; row += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: noteColumn });
      if (rawSheet[address]) rawSheet[address].s = {
        ...(rawSheet[address].s ?? bodyStyle),
        alignment: { vertical: 'center', wrapText: true },
      };
    }
  }

  // Narrow administrative columns; keep member amounts and notes readable.
  rawSheet['!cols'] = [
    { wch: 11 }, { wch: 15 }, { wch: 13 }, { wch: 19 }, { wch: 10 },
    { wch: 10 }, { wch: 13 }, { wch: 10 }, { wch: 13 }, { wch: 16 },
    ...Array.from({ length: trip.members.length }, () => ({ wch: 15 })),
    { wch: 12 }, { wch: 19 }, { wch: 27 },
  ];
  rawSheet['!rows'] = [
    { hpt: 32 }, { hpt: 7 }, { hpt: 30 },
    ...Array.from({ length: detailRowCount }, () => ({ hpt: 21 })),
    { hpt: 25 }, { hpt: 25 },
  ];
  rawSheet['!autofilter'] = { ref: `A3:${lastColumn}${lastDetailExcelRow}` };
  rawSheet['!freeze'] = { xSplit: 1, ySplit: 3, topLeftCell: 'B4', activePane: 'bottomLeft', state: 'frozen' };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, rawSheet, 'Raw Audit');
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
