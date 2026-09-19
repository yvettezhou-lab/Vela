import { Trip, LedgerEntry, TripFinancialTotals } from './domain';
export interface MemberBalance { memberId: string; paid: number; owed: number; net: number; }
export interface SettlementTransaction { fromMemberId: string; toMemberId: string; amount: number; }
const countsAsExpense = (entry: LedgerEntry) => entry.includeInCost && !entry.isPending;
export const calculateFinancialTotals = (ledger: LedgerEntry[]): TripFinancialTotals =>
  ledger.reduce((totals, entry) => {
    if (!entry.includeInCost) return totals;
    const impact = entry.isRefund ? -entry.cnyEquivalent : entry.cnyEquivalent;
    if (entry.isPending) totals.pendingAmount += impact; else totals.financialTotal += impact;
    return totals;
  }, { financialTotal: 0, settledAmount: 0, pendingAmount: 0 });
export const calculateGroupBalance = (trip: Trip): MemberBalance[] => {
  const balances: Record<string, MemberBalance> = {};
  trip.members.forEach(m => { balances[m.id] = { memberId: m.id, paid: 0, owed: 0, net: 0 }; });
  trip.ledger.forEach(entry => {
    if (entry.isPending) return;
    const impactMultiplier = entry.isRefund ? -1 : 1;
    if (balances[entry.payerId]) balances[entry.payerId].paid += entry.cnyEquivalent * impactMultiplier;
    entry.allocations.forEach(alloc => { if (balances[alloc.memberId]) balances[alloc.memberId].owed += alloc.amount * impactMultiplier; });
  });
  return Object.values(balances).map(b => ({ ...b, net: Math.round((b.paid - b.owed) * 100) / 100 }));
};
export const calculateSettlements = (balances: MemberBalance[]): SettlementTransaction[] => {
  const transactions: SettlementTransaction[] = [];
  const debtors = balances.filter(b => b.net < -0.01).sort((a, b) => a.net - b.net);
  const creditors = balances.filter(b => b.net > 0.01).sort((a, b) => b.net - a.net);
  let d = 0, c = 0;
  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d], creditor = creditors[c], amount = Math.min(Math.abs(debtor.net), creditor.net);
    if (amount > 0.001) transactions.push({ fromMemberId: debtor.memberId, toMemberId: creditor.memberId, amount: Number(amount.toFixed(2)) });
    debtor.net += amount; creditor.net -= amount;
    if (Math.abs(debtor.net) < 0.01) d++; if (creditor.net < 0.01) c++;
  }
  return transactions;
};