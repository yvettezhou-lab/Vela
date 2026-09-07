import { defaultPlan, validatePlan, type Plan } from './domain';

const ARCHIVE_KEY = 'vela.plan.archive.v1';
const HISTORY_KEY = 'vela.plan.history.v1';
const ACTIVE_KEY = 'vela.plan.active.v1';

type ArchivedBackup = { plan: Plan; archivedAt: string };
type HistoryBackup = { planId: string; planName: string; savedAt: string; reason: 'created' | 'updated' | 'status-changed' | 'archived' | 'restored' };

export type VelaBackup = {
  schema: 'vela.backup';
  version: 2;
  exportedAt: string;
  plan: Plan;
  activePlanId: string | null;
  archivedPlans: ArchivedBackup[];
  history: HistoryBackup[];
};

const readArray = <T,>(key: string): T[] => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
};

const safeArchivedPlans = (value: unknown): ArchivedBackup[] => {
  if (!Array.isArray(value)) return [];
  const result: ArchivedBackup[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as Partial<ArchivedBackup>;
    if (typeof candidate.archivedAt !== 'string' || !candidate.plan) continue;
    try {
      result.push({ plan: validatePlan(candidate.plan), archivedAt: candidate.archivedAt });
    } catch {
      // Skip a corrupt archived Plan rather than poisoning the whole restore.
    }
  }
  return result.slice(0, 50);
};

const safeHistory = (value: unknown): HistoryBackup[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is HistoryBackup => {
    if (!item || typeof item !== 'object') return false;
    const x = item as Partial<HistoryBackup>;
    return typeof x.planId === 'string' && typeof x.planName === 'string' && typeof x.savedAt === 'string' &&
      ['created', 'updated', 'status-changed', 'archived', 'restored'].includes(x.reason ?? '');
  }).slice(0, 200);
};

export function createBackup(plan: Plan): VelaBackup {
  return {
    schema: 'vela.backup',
    version: 2,
    exportedAt: new Date().toISOString(),
    plan: structuredClone(plan),
    activePlanId: localStorage.getItem(ACTIVE_KEY),
    archivedPlans: structuredClone(readArray<ArchivedBackup>(ARCHIVE_KEY)),
    history: structuredClone(readArray<HistoryBackup>(HISTORY_KEY))
  };
}

export function downloadBackup(plan: Plan) {
  const blob = new Blob([JSON.stringify(createBackup(plan), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = `${safeName(plan.name)} - Vela Backup.json`; a.click(); URL.revokeObjectURL(url);
}

export function parseBackup(text: string): Plan {
  const raw = JSON.parse(text) as Partial<VelaBackup> & { version?: number; plan?: Plan };
  if (raw.schema !== 'vela.backup' || !raw.plan || (raw.version !== 1 && raw.version !== 2)) {
    throw new Error('This file is not a supported Vela backup.');
  }
  return validatePlan(raw.plan);
}

export function restorePlan(text: string): Plan {
  const raw = JSON.parse(text) as Partial<VelaBackup> & { version?: number; plan?: Plan };
  if (raw.schema !== 'vela.backup' || !raw.plan || (raw.version !== 1 && raw.version !== 2)) {
    throw new Error('This file is not a supported Vela backup.');
  }
  const plan = validatePlan(raw.plan);
  if (raw.version === 2) {
    const archived = safeArchivedPlans(raw.archivedPlans);
    const history = safeHistory(raw.history);
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archived));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    const activeId = typeof raw.activePlanId === 'string' && raw.activePlanId ? raw.activePlanId : null;
    const knownIds = new Set([plan.id, ...archived.map(x => x.plan.id)]);
    if (activeId && knownIds.has(activeId)) localStorage.setItem(ACTIVE_KEY, activeId);
    else localStorage.removeItem(ACTIVE_KEY);
  }
  return structuredClone(plan);
}

export function resetToNewPlan(): Plan { return defaultPlan(); }

const safeName = (value: string) => value.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Vela';
