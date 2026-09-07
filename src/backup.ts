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
    const archived = Array.isArray(raw.archivedPlans) ? raw.archivedPlans : [];
    const history = Array.isArray(raw.history) ? raw.history : [];
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archived));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    if (typeof raw.activePlanId === 'string' && raw.activePlanId) localStorage.setItem(ACTIVE_KEY, raw.activePlanId);
    else localStorage.removeItem(ACTIVE_KEY);
  }
  return structuredClone(plan);
}

export function resetToNewPlan(): Plan { return defaultPlan(); }

const safeName = (value: string) => value.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Vela';
