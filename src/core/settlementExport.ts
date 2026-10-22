import * as XLSX from 'xlsx-js-style';
import type { LedgerEntry, Trip } from './domain';
import { isLedgerEntryIncludedInCost } from './ledger';
import { getSegmentForLedgerEntry } from './travelSegment';
import { calculateMinimalSettlementTransfers, calculateSegmentSettlements, settlementMemberName, type SettlementSegment } from './settlement';


const chineseHeaders: Record<string, string> = {
  Date: '日期', Segment: '目的地', Category: '类别', Item: '项目', Payer: '付款人',
  'Original Currency': '原币种', 'Original Amount': '原金额', 'Exchange Rate': '汇率',
  'Total (CNY)': '总金额（人民币）', 'Split Rule': '分摊方式', 'Included in Stats': '计入统计',
  Notes: '备注', 'Original Total': '原始金额', 'Grand Total': '总合计',
  'Statistics Total': '统计项目合计', Settlement: '结算转账',
};
const localizeExportSheet = (sheet: XLSX.WorkSheet, chinese: boolean) => {
  if (!chinese) return;
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:A1');
  const headers = new Map<number, string>();
  for (let col = range.s.c; col <= range.e.c; col += 1) {
    const cell = sheet[XLSX.utils.encode_cell({ r: 2, c: col })];
    const header = typeof cell?.v === 'string' ? cell.v : '';
    headers.set(col, header);
    if (cell && chineseHeaders[header]) cell.v = chineseHeaders[header];
    else if (cell && header.endsWith(' Share (CNY)')) cell.v = header.replace(' Share (CNY)', '分摊金额（人民币）');
    else if (cell && header.endsWith(' Allocation (CNY)')) cell.v = header.replace(' Allocation (CNY)', '分摊金额（人民币）');
  }
  const valueMap: Record<string, string> = {
    single: '单人承担', equal: '平均分摊', custom: '自定义比例', special: '临时指定',
    Yes: '是', No: '否', 'Grand Total': '总合计', 'Statistics Total': '统计项目合计',
    'Member Share Total': '个人分摊合计', Settlement: '结算转账', 'No transfer needed': '无需转账',
    Refund: '退款', 'Standard': '普通项目', 'Prepaid · Multi-day': '预付·多日项目',
    'Flight · Round Trip': '往返机票', 'Flight · One Way': '单程机票',
    Accommodation: '住宿', Transport: '交通', Meal: '餐饮', Food: '食品',
    Shopping: '购物', Income: '收入', Flight: '机票', Activity: '活动', Other: '其他',
  };
  for (let row = 0; row <= range.e.r; row += 1) {
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
      if (!cell || typeof cell.v !== 'string' || row === 2) continue;
      const header = headers.get(col) ?? '';
      const value = cell.v;
      if (header === 'Notes') {
        if (value === 'Member Share Total') cell.v = '个人分摊合计';
        else if (value === 'Settlement') cell.v = '结算转账';
        else if (value === 'Refund') cell.v = '退款';
        else if (value === 'No transfer needed') cell.v = '无需转账';
        else if (value.startsWith('Refund · ')) cell.v = `退款 · ${value.slice(9)}`;
        else if (value.includes(' pays ') && / CNY [0-9]/.test(value)) {
          cell.v = value.split('; ').map((transfer) => {
            const match = transfer.match(/^(.+?) pays (.+?) CNY ([0-9]+(?:\\.[0-9]+)?)$/);
            return match ? `${match[1]} 应付 ${match[2]} ¥${match[3]}` : transfer;
          }).join('；');
        }
        // User-entered notes remain exactly as written.
        continue;
      }
      if (header === 'Item' && value.startsWith('Transport · ')) {
        const parts = value.split(' · ');
        const modes: Record<string, string> = { flight: '航班', train: '火车', bus: '巴士', taxi: '出租车', car: '自驾', ferry: '渡轮', boat: '船', other: '其他' };
        cell.v = `交通 · ${modes[(parts[1] ?? '').toLowerCase()] ?? parts[1] ?? ''} · ${parts[2] === 'Round Trip' ? '往返' : '单程'}`;
      } else if (header === 'Category') {
        cell.v = valueMap[value] ?? value;
      } else {
        cell.v = valueMap[value] ?? value;
      }
    }
  }
};

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
  // A single actual beneficiary is clearer than a split-mode label.
  const allocatedMembers = entry.allocations.filter((allocation) =>
    (allocation.percentage ?? 0) > 0 || allocation.amount > 0
  );
  if (allocatedMembers.length === 1) return 'single';
  if (entry.allocationMode === 'equal') return 'equal';
  if (entry.allocationMode === 'preset_percentage') return 'custom';
  if (entry.allocationMode === 'custom_percentage') return 'special';
  return '—';
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
      Notes: '',
    };
  };

  return [
    ...detailRows,
    makeTotalRow('Grand Total', trip.ledger),
    makeTotalRow('Statistics Total', includedEntries),
  ];
};

export const exportSettlementRaw = (trip: Trip, chinese = false) => {
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
  const departureDate = dateValues.length ? new Date(Math.min(...dateValues)) : null;
  const fileMonth = departureDate ? `${departureDate.getFullYear()}${String(departureDate.getMonth() + 1).padStart(2, '0')}` : '';
  const fileDestination = destinations.join('').replaceAll(' ', '').replaceAll('·', '').replaceAll(',', '').replaceAll('，', '');
  const exportFileName = `${fileMonth}${fileDestination}` || safeFilePart(trip.title) || 'Vela';

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
  for (let col = 0; col <= mergeEnd; col += 1) {
    const titleCell = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!rawSheet[titleCell]) rawSheet[titleCell] = { t: 's', v: '', s: titleStyle };
    else rawSheet[titleCell].s = titleStyle;
  }
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
    { wch: 12 }, { wch: 27 },
  ];
  rawSheet['!rows'] = [
    { hpt: 32 }, { hpt: 7 }, { hpt: 30 },
    ...Array.from({ length: detailRowCount }, () => ({ hpt: 21 })),
    { hpt: 25 }, { hpt: 25 },
  ];
  rawSheet['!autofilter'] = { ref: `A3:${lastColumn}${lastDetailExcelRow}` };
  rawSheet['!freeze'] = { xSplit: 1, ySplit: 3, topLeftCell: 'B4', activePane: 'bottomLeft', state: 'frozen' };

  localizeExportSheet(rawSheet, chinese);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, rawSheet, chinese ? '原始明细' : 'Raw Audit');
  XLSX.writeFileXLSX(workbook, `${exportFileName}${chinese ? '-中文' : ''}.xlsx`);
};

export const buildSettlementCollectionRows = (trip: Trip, memberId: string): Record<string, string | number>[] => {
  const member = memberName(trip, memberId);
  const detailRows = trip.ledger
    .filter((entry) => !entry.isPending)
    .map((entry) => {
      const segment = getSegmentForLedgerEntry(trip.segments, entry);
      const allocation = entry.allocations.find((item) => item.memberId === memberId)?.amount ?? 0;
      return { entry, segment, memberShare: signedAllocation(entry, allocation) };
    })
    .filter(({ memberShare }) => Math.abs(memberShare) >= 0.01)
    .map(({ entry, segment, memberShare }) => ({
      Date: formatDate(entryDate(entry)),
      Segment: segment?.destinations.map((destination) => destination.city || destination.country).filter(Boolean).join(' · ') || '—',
      Category: categoryName(trip, entry),
      Notes: entryNotes(entry),
      'Original Total': originalTotal(entry),
      'Total (CNY)': signedAmount(entry),
      [`${member} Share (CNY)`]: memberShare,
    }));

  const segments = calculateSegmentSettlements(trip);
  const payerMap = new Map<string, { payerId: string; paidCny: number; originalPaid: Record<string, number>; debts: { memberId: string; amountCny: number }[] }>();
  for (const segment of segments) {
    for (const payer of segment.payers) {
      const current = payerMap.get(payer.payerId) ?? { payerId: payer.payerId, paidCny: 0, originalPaid: {}, debts: [] };
      current.paidCny = roundCny(current.paidCny + payer.paidCny);
      for (const debt of payer.debts) {
        const existing = current.debts.find((item) => item.memberId === debt.memberId);
        if (existing) existing.amountCny = roundCny(existing.amountCny + debt.amountCny);
        else current.debts.push({ ...debt });
      }
      payerMap.set(payer.payerId, current);
    }
  }
  const combinedSegment = { segmentId: 'all', label: trip.title, startDate: 0, endDate: 0, primaryCurrency: 'CNY', payers: Array.from(payerMap.values()) } satisfies SettlementSegment;
  const transfers = calculateMinimalSettlementTransfers(combinedSegment);
  const memberTransfers = transfers.filter((transfer) => transfer.fromMemberId === memberId || transfer.toMemberId === memberId);
  const settlement = memberTransfers.length
    ? memberTransfers.map((transfer) => transfer.fromMemberId === memberId
      ? `${member} pays ${memberName(trip, transfer.toMemberId)} CNY ${transfer.amountCny.toFixed(2)}`
      : `${memberName(trip, transfer.fromMemberId)} pays ${member} CNY ${transfer.amountCny.toFixed(2)}`).join('; ')
    : 'No transfer needed';
  const shareTotal = roundCny(detailRows.reduce((sum, row) => sum + Number(row[`${member} Share (CNY)`] ?? 0), 0));
  return [
    ...detailRows,
    { Date: '', Segment: '', Category: '', Notes: 'Member Share Total', 'Original Total': '', 'Total (CNY)': '', [`${member} Share (CNY)`]: shareTotal },
    { Date: '', Segment: '', Category: '', Notes: 'Settlement', 'Original Total': '', 'Total (CNY)': '', [`${member} Share (CNY)`]: settlement },
  ];
};

