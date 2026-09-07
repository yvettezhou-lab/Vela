import type { Plan } from './domain';

export type ArchivedPlan = {
  plan: Plan;
  archivedAt: string;
};

export type PlanHistory = {
  planId: string;
  planName: string;
  savedAt: string;
  reason: 'created' | 'updated' | 'status-changed' | 'archived' | 'restored';
};

const ACTIVE_KEY = 'vela.plan.active.v1';
const ARCHIVE_KEY = 'vela.plan.archive.v1';
const HISTORY_KEY = 'vela.plan.history.v1';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

export function loadActivePlanId(): string | null { return localStorage.getItem(ACTIVE_KEY); }
export function saveActivePlanId(id: string) { localStorage.setItem(ACTIVE_KEY, id); }
export function loadArchivedPlans(): ArchivedPlan[] { return readJson<ArchivedPlan[]>(ARCHIVE_KEY, []); }
export function saveArchivedPlans(plans: ArchivedPlan[]) { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(plans)); }
export function loadPlanHistory(): PlanHistory[] { return readJson<PlanHistory[]>(HISTORY_KEY, []); }
export function recordPlanHistory(plan: Plan, reason: PlanHistory['reason']) { const history = loadPlanHistory(); history.unshift({ planId: plan.id, planName: plan.name, savedAt: new Date().toISOString(), reason }); localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 200))); }
export function archivePlan(plan: Plan): ArchivedPlan[] { const archived = loadArchivedPlans().filter(x => x.plan.id !== plan.id); archived.unshift({ plan: structuredClone(plan), archivedAt: new Date().toISOString() }); saveArchivedPlans(archived); recordPlanHistory(plan, 'archived'); return archived; }
export function restoreArchivedPlan(id: string): Plan | undefined { const archived = loadArchivedPlans(); const found = archived.find(x => x.plan.id === id); if (!found) return undefined; const remaining = archived.filter(x => x.plan.id !== id); saveArchivedPlans(remaining); saveActivePlanId(found.plan.id); recordPlanHistory(found.plan, 'restored'); return found.plan; }
