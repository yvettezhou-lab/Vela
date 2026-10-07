import { calculateFinancialTotals } from './core/calculations';
import { getLedgerOriginalAmountImpact } from './core/ledger';
import {
  getTripEndDate,
  getTripPrimaryCurrency,
  getTripStartDate,
} from './core/travelSegment';
import { Trip } from './core/domain';

export const formatTripDate = (trip: Trip) => {
  const start = new Date(getTripStartDate(trip));
  const end = new Date(getTripEndDate(trip));

  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return 'DATES NOT SET';
  }

  const formatDate = (value: Date) =>
    `${value.getFullYear()}.${String(value.getMonth() + 1).padStart(2, '0')}.${String(value.getDate()).padStart(2, '0')}`;

  return `${formatDate(start)} — ${formatDate(end)}`;
};

export const getTripDayCount = (trip: Trip) => {
  const days =
    Math.round((getTripEndDate(trip) - getTripStartDate(trip)) / 86400000) + 1;
  return days > 0 && days < 1000 ? `${days} DAYS` : '';
};

export const getTripLocalSummary = (trip: Trip) => {
  const statsLedger = trip.ledger.filter(
    (entry) => entry.includeInCost && !entry.isPending,
  );
  const local = statsLedger.reduce(
    (sum, entry) => sum + getLedgerOriginalAmountImpact(entry),
    0,
  );
  const totals = calculateFinancialTotals(trip.ledger);
  const currency = getTripPrimaryCurrency(trip);
  const localLabel = local
    ? `${currency} ${Math.round(local).toLocaleString('en-US')}`
    : '';
  const cnyLabel =
    currency !== 'CNY' && totals.financialTotal
      ? `¥${Math.round(totals.financialTotal).toLocaleString('en-US')}`
      : '';

  return [getTripDayCount(trip), localLabel, cnyLabel]
    .filter(Boolean)
    .join(' · ');
};