export const exportSettlementCollection = (trip: Trip, memberId: string, targetWorkbook?: XLSX.WorkBook, chinese = false) => {
  const rows = buildSettlementCollectionRows(trip, memberId);
  const member = memberName(trip, memberId);
  const dateValues = trip.segments.flatMap((segment) => [segment.startDate, segment.endDate]).filter(Number.isFinite);
  const compactDate = (value: number) => {
    const date = new Date(value);
    return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
  };
  const period = dateValues.length ? `${compactDate(Math.min(...dateValues))}-${compactDate(Math.max(...dateValues))}` : '';
  const destinations = [...new Set(trip.segments.flatMap((segment) =>
    segment.destinations.map((destination) => [destination.region, destination.city].filter(Boolean).join(''))
  ).filter(Boolean))];
  const destinationLabel = destinations.join(' · ');
  const title = [`Vela/${period}`, destinationLabel, member].filter(Boolean).join('  ');
  const departureDate = dateValues.length ? new Date(Math.min(...dateValues)) : null;
  const fileMonth = departureDate ? `${departureDate.getFullYear()}${String(departureDate.getMonth() + 1).padStart(2, '0')}` : '';
  const fileDestination = destinations.join('').replaceAll(' ', '').replaceAll('·', '').replaceAll(',', '').replaceAll('，', '');
  const exportFileName = `${fileMonth}${fileDestination}-${safeFilePart(member)}` || `${safeFilePart(trip.title)}-${safeFilePart(member)}`;
  const sheet = XLSX.utils.aoa_to_sheet([[title], []]);
  XLSX.utils.sheet_add_json(sheet, rows, { origin: 'A3' });
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A3:G3');
  const lastRow = range.e.r;
  const lastCol = range.e.c;
  const titleStyle = { fill: { fgColor: { rgb: '28332D' } }, font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 15 }, alignment: { vertical: 'center', horizontal: 'center' } };
  const headerStyle = { fill: { fgColor: { rgb: 'E9E1D2' } }, font: { bold: true, color: { rgb: '28332D' }, sz: 10 }, alignment: { vertical: 'center', horizontal: 'center', wrapText: true }, border: { bottom: { style: 'medium', color: { rgb: 'B79A62' } } } };
  const bodyStyle = { font: { color: { rgb: '28312D' }, sz: 10 }, alignment: { vertical: 'center', wrapText: true }, border: { bottom: { style: 'hair', color: { rgb: 'E7E0D5' } } } };
  const totalStyle = { fill: { fgColor: { rgb: 'F2EAD9' } }, font: { bold: true, color: { rgb: '28332D' }, sz: 10 }, alignment: { vertical: 'center', wrapText: true }, border: { top: { style: 'thin', color: { rgb: 'B79A62' } }, bottom: { style: 'thin', color: { rgb: 'B79A62' } } } };
  const settlementStyle = { fill: { fgColor: { rgb: 'E8EFE9' } }, font: { bold: true, color: { rgb: '28332D' }, sz: 10 }, alignment: { vertical: 'center', wrapText: true }, border: { top: { style: 'thin', color: { rgb: '91A997' } }, bottom: { style: 'thin', color: { rgb: '91A997' } } } };
  const mergeEnd = Math.max(lastCol, 2);
  sheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: mergeEnd } }];
  for (let col = 0; col <= mergeEnd; col += 1) {
    const address = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!sheet[address]) sheet[address] = { t: 's', v: '', s: titleStyle };
    else sheet[address].s = titleStyle;
  }
  for (let col = 0; col <= lastCol; col += 1) {
    const headerAddress = XLSX.utils.encode_cell({ r: 2, c: col });
    if (sheet[headerAddress]) sheet[headerAddress].s = headerStyle;
    for (let row = 3; row <= lastRow; row += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: col });
      if (sheet[address]) sheet[address].s = bodyStyle;
    }
  }
  for (let col = 0; col <= lastCol; col += 1) {
    const totalAddress = XLSX.utils.encode_cell({ r: lastRow - 1, c: col });
    const settlementAddress = XLSX.utils.encode_cell({ r: lastRow, c: col });
    if (sheet[totalAddress]) sheet[totalAddress].s = totalStyle;
    if (sheet[settlementAddress]) sheet[settlementAddress].s = settlementStyle;
  }
  const headerNames = Object.keys(rows[0] ?? {});
  for (const header of ['Original Total', 'Total (CNY)', `${member} Share (CNY)`]) {
    const col = headerNames.indexOf(header);
    if (col < 0) continue;
    for (let row = 3; row <= lastRow - 2; row += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: col });
      if (sheet[address] && typeof sheet[address].v === 'number') sheet[address].z = '#,##0.00;[Red]-#,##0.00;–';
    }
  }
  sheet['!cols'] = [
    { wch: 12 }, { wch: 17 }, { wch: 15 }, { wch: 28 },
    { wch: 17 }, { wch: 15 }, { wch: 23 },
  ];
  sheet['!rows'] = [
    { hpt: 32 }, { hpt: 7 }, { hpt: 30 },
    ...Array.from({ length: Math.max(0, lastRow - 4) }, () => ({ hpt: 21 })),
    { hpt: 25 }, { hpt: 42 },
  ];
  sheet['!autofilter'] = { ref: `A3:${XLSX.utils.encode_col(lastCol)}${lastRow - 1}` };
  sheet['!freeze'] = { xSplit: 1, ySplit: 3, topLeftCell: 'B4', activePane: 'bottomLeft', state: 'frozen' };
  localizeExportSheet(sheet, chinese);
  const workbook = targetWorkbook ?? XLSX.utils.book_new();
  const sheetName = member.slice(0, 31).replace(/[\\/?*\[\]:]/g, '-');
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName || 'Collection Summary');
  if (!targetWorkbook) XLSX.writeFileXLSX(workbook, `${exportFileName}${chinese ? '-中文' : ''}.xlsx`);
};

