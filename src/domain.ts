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

export function loadPlan(): Plan { try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : defaultPlan(); } catch { return defaultPlan(); } }
export function savePlan(plan: Plan) { localStorage.setItem(KEY, JSON.stringify(plan)); }

export function normalizeRatios(members: Member[]) {
  const total = members.reduce((s, m) => s + m.ratio, 0);
  if (!members.length || total <= 0) return members.map(m => ({ ...m, ratio: 0 }));
  return members.map(m => ({ ...m, ratio: (m.ratio / total) * 100 }));
}

export function makeAllocations(amount: number, memberIds: string[], members: Member[], mode: AllocationMode): Allocation[] {
  if (!memberIds.length) return [];
  const selected = members.filter(m => memberIds.includes(m.id));
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
  if (entry.finalAmount == null) return undefined;
  return +(allocation.amount / entry.amount * entry.finalAmount).toFixed(2);
}

export function isSettled(entry: LedgerEntry, settlementCurrency: string) {
  return !isPending(entry, settlementCurrency);
}
