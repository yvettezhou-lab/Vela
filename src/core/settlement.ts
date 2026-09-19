import type { LedgerEntry, Member, TravelSegment, Trip } from './domain';
import { getSegmentForLedgerEntry } from './travelSegment';

export interface SettlementDebt {
  memberId: string;
  amountCny: number;
}

export interface SettlementPayer {
  payerId: string;
  paidCny: number;
  originalPaid: Record<string, number>;
  debts: SettlementDebt[];
}

export interface SettlementSegment {
  segmentId: string;
  label: string;
  startDate: number;
  endDate: number;
  primaryCurrency: string;
  payers: SettlementPayer[];
}

const roundCny = (value: number) => Math.round(value * 100) / 100;

const segmentLabel = (segment: TravelSegment) => {
  const destinations = segment.destinations
    .map((destination) => destination.city || destination.country)
    .filter(Boolean);
  return destinations.length ? destinations.join(' · ') : segment.primaryCurrency;
};

const ledgerImpact = (entry: LedgerEntry) => (entry.isRefund ? -1 : 1);

export const calculateSegmentSettlements = (trip: Trip): SettlementSegment[] => {
  const bySegment = new Map<string, Map<string, SettlementPayer>>();

  trip.segments.forEach((segment) => bySegment.set(segment.id, new Map()));

  trip.ledger
    .filter((entry) => !entry.isPending)
    .forEach((entry) => {
      const segment = getSegmentForLedgerEntry(trip.segments, entry);
      if (!segment) return;

      const payerMap = bySegment.get(segment.id)!;
      const payerId = entry.payerId;
      const existing = payerMap.get(payerId) ?? {
        payerId,
        paidCny: 0,
        originalPaid: {},
        debts: [],
      };
      const multiplier = ledgerImpact(entry);

      existing.paidCny = roundCny(existing.paidCny + entry.cnyEquivalent * multiplier);
      existing.originalPaid[entry.originalCurrency] =
        roundCny((existing.originalPaid[entry.originalCurrency] ?? 0) + entry.originalAmount * multiplier);

      const debtByMember = new Map(existing.debts.map((debt) => [debt.memberId, debt.amountCny]));
      entry.allocations.forEach((allocation) => {
        if (allocation.memberId === payerId) return;
        const next = (debtByMember.get(allocation.memberId) ?? 0) + allocation.amount * multiplier;
        debtByMember.set(allocation.memberId, roundCny(next));
      });
      existing.debts = Array.from(debtByMember.entries())
        .filter(([, amountCny]) => Math.abs(amountCny) >= 0.01)
        .map(([memberId, amountCny]) => ({ memberId, amountCny }))
        .sort((a, b) => b.amountCny - a.amountCny);
      payerMap.set(payerId, existing);
    });

  return trip.segments.map((segment) => {
    const payers = Array.from(bySegment.get(segment.id)?.values() ?? [])
      .filter((payer) => Math.abs(payer.paidCny) >= 0.01 || payer.debts.length > 0)
      .sort((a, b) => b.paidCny - a.paidCny);
    return {
      segmentId: segment.id,
      label: segmentLabel(segment),
      startDate: segment.startDate,
      endDate: segment.endDate,
      primaryCurrency: segment.primaryCurrency,
      payers,
    };
  });
};

export const calculateSettlementMemberTotal = (segment: SettlementSegment, memberId: string) =>
  roundCny(
    segment.payers.reduce(
      (total, payer) => total + (payer.debts.find((debt) => debt.memberId === memberId)?.amountCny ?? 0),
      0,
    ),
  );

export const settlementMemberName = (members: Member[], memberId: string) =>
  members.find((member) => member.id === memberId)?.name ?? memberId;
