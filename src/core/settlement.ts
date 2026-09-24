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

export interface SettlementTransfer {
  fromMemberId: string;
  toMemberId: string;
  amountCny: number;
}

/**
 * Collapse all payer-to-debtor lines into net member balances, then find an
 * exact minimum-transfer settlement for the segment. Amounts are solved in
 * cents so that the result is deterministic and never accumulates float error.
 */
export const calculateMinimalSettlementTransfers = (segment: SettlementSegment): SettlementTransfer[] => {
  const balance = new Map<string, number>();

  const addBalance = (memberId: string, cents: number) => {
    balance.set(memberId, (balance.get(memberId) ?? 0) + cents);
  };

  segment.payers.forEach((payer) => {
    payer.debts.forEach((debt) => {
      const cents = Math.round(debt.amountCny * 100);
      if (!cents) return;
      addBalance(payer.payerId, cents);
      addBalance(debt.memberId, -cents);
    });
  });

  const members = Array.from(balance.entries())
    .filter(([, cents]) => cents !== 0)
    .map(([memberId, cents]) => ({ memberId, cents }));
  if (members.length < 2) return [];

  const working = members.map((member) => ({ ...member }));
  let best: SettlementTransfer[] | null = null;

  const dfs = (start: number, transfers: SettlementTransfer[]) => {
    while (start < working.length && working[start].cents === 0) start += 1;
    if (start >= working.length) {
      if (!best || transfers.length < best.length) best = transfers.map((transfer) => ({ ...transfer }));
      return;
    }
    if (best && transfers.length >= best.length) return;

    const current = working[start];
    for (let index = start + 1; index < working.length; index += 1) {
      const other = working[index];
      if (current.cents * other.cents >= 0) continue;
      if (index > start + 1 && working[index - 1].cents === other.cents) continue;

      const amount = Math.min(Math.abs(current.cents), Math.abs(other.cents));
      const from = current.cents < 0 ? current.memberId : other.memberId;
      const to = current.cents > 0 ? current.memberId : other.memberId;
      const currentBefore = current.cents;
      const otherBefore = other.cents;
      if (current.cents < 0) current.cents += amount;
      else current.cents -= amount;
      if (other.cents < 0) other.cents += amount;
      else other.cents -= amount;

      transfers.push({ fromMemberId: from, toMemberId: to, amountCny: amount / 100 });
      dfs(start + 1, transfers);
      transfers.pop();
      current.cents = currentBefore;
      other.cents = otherBefore;

      if (currentBefore + otherBefore === 0) break;
    }
  };

  dfs(0, []);
  return best ?? [];
};
