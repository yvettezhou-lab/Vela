import React, { useState } from 'react';
import { Trash2, ChevronDown, Pencil } from 'lucide-react';
import { LedgerEntry } from '../../core/domain';
import { findSegmentByDate, getLedgerEntryDate, getTripEndDate, getTripStartDate } from '../../core/travelSegment';
import { useVelaStore } from '../../store/useVelaStore';

const ENTRY_LABELS: Record<LedgerEntry['entryType'], string> = {
  standard: 'Standard',
  transport: 'Transport',
  prepaid_multi_day: 'Prepaid',
};
const TRANSPORT_LABELS = {
  flight: '✈️ Flight',
  train: '🚄 Train',
  long_distance_bus: '🚌 Long-distance Bus',
  ferry: '⛴️ Ferry',
} as const;
const entryLabel = (entry: LedgerEntry) => entry.entryType === 'transport'
  ? TRANSPORT_LABELS[entry.transportMode]
  : ENTRY_LABELS[entry.entryType];

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';
};

const toDateInputValue = (timestamp: number) => {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toDateTimestamp = (value: string) => {
  const timestamp = new Date(`${value}T00:00:00`).getTime();
  return Number.isFinite(timestamp) ? timestamp : NaN;
};

interface LedgerEditDraft {
  entry: LedgerEntry;
  amount: string;
  currency: string;
  cnyEquivalent: string;
  payerId: string;
  accountId: string;
  categoryId: string;
  note: string;
  paymentDate: string;
  outboundDate: string;
  returnDate: string;
  usageStart: string;
  usageEnd: string;
}

export const LedgerView: React.FC = () => {
  const trips = useVelaStore((s) => s.trips);
  const currentTrip = useVelaStore((s) => s.getCurrentTrip());
  const deleteLedgerEntry = useVelaStore((s) => s.deleteLedgerEntry);
  const updateLedgerEntry = useVelaStore((s) => s.updateLedgerEntry);
  const [selectedTripId, setSelectedTripId] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending'>('all');
  const [segmentFilterId, setSegmentFilterId] = useState('');
  const [editDraft, setEditDraft] = useState<LedgerEditDraft | null>(null);
  const [editError, setEditError] = useState('');

  const selectedTrip = trips.find((trip) => trip.id === selectedTripId) ?? currentTrip;
  const ledger = selectedTrip?.ledger ?? [];

  if (!selectedTrip) {
    return (
      <section className="vela-ledger-page">
        <header className="vela-ledger-header">
          <span className="vela-ledger-eyebrow">VELA · LEDGER</span>
          <h1>Ledger</h1>
        </header>
        <div className="vela-ledger-empty">No Journey found.</div>
      </section>
    );
  }

  const membersById = new Map(selectedTrip.members.map((member) => [member.id, member.name]));
  const entries = [...ledger].sort((a, b) => getLedgerEntryDate(b) - getLedgerEntryDate(a));
  const filteredByStatus = filter === 'pending' ? entries.filter((entry) => entry.isPending) : entries;
  const filtered = segmentFilterId
    ? filteredByStatus.filter((entry) => entry.segmentId === segmentFilterId)
    : filteredByStatus;
  const pendingCount = entries.filter((entry) => entry.isPending).length;

  const openEditor = (entry: LedgerEntry) => {
    setEditError('');
    setEditDraft({
      entry,
      amount: String(entry.originalAmount),
      currency: entry.originalCurrency,
      cnyEquivalent: String(entry.cnyEquivalent),
      payerId: entry.payerId,
      accountId: entry.accountId,
      categoryId: entry.categoryId,
      note: entry.note ?? '',
      paymentDate: 'paymentDate' in entry ? toDateInputValue(entry.paymentDate) : '',
      outboundDate: 'outboundDate' in entry ? toDateInputValue(entry.outboundDate) : '',
      returnDate: 'returnDate' in entry ? toDateInputValue(entry.returnDate) : '',
      usageStart: 'usageStart' in entry ? toDateInputValue(entry.usageStart) : '',
      usageEnd: 'usageEnd' in entry ? toDateInputValue(entry.usageEnd) : '',
    });
  };

  const closeEditor = () => {
    setEditDraft(null);
    setEditError('');
  };

  const saveEditor = () => {
    if (!editDraft) return;
    const { entry } = editDraft;
    const amount = Number(editDraft.amount);
    let cnyEquivalent = Number(editDraft.cnyEquivalent);
    const currency = editDraft.currency.trim().toUpperCase();

    if (!Number.isFinite(amount) || amount <= 0) {
      setEditError('Amount must be greater than 0.');
      return;
    }
    if (currency === 'CNY') cnyEquivalent = amount;
    if (!Number.isFinite(cnyEquivalent) || cnyEquivalent < 0) {
      setEditError('CNY equivalent must be 0 or greater.');
      return;
    }

    const dateFields: Record<string, number> = {};
    if (entry.entryType === 'standard' || entry.entryType === 'prepaid_multi_day') {
      const paymentDate = toDateTimestamp(editDraft.paymentDate);
      if (!Number.isFinite(paymentDate)) {
        setEditError('Please select a payment date.');
        return;
      }
      dateFields.paymentDate = paymentDate;
    }
    if (entry.entryType === 'transport') {
      const outboundDate = toDateTimestamp(editDraft.outboundDate);
      if (!Number.isFinite(outboundDate)) {
        setEditError('Please select an outbound date.');
        return;
      }
      dateFields.outboundDate = outboundDate;
      if (entry.journeyType === 'round_trip') {
        const returnDate = toDateTimestamp(editDraft.returnDate);
        if (!Number.isFinite(returnDate)) {
          setEditError('Please select a return date.');
          return;
        }
        if (returnDate < outboundDate) {
          setEditError('Return date cannot be before outbound date.');
          return;
        }
        dateFields.returnDate = returnDate;
      }
    }
    if (entry.entryType === 'prepaid_multi_day') {
      const usageStart = toDateTimestamp(editDraft.usageStart);
      const usageEnd = toDateTimestamp(editDraft.usageEnd);
      if (!Number.isFinite(usageStart) || !Number.isFinite(usageEnd)) {
        setEditError('Please select the usage dates.');
        return;
      }
      if (usageEnd < usageStart) {
        setEditError('Usage end cannot be before usage start.');
        return;
      }
      dateFields.usageStart = usageStart;
      dateFields.usageEnd = usageEnd;
    }

    const relevantDate = entry.entryType === 'transport'
      ? dateFields.outboundDate
      : entry.entryType === 'prepaid_multi_day'
        ? dateFields.usageStart
        : dateFields.paymentDate;
    const segment = findSegmentByDate(selectedTrip.segments, relevantDate);
    if (!segment) {
      setEditError('The selected date is outside this Journey.');
      return;
    }

    const selected = entry.allocations.length
      ? entry.allocations
      : [{ memberId: entry.payerId, amount: 0 }];
    let allocations = selected;
    if (entry.allocationMode === 'custom_percentage' || entry.allocationMode === 'preset_percentage') {
      let used = 0;
      allocations = selected.map((allocation, index) => {
        const percentage = allocation.percentage ?? 0;
        const value = index === selected.length - 1
          ? Number((cnyEquivalent - used).toFixed(2))
          : Number((cnyEquivalent * percentage / 100).toFixed(2));
        used += value;
        return { ...allocation, amount: value };
      });
    } else {
      const count = selected.length;
      const totalCents = Math.round(cnyEquivalent * 100);
      const baseCents = count ? Math.floor(totalCents / count) : 0;
      const remainderCents = count ? totalCents - baseCents * count : 0;
      allocations = selected.map((allocation, index) => ({
        ...allocation,
        amount: (baseCents + (index < remainderCents ? 1 : 0)) / 100,
      }));
    }

    try {
      updateLedgerEntry(selectedTrip.id, entry.id, {
        ...entry,
        ...dateFields,
        segmentId: segment.id,
        originalAmount: amount,
        originalCurrency: currency,
        cnyEquivalent,
        isPending: cnyEquivalent <= 0,
        payerId: editDraft.payerId,
        accountId: editDraft.accountId,
        categoryId: editDraft.categoryId,
        allocations,
        ...(editDraft.note.trim() ? { note: editDraft.note.trim() } : { note: undefined }),
        updatedAt: Date.now(),
      });
      closeEditor();
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Could not save this entry.');
    }
  };

  const fillCny = (entry: LedgerEntry) => {
    const raw = window.prompt('Enter the actual CNY amount from your bank or credit card statement', '');
    if (raw === null) return;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      window.alert('Please enter a CNY amount greater than 0.');
      return;
    }

    let allocations = entry.allocations;
    const selected = allocations.length ? allocations : [{ memberId: entry.payerId, amount: 0 }];

    if (entry.allocationMode === 'custom_percentage' && selected.some((allocation) => allocation.percentage !== undefined)) {
      let used = 0;
      allocations = selected.map((allocation, index) => {
        const percentage = allocation.percentage ?? 0;
        const amount = index === selected.length - 1
          ? Number((value - used).toFixed(2))
          : Number((value * percentage / 100).toFixed(2));
        used += amount;
        return { ...allocation, amount };
      });
    } else {
      const base = Math.floor(value * 100 / selected.length) / 100;
      allocations = selected.map((allocation, index) => ({
        ...allocation,
        amount: index === selected.length - 1
          ? Number((value - base * (selected.length - 1)).toFixed(2))
          : base,
      }));
    }

    updateLedgerEntry(selectedTrip.id, entry.id, {
      ...entry,
      cnyEquivalent: value,
      isPending: false,
      allocations,
      updatedAt: Date.now(),
    });
  };

  return (
    <section className="vela-ledger-page">
      <header className="vela-ledger-header">
        <div>
          <span className="vela-ledger-eyebrow">VELA · LEDGER</span>
          <h1>Ledger</h1>
        </div>
      </header>

      <div className="vela-ledger-journey">
        <label htmlFor="vela-ledger-journey">Journey</label>
        <div className="vela-ledger-select-wrap">
          <select
            id="vela-ledger-journey"
            value={selectedTrip.id}
            onChange={(event) => {
              setSelectedTripId(event.target.value);
              setFilter('all');
              setSegmentFilterId('');
            }}
          >
            <option value={selectedTrip.id}>{selectedTrip.title}</option>
            {trips
              .filter((trip) => trip.id !== selectedTrip.id)
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.title}
                  {trip.status === 'achieve' ? ' · Achieve' : trip.status === 'traveling' ? ' · Current' : ' · Planning'}
                </option>
              ))}
          </select>
          <ChevronDown size={16} aria-hidden="true" />
        </div>
      </div>

      <div className="vela-ledger-filters" role="group" aria-label="Ledger filters">
        <button type="button" className={filter === 'all' && !segmentFilterId ? 'active' : ''} onClick={() => { setFilter('all'); setSegmentFilterId(''); }}>
          All
        </button>
        <button type="button" className={filter === 'pending' && !segmentFilterId ? 'active' : ''} onClick={() => { setFilter('pending'); setSegmentFilterId(''); }}>
          Pending CNY{pendingCount ? ` · ${pendingCount}` : ''}
        </button>
        {selectedTrip.segments.map((segment) => {
          const label = segment.destinations.map((destination) => destination.city || destination.country).filter(Boolean).join(' · ') || 'Segment';
          return (
            <button key={segment.id} type="button" className={segmentFilterId === segment.id ? 'active' : ''} onClick={() => { setSegmentFilterId(segment.id); setFilter('all'); }}>
              {label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="vela-ledger-empty-card">
          {filter === 'pending' ? 'No entries waiting for CNY.' : segmentFilterId ? 'No entries in this Segment.' : 'No ledger entries yet.'}
        </div>
      ) : (
        <div className="vela-ledger-list">
          {filtered.map((entry) => (
            <article className="vela-ledger-entry" key={entry.id}>
              <div className="vela-ledger-entry-main">
                <div className="vela-ledger-entry-title">
                  <strong>{entryLabel(entry)}</strong>
                  {entry.isPending && <span className="vela-ledger-badge pending">CNY Pending</span>}
                  {!entry.includeInCost && <span className="vela-ledger-badge muted">Excluded</span>}
                </div>
                <span className="vela-ledger-entry-meta">
                  {membersById.get(entry.payerId) ?? entry.payerId} · {formatDate(getLedgerEntryDate(entry))}
                </span>
                <span className="vela-ledger-entry-detail">
                  {entry.originalCurrency} · {entry.originalAmount.toFixed(2)} · CNY {entry.isPending ? 'Pending' : entry.cnyEquivalent.toFixed(2)}
                </span>
                {entry.note && <span className="vela-ledger-entry-note">{entry.note}</span>}
              </div>

              <div className="vela-ledger-entry-actions">
                {entry.isPending && (
                  <button type="button" className="vela-ledger-add-cny" onClick={() => fillCny(entry)}>
                    Add CNY
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Edit entry"
                  title="Edit entry"
                  className="vela-ledger-edit"
                  onClick={() => openEditor(entry)}
                >
                  <Pencil size={16} strokeWidth={1.7} />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${entryLabel(entry)} entry`}
                  title="Delete entry"
                  className="vela-ledger-delete"
                  onClick={() => deleteLedgerEntry(selectedTrip.id, entry.id)}
                >
                  <Trash2 size={16} strokeWidth={1.7} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {editDraft && (
        <div className="vela-ledger-edit-backdrop" role="dialog" aria-modal="true" aria-labelledby="ledger-edit-title">
          <div className="vela-ledger-edit-sheet">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[#857a6a]">Ledger</p>
                <h2 id="ledger-edit-title" className="mt-1 text-2xl font-medium">Edit entry</h2>
              </div>
              <button type="button" onClick={closeEditor} className="min-h-10 rounded-xl px-3 text-sm text-[#6f6659]">Cancel</button>
            </div>

            <div className="ledger-edit-actions">
              <label className="block">
                <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-[#857a6a]">Amount</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  value={editDraft.amount}
                  onChange={(event) => {
                    const amount = event.target.value;
                    setEditDraft((draft) => draft ? {
                      ...draft,
                      amount,
                      cnyEquivalent: draft.currency.trim().toUpperCase() === 'CNY' ? amount : draft.cnyEquivalent,
                    } : draft);
                  }}
                  className="w-full rounded-xl bg-white px-3 py-3 text-base outline-none ring-1 ring-black/10"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-[#857a6a]">Currency</span>
                <input
                  value={editDraft.currency}
                  onChange={(event) => {
                    const currency = event.target.value.toUpperCase();
                    setEditDraft((draft) => draft ? {
                      ...draft,
                      currency,
                      cnyEquivalent: currency === 'CNY' ? draft.amount : draft.cnyEquivalent,
                    } : draft);
                  }}
                  className="w-full rounded-xl bg-white px-3 py-3 text-base outline-none ring-1 ring-black/10"
                />
              </label>
            </div>

            <label className="mt-3 block">
              <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-[#857a6a]">CNY Equivalent</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={editDraft.cnyEquivalent}
                disabled={editDraft.currency.trim().toUpperCase() === 'CNY'}
                onChange={(event) => setEditDraft((draft) => draft ? { ...draft, cnyEquivalent: event.target.value } : draft)}
                className="w-full rounded-xl bg-white px-3 py-3 text-base outline-none ring-1 ring-black/10 disabled:text-[#9b9387]"
              />
            </label>

            <div className="ledger-edit-grid-2">
              <label className="block">
                <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-[#857a6a]">Who Paid?</span>
                <select value={editDraft.payerId} onChange={(event) => setEditDraft((draft) => draft ? { ...draft, payerId: event.target.value } : draft)} className="w-full rounded-xl bg-white px-3 py-3 text-sm outline-none ring-1 ring-black/10">
                  {selectedTrip.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-[#857a6a]">Payment Account</span>
                <select value={editDraft.accountId} onChange={(event) => setEditDraft((draft) => draft ? { ...draft, accountId: event.target.value } : draft)} className="w-full rounded-xl bg-white px-3 py-3 text-sm outline-none ring-1 ring-black/10">
                  {selectedTrip.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
              </label>
            </div>

            {editDraft.entry.entryType !== 'transport' && (
              <label className="mt-3 block">
                <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-[#857a6a]">Category</span>
                <select value={editDraft.categoryId} onChange={(event) => setEditDraft((draft) => draft ? { ...draft, categoryId: event.target.value } : draft)} className="w-full rounded-xl bg-white px-3 py-3 text-sm outline-none ring-1 ring-black/10">
                  {selectedTrip.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
            )}

            {editDraft.entry.entryType === 'standard' && (
              <label className="mt-3 block">
                <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-[#857a6a]">Payment Date</span>
                <input type="date" value={editDraft.paymentDate} min={toDateInputValue(getTripStartDate(selectedTrip))} max={toDateInputValue(getTripEndDate(selectedTrip))} onChange={(event) => setEditDraft((draft) => draft ? { ...draft, paymentDate: event.target.value } : draft)} className="w-full rounded-xl bg-white px-3 py-3 text-sm outline-none ring-1 ring-black/10" />
              </label>
            )}

            {editDraft.entry.entryType === 'transport' && (
              <div className="ledger-edit-grid-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-[#857a6a]">Outbound</span>
                  <input type="date" value={editDraft.outboundDate} min={toDateInputValue(getTripStartDate(selectedTrip))} max={toDateInputValue(getTripEndDate(selectedTrip))} onChange={(event) => setEditDraft((draft) => draft ? { ...draft, outboundDate: event.target.value } : draft)} className="w-full rounded-xl bg-white px-3 py-3 text-sm outline-none ring-1 ring-black/10" />
                </label>
                {editDraft.entry.journeyType === 'round_trip' && (
                  <label className="block">
                    <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-[#857a6a]">Return</span>
                    <input type="date" value={editDraft.returnDate} min={editDraft.outboundDate || toDateInputValue(getTripStartDate(selectedTrip))} max={toDateInputValue(getTripEndDate(selectedTrip))} onChange={(event) => setEditDraft((draft) => draft ? { ...draft, returnDate: event.target.value } : draft)} className="w-full rounded-xl bg-white px-3 py-3 text-sm outline-none ring-1 ring-black/10" />
                  </label>
                )}
              </div>
            )}

            {editDraft.entry.entryType === 'prepaid_multi_day' && (
              <div className="ledger-edit-grid-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-[#857a6a]">Payment Date</span>
                  <input type="date" value={editDraft.paymentDate} min={toDateInputValue(getTripStartDate(selectedTrip))} max={toDateInputValue(getTripEndDate(selectedTrip))} onChange={(event) => setEditDraft((draft) => draft ? { ...draft, paymentDate: event.target.value } : draft)} className="w-full rounded-xl bg-white px-3 py-3 text-sm outline-none ring-1 ring-black/10" />
                </label>
                <div />
                <label className="block">
                  <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-[#857a6a]">Usage Start</span>
                  <input type="date" value={editDraft.usageStart} min={toDateInputValue(getTripStartDate(selectedTrip))} max={toDateInputValue(getTripEndDate(selectedTrip))} onChange={(event) => setEditDraft((draft) => draft ? { ...draft, usageStart: event.target.value } : draft)} className="w-full rounded-xl bg-white px-3 py-3 text-sm outline-none ring-1 ring-black/10" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-[#857a6a]">Usage End</span>
                  <input type="date" value={editDraft.usageEnd} min={editDraft.usageStart || toDateInputValue(getTripStartDate(selectedTrip))} max={toDateInputValue(getTripEndDate(selectedTrip))} onChange={(event) => setEditDraft((draft) => draft ? { ...draft, usageEnd: event.target.value } : draft)} className="w-full rounded-xl bg-white px-3 py-3 text-sm outline-none ring-1 ring-black/10" />
                </label>
              </div>
            )}

            <label className="mt-3 block">
              <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-[#857a6a]">Note</span>
              <textarea value={editDraft.note} onChange={(event) => setEditDraft((draft) => draft ? { ...draft, note: event.target.value } : draft)} rows={3} maxLength={200} className="w-full resize-none rounded-xl bg-white px-3 py-3 text-sm outline-none ring-1 ring-black/10" />
            </label>

            {editError && <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">{editError}</div>}

            <div className="ledger-edit-actions">
              <button type="button" onClick={closeEditor} className="min-h-12 rounded-2xl border border-black/10 bg-white px-4 text-sm font-semibold">Cancel</button>
              <button type="button" onClick={saveEditor} className="min-h-12 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white">Save changes</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default LedgerView;