export const exportSettlementCollectionAll = (trip: Trip, chinese = false) => {
  const members = trip.members.filter((member) => member.archived !== true);
  const workbook = XLSX.utils.book_new();
  for (const member of members) exportSettlementCollection(trip, member.id, workbook, chinese);
  if (workbook.SheetNames.length === 0) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['No active members']]), 'Collection Summary');
  }
  const dateValues = trip.segments.flatMap((segment) => [segment.startDate, segment.endDate]).filter(Number.isFinite);
  const departureDate = dateValues.length ? new Date(Math.min(...dateValues)) : null;
  const fileMonth = departureDate ? `${departureDate.getFullYear()}${String(departureDate.getMonth() + 1).padStart(2, '0')}` : '';
  const destinations = [...new Set(trip.segments.flatMap((segment) => segment.destinations.map((destination) => [destination.region, destination.city].filter(Boolean).join(''))).filter(Boolean))];
  const fileDestination = destinations.join('').replaceAll(' ', '').replaceAll('·', '').replaceAll(',', '').replaceAll('，', '');
  XLSX.writeFileXLSX(workbook, `${fileMonth}${fileDestination}-${chinese ? '全体成员' : 'AllMembers'}${chinese ? '-中文' : ''}.xlsx`);
};

const safeFilePart = (value: string) => value.trim().replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'journey';
