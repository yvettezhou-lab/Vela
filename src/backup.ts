import { defaultPlan, validatePlan, type Plan } from './domain';

export type VelaBackup = { schema: 'vela.backup'; version: 1; exportedAt: string; plan: Plan };

export function createBackup(plan: Plan): VelaBackup {
  return { schema: 'vela.backup', version: 1, exportedAt: new Date().toISOString(), plan: structuredClone(plan) };
}

export function downloadBackup(plan: Plan) {
  const blob = new Blob([JSON.stringify(createBackup(plan), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = `${safeName(plan.name)} - Vela Backup.json`; a.click(); URL.revokeObjectURL(url);
}

export function parseBackup(text: string): Plan {
  const raw = JSON.parse(text) as Partial<VelaBackup>;
  if (raw.schema !== 'vela.backup' || raw.version !== 1 || !raw.plan) throw new Error('This file is not a supported Vela backup.');
  return validatePlan(raw.plan);
}

export function restorePlan(text: string): Plan {
  const plan = parseBackup(text);
  return structuredClone(plan);
}

export function resetToNewPlan(): Plan { return defaultPlan(); }

const safeName = (value: string) => value.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Vela';
