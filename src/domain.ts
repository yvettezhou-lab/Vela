export const CATEGORIES = ['Accommodation','Food','Transport','Shopping','Tickets','Activities','Communication','Other'] as const;
export type Category = typeof CATEGORIES[number];
export type PlanStatus = 'Planning' | 'Traveling' | 'Settling' | 'Completed';
export type AllocationMode = 'Default' | 'Split' | 'Custom';

export type Member = { id: string; name: string; ratio: number };
export type Account = { id: string; name: string };
export type Event = { id: string; name: string; city?: string; itemNames: string[] };
export type Allocation = { memberId: string; amount: number; percentage: number };
export type LedgerEntry = {
  id: string; date: string; usageDate: string; description: string; category: Category;
  amount: number; currency: string; payerId: string; accountId: string; eventId?: string; item?: string;
  planned?: boolean;
  allocationMode: AllocationMode; allocations: Allocation[];
  finalAmount?: number; finalCurrency?: string;
};
export type Plan = {
  id: string; name: string; startDate: string; endDate: string; destinations: string[];
  settlementCurrency: string; status: PlanStatus; members: Member[]; accounts: Account[]; events: Event[]; ledger: LedgerEntry[];
};

const KEY = 'vela.plan.v1';
const uid = () => crypto.randomUUID();

export function defaultPlan(): Plan {
  const me = { id: uid(), name: 'Me', ratio: 100 };
  return { id: uid(), name: 'New Journey', startDate: '', endDate: '', destinations: [], settlementCurrency: 'CNY', status: 'Planning',
    members: [me], accounts: [{ id: uid(), name: 'Cash' }, { id: uid(), name: 'Bank Card' }, { id: uid(), name: 'Alipay' }, { id: uid(), name: 'WeChat Pay' }], events: [], ledger: [] };
}

export function loadPlan(): Plan {
  try { const raw = localStorage.getItem(KEY); return raw ? validatePlan(JSON.parse(raw)) : defaultPlan(); }
  catch { return defaultPlan(); }
}
export function savePlan(plan: Plan) { localStorage.setItem(KEY, JSON.stringify(plan)); }

/**
 * Plan dates are inclusive calendar days.
 * Example: departure flight on the 20th and return-home landing flight on the 30th => trip dates are 20–30, inclusive.
 * Times of the flights do not change the Plan date range; Ledger keeps exact payment/usage dates separately.
 */
export function isWithinPlanDates(date: string, plan: Pick<Plan, 'startDate' | 'endDate'>) {
  if (!date || !plan.startDate || !plan.endDate) return false;
  return date >= plan.startDate && date <= plan.endDate;
}

export function normalizeRatios(members: Member[]) {
  const total = members.reduce((s, m) => s + m.ratio, 0);
  if (!members.length || total <= 0) return members.map(m => ({ ...m, ratio: 0 }));
  return members.map(m => ({ ...m, ratio: (m.ratio / total) * 100 }));
}

export function makeAllocations(amount: number, memberIds: string[], members: Member[], mode: AllocationMode, customPercentages?: Record<string, number>): Allocation[] {
  if (!memberIds.length || !Number.isFinite(amount) || amount <= 0) return [];
  const selected = members.filter(m => memberIds.includes(m.id));
  if (!selected.length) return [];
  if (mode === 'Custom') {
    const percentages = selected.map(m => Number(customPercentages?.[m.id] ?? 0));
    const total = percentages.reduce((s, p) => s + p, 0);
    if (percentages.some(p => !Number.isFinite(p) || p < 0) || Math.abs(total - 100) > 0.0001) throw new Error('Custom allocation must total 100%.');
    let used = 0;
    return selected.map((m, i) => {
      const allocation = i === selected.length - 1 ? +(amount - used).toFixed(2) : +(amount * percentages[i] / 100).toFixed(2);
      used += allocation;
      return { memberId: m.id, amount: allocation, percentage: +percentages[i].toFixed(6) };
    });
  }
  if (mode === 'Split') {
    const base = Math.floor((amount / selected.length) * 100) / 100;
    return selected.map((m, i) => ({ memberId: m.id, amount: i === selected.length - 1 ? +(amount - base * (selected.length - 1)).toFixed(2) : base, percentage: i === selected.length - 1 ? +(100 - (100 / selected.length) * (selected.length - 1)).toFixed(6) : +(100 / selected.length).toFixed(6) }));
  }
  const ratioTotal = selected.reduce((s, m) => s + m.ratio, 0);
  const percentages = selected.map(m => ratioTotal ? (m.ratio / ratioTotal) * 100 : 100 / selected.length);
  let used = 0;
  return selected.map((m, i) => {
    const allocation = i === selected.length - 1 ? +(amount - used).toFixed(2) : +(amount * percentages[i] / 100).toFixed(2);
    used += allocation;
    return { memberId: m.id, amount: allocation, percentage: +(allocation / amount * 100).toFixed(6) };
  });
}

