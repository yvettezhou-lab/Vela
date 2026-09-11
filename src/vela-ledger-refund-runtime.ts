import { loadPlan, savePlan, type LedgerEntry } from './domain';

const refundEntry = (entry: LedgerEntry): LedgerEntry => ({
  ...entry,
  id: crypto.randomUUID(),
  description: `${entry.description} — Refund`,
  amount: -Math.abs(entry.amount),
  finalAmount: entry.finalAmount == null ? undefined : -Math.abs(entry.finalAmount),
  finalCurrency: entry.finalCurrency,
  planned: false,
  allocations: entry.allocations.map(a => ({ ...a, amount: -Math.abs(a.amount) })),
  usageDates: entry.template === 'PrepaidMultiDay' && entry.usageDates ? [...entry.usageDates] : undefined,
  actualDates: entry.template === 'PrepaidMultiDay' && entry.actualDates ? [...entry.actualDates] : undefined,
  dailyActuals: entry.template === 'PrepaidMultiDay' && entry.dailyActuals ? entry.dailyActuals.map(d => ({ ...d, amount: -Math.abs(d.amount), allocations: d.allocations.map(a => ({ ...a, amount: -Math.abs(a.amount) })) })) : undefined,
});

document.addEventListener('click', event => {
  const target = event.target as HTMLElement | null;
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(b => b.textContent?.trim() === 'Add Refund' && b.contains(target));
  if (!button) return;
  const card = button.closest<HTMLElement>('[data-vela-entry-id]');
  const id = card?.dataset.velaEntryId;
  if (!id) return;
  const plan = loadPlan();
  const entry = plan.ledger.find(e => e.id === id);
  if (!entry) return;
  event.preventDefault(); event.stopPropagation();
  if (!window.confirm(`Add a refund for “${entry.description}”?`)) return;
  savePlan({ ...plan, ledger: [refundEntry(entry), ...plan.ledger] });
  window.location.reload();
}, true);