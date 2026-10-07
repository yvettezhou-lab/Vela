import type {
  LedgerEntry,
  Trip,
  TripFinancialTotals,
} from './domain';
import { getLedgerFinancialImpact } from './ledger';

export interface MemberBalance {
  memberId: string;
  paid: number;
  owed: number;
  net: number;
}

export interface SettlementTransaction {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
}

// -----------------------------------------------------------------------------
// Financial totals
// -----------------------------------------------------------------------------

export const calculateFinancialTotals = (
  ledger: LedgerEntry[],
): TripFinancialTotals =>
  ledger.reduce(
    (totals, entry) => {
      if (!entry.includeInCost) return totals;

      const impact = getLedgerFinancialImpact(entry);

      if (entry.isPending) {
        totals.pendingAmount += impact;
      } else {
        totals.financialTotal += impact;
      }

      return totals;
    },
    { financialTotal: 0, settledAmount: 0, pendingAmount: 0 },
  );

// -----------------------------------------------------------------------------
// Group balance
// -----------------------------------------------------------------------------

export const calculateGroupBalance = (trip: Trip): MemberBalance[] => {
  const balances: Record<string, MemberBalance> = {};

  trip.members.forEach((member) => {
    balances[member.id] = {
      memberId: member.id,
      paid: 0,
      owed: 0,
      net: 0,
    };
  });

  trip.ledger.forEach((entry) => {
    if (entry.isPending) return;

    // Income is a shared gain: the receiver's paid side increases while
    // allocated members receive a corresponding negative obligation.
    if (entry.entryDirection === 'income' && !entry.isRefund) {
      if (balances[entry.payerId]) {
        balances[entry.payerId].paid += entry.cnyEquivalent;
      }

      entry.allocations.forEach((allocation) => {
        if (balances[allocation.memberId]) {
          balances[allocation.memberId].owed -= allocation.amount;
        }
      });

      return;
    }

    // Refund reverses the original expense's settlement impact.
    const impactMultiplier = entry.isRefund ? -1 : 1;

    if (balances[entry.payerId]) {
      balances[entry.payerId].paid +=
        entry.cnyEquivalent * impactMultiplier;
    }

    entry.allocations.forEach((allocation) => {
      if (balances[allocation.memberId]) {
        balances[allocation.memberId].owed +=
          allocation.amount * impactMultiplier;
      }
    });
  });

  return Object.values(balances).map((balance) => ({
    ...balance,
    net: Math.round((balance.paid - balance.owed) * 100) / 100,
  }));
};

// -----------------------------------------------------------------------------
// Settlement transactions
// -----------------------------------------------------------------------------

export const calculateSettlements = (
  balances: MemberBalance[],
): SettlementTransaction[] => {
  const transactions: SettlementTransaction[] = [];
  const debtors = balances
    .filter((balance) => balance.net < -0.01)
    .sort((a, b) => a.net - b.net);
  const creditors = balances
    .filter((balance) => balance.net > 0.01)
    .sort((a, b) => b.net - a.net);

  let debtorIndex = 0;
  let creditorIndex = 0;

  while (
    debtorIndex < debtors.length &&
    creditorIndex < creditors.length
  ) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = Math.min(Math.abs(debtor.net), creditor.net);

    if (amount > 0.001) {
      transactions.push({
        fromMemberId: debtor.memberId,
        toMemberId: creditor.memberId,
        amount: Number(amount.toFixed(2)),
      });
    }

    debtor.net += amount;
    creditor.net -= amount;

    if (Math.abs(debtor.net) < 0.01) debtorIndex++;
    if (creditor.net < 0.01) creditorIndex++;
  }

  return transactions;
};