export function isPending(entry: LedgerEntry, settlementCurrency: string) {
  return entry.finalAmount == null || !entry.finalCurrency || entry.finalCurrency !== settlementCurrency;
}

export function allocationFinal(entry: LedgerEntry, allocation: Allocation) {
  if (entry.finalAmount == null || entry.amount === 0) return undefined;
  return +(allocation.amount / entry.amount * entry.finalAmount).toFixed(2);
}

export function isSettled(entry: LedgerEntry, settlementCurrency: string) { return !isPending(entry, settlementCurrency); }

export function validatePlan(input: unknown): Plan {
  if (!input || typeof input !== 'object') throw new Error('Invalid backup: expected an object.');
  const p = input as Partial<Plan>;
  if (typeof p.id !== 'string' || typeof p.name !== 'string' || !Array.isArray(p.members) || !Array.isArray(p.ledger) || !Array.isArray(p.accounts) || !Array.isArray(p.events)) throw new Error('Invalid backup: missing Plan structure.');
  if (!Array.isArray(p.destinations) || typeof p.settlementCurrency !== 'string' || !['Planning','Traveling','Settling','Completed'].includes(p.status as string)) throw new Error('Invalid backup: invalid Plan metadata.');
  if (p.startDate && p.endDate && (typeof p.startDate !== 'string' || typeof p.endDate !== 'string' || p.startDate > p.endDate)) throw new Error('Invalid backup: Plan start date must be on or before end date.');
  const memberIds = new Set<string>();
  for (const m of p.members) {
    if (!m || typeof m.id !== 'string' || typeof m.name !== 'string' || !Number.isFinite(m.ratio) || m.ratio < 0) throw new Error('Invalid backup: invalid member.');
    if (memberIds.has(m.id)) throw new Error('Invalid backup: duplicate member id.');
    memberIds.add(m.id);
  }
  if (!p.members.length || Math.abs(p.members.reduce((s, m) => s + m.ratio, 0) - 100) > 0.01) throw new Error('Invalid backup: member ratios must total 100%.');
  const accountIds = new Set(p.accounts.map(a => a.id));
  if (accountIds.size !== p.accounts.length || p.accounts.some(a => !a || typeof a.id !== 'string' || typeof a.name !== 'string')) throw new Error('Invalid backup: invalid accounts.');
  for (const e of p.ledger) {
    if (!e || typeof e.id !== 'string' || typeof e.description !== 'string' || !CATEGORIES.includes(e.category as Category) || !Number.isFinite(e.amount) || e.amount === 0 || typeof e.currency !== 'string' || !memberIds.has(e.payerId) || !accountIds.has(e.accountId) || !['Default','Split','Custom'].includes(e.allocationMode)) throw new Error('Invalid backup: invalid ledger entry.');
    if (!Array.isArray(e.allocations) || !e.allocations.length || e.allocations.some(a => !memberIds.has(a.memberId) || !Number.isFinite(a.amount) || !Number.isFinite(a.percentage))) throw new Error('Invalid backup: invalid allocation.');
    const allocationTotal = e.allocations.reduce((s, a) => s + a.amount, 0);
    if (Math.abs(allocationTotal - e.amount) > 0.01) throw new Error('Invalid backup: allocation total does not match payment.');
    if (e.finalAmount != null && !Number.isFinite(e.finalAmount)) throw new Error('Invalid backup: invalid final amount.');
    if (e.finalAmount != null && (!e.finalCurrency || typeof e.finalCurrency !== 'string')) throw new Error('Invalid backup: final currency is required with final amount.');
  }
  return p as Plan;
}

export { KEY as PLAN_STORAGE_KEY };
