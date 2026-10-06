import React, { useState } from 'react';
import { ChevronDown, Pencil } from 'lucide-react';
import { AllocationMode, LedgerEntry } from '../../core/domain';
import { findSegmentByDate, getTripEndDate, getTripStartDate } from '../../core/travelSegment';
import { getLedgerEntryPaidTimestamp, sortLedgerEntriesByPaidTimestamp } from '../../core/ledger';
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
const entryLabel = (entry: LedgerEntry) => {
  const note = entry.note?.trim();
  if (note) return note;
  return entry.entryType === 'transport'
    ? TRANSPORT_LABELS[entry.transportMode]
    : ENTRY_LABELS[entry.entryType];
};

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
  allocationMode: AllocationMode;
  participantIds: string[];
  percentages: Record<string, number>;
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
  const [detailEntry, setDetailEntry] = useState<LedgerEntry | null>(null);

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

  const members = Array.isArray(selectedTrip.members) ? selectedTrip.members : [];
  const categories = Array.isArray(selectedTrip.categories) ? selectedTrip.categories : [];
  const accounts = Array.isArray(selectedTrip.accounts) ? selectedTrip.accounts : [];
  const segments = Array.isArray(selectedTrip.segments) ? selectedTrip.segments : [];
  const membersById = new Map(members.map((member) => [member.id, member.name]));
  const categoriesById = new Map(categories.map((category) => [category.id, category.name]));
  // One source of truth: Ledger order is always derived from the paid timestamp.
  const entries = sortLedgerEntriesByPaidTimestamp(ledger);
  const filteredByStatus = filter === 'pending' ? entries.filter((entry) => entry.isPending) : entries;
  const filtered = segmentFilterId
    ? filteredByStatus.filter((entry) => entry.segmentId === segmentFilterId)
    : filteredByStatus;
  const pendingCount = entries.filter((entry) => entry.isPending).length;
  // Multi-day prepaid expenses (e.g. a 3-day hotel stay) are displayed
  // against each usage day rather than being charged entirely on the first day.
  // The underlying ledger entry remains a single payment for settlement/financial totals.
  type LedgerDisplayEntry = {
    entry: LedgerEntry;
    displayDate: number;
    displayOriginalAmount: number;
    displayCnyEquivalent: number;
    displayId: string;
  };

  const expandForDailyDisplay = (entry: LedgerEntry): LedgerDisplayEntry[] => {
    if (entry.entryType !== 'prepaid_multi_day') {
      return [{
        entry,
        displayDate: getLedgerEntryPaidTimestamp(entry),
        displayOriginalAmount: entry.originalAmount,
        displayCnyEquivalent: entry.cnyEquivalent,
        displayId: entry.id,
      }];
    }

    const start = new Date(entry.usageStart);
    const end = new Date(entry.usageEnd);
    // Accommodation usage follows hotel semantics:
    // check-in on usageStart, check-out on usageEnd.
    // Therefore 2→5 means nights of 2, 3, 4: 3 usage days, not 4.
    const dayCount = Math.max(
      1,
      Math.floor((new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime() -
        new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()) / 86400000),
    );
    if (dayCount === 1) {
      return [{
        entry,
        displayDate: entry.usageStart,
        displayOriginalAmount: entry.originalAmount,
        displayCnyEquivalent: entry.cnyEquivalent,
        displayId: entry.id,
      }];
    }

    const originalCents = Math.round(entry.originalAmount * 100);
    const cnyCents = Math.round(entry.cnyEquivalent * 100);
    const originalBase = Math.floor(originalCents / dayCount);
    const originalRemainder = originalCents - originalBase * dayCount;
    const cnyBase = Math.floor(cnyCents / dayCount);
    const cnyRemainder = cnyCents - cnyBase * dayCount;

    return Array.from({ length: dayCount }, (_, index) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index).getTime();
      return {
        entry,
        displayDate: date,
        displayOriginalAmount: (originalBase + (index < originalRemainder ? 1 : 0)) / 100,
        displayCnyEquivalent: (cnyBase + (index < cnyRemainder ? 1 : 0)) / 100,
        displayId: `${entry.id}__day_${index}`,
      };
    });
  };

  // Ledger shows only dates that have arrived. Future-dated entries remain stored
  // and will appear automatically when their date arrives.
  const todayStart = (() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  })();
  const displayEntries = filtered.flatMap(expandForDailyDisplay)
    .filter((item) => {
      const date = new Date(item.displayDate);
      const displayDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      return displayDay <= todayStart;
    })
    // Preserve the canonical paid-time order established above.
    ;

  const dateGroups = displayEntries.reduce<Array<{ key: string; label: string; entries: LedgerDisplayEntry[] }>>((groups, item) => {
    const key = toDateInputValue(item.displayDate);
    const existing = groups.find((group) => group.key === key);
    if (existing) existing.entries.push(item);
    else groups.push({ key, label: formatDate(item.displayDate), entries: [item] });
    return groups;
  }, []);

  const openEditor = (entry: LedgerEntry) => {
    window.history.pushState({}, '', `/entry/edit/${encodeURIComponent(selectedTrip.id)}/${encodeURIComponent(entry.id)}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
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

    const participantIds = editDraft.allocationMode === 'preset_percentage'
      ? Object.entries(selectedTrip.allocationRules?.percentages ?? {})
          .filter(([memberId, percentage]) => members.some((member) => member.id === memberId) && Number(percentage) > 0)
          .map(([memberId]) => memberId)
      : editDraft.participantIds.filter((memberId) => selectedTrip.members.some((member) => member.id === memberId));
    if (!participantIds.length) {
      setEditError('Please select at least one participant.');
      return;
    }

    let allocations: LedgerEntry['allocations'] = [];
    if (editDraft.allocationMode === 'preset_percentage') {
      const percentages = selectedTrip.allocationRules?.percentages ?? {};
      const total = participantIds.reduce((sum, memberId) => sum + Number(percentages[memberId] ?? 0), 0);
      if (Math.abs(total - 100) > 0.01) {
        setEditError('This Journey preset allocation must total 100%.');
        return;
      }
      allocations = participantIds.map((memberId) => ({ memberId, amount: 0, percentage: Number(percentages[memberId] ?? 0) }));
    } else if (editDraft.allocationMode === 'custom_percentage') {
      const percentages = Object.fromEntries(participantIds.map((memberId) => [memberId, Number(editDraft.percentages[memberId] ?? 0)]));
      const total = participantIds.reduce((sum, memberId) => sum + Number(percentages[memberId] ?? 0), 0);
      if (Math.abs(total - 100) > 0.01) {
        setEditError('Custom percentages must total 100%.');
        return;
      }
      allocations = participantIds.map((memberId) => ({ memberId, amount: 0, percentage: Number(percentages[memberId] ?? 0) }));
    } else {
      allocations = participantIds.map((memberId) => ({ memberId, amount: 0 }));
    }

    const totalCents = Math.round(cnyEquivalent * 100);
    const baseCents = allocations.length ? Math.floor(totalCents / allocations.length) : 0;
    const remainderCents = allocations.length ? totalCents - baseCents * allocations.length : 0;
    if (editDraft.allocationMode === 'equal') {
      allocations.forEach((allocation, index) => {
        allocation.amount = (baseCents + (index < remainderCents ? 1 : 0)) / 100;
      });
    } else {
      let usedCents = 0;
      allocations.forEach((allocation, index) => {
        const percentage = allocation.percentage ?? 0;
        const amountCents = index === allocations.length - 1
          ? totalCents - usedCents
          : Math.floor(totalCents * percentage / 100);
        allocation.amount = amountCents / 100;
        usedCents += amountCents;
      });
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
        allocationMode: editDraft.allocationMode,
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
        {segments.map((segment) => {
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
        <div className="vela-ledger-groups">
          {dateGroups.map((group) => (
            <section className="vela-ledger-date-group" key={group.key}>
              <div className="vela-ledger-date-header">
                <span>{group.label}</span>
                <span>{group.entries.length} {group.entries.length === 1 ? 'entry' : 'entries'}</span>
              </div>
              <div className="vela-ledger-list">
                {group.entries.map((item) => {
                  const entry = item.entry;
                  return (
                    <article className="vela-ledger-entry" key={item.displayId} role="button" tabIndex={0} onClick={() => setDetailEntry(entry)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setDetailEntry(entry); } }}>
                      <div className="vela-ledger-entry-main">
                        <div className="vela-ledger-entry-content">
                          <div className="vela-ledger-entry-row">
                            <strong>{entryLabel(entry)}</strong>
                            <span className="vela-ledger-amount-primary">
                              {entry.originalCurrency !== 'CNY' && <small>{entry.originalCurrency}</small>}
                              {Number.isFinite(Number(item.displayOriginalAmount)) ? Number(item.displayOriginalAmount).toFixed(2) : '0.00'}
                            </span>
                          </div>
                          <div className="vela-ledger-entry-row vela-ledger-entry-secondary">
                            <span>
                              {membersById.get(entry.payerId) ?? entry.payerId} · {entry.entryType === 'transport' ? 'Transport' : (categoriesById.get(entry.categoryId) ?? entry.categoryId)}
                              {entry.isPending && <span className="vela-ledger-badge pending">Pending</span>}
                              {!entry.includeInCost && <span className="vela-ledger-badge muted">Excluded</span>}
                            </span>
                            {entry.originalCurrency !== 'CNY' && (
                              <span className="vela-ledger-amount-cny">≈ CNY {entry.isPending ? 'Pending' : Number.isFinite(Number(item.displayCnyEquivalent)) ? Number(item.displayCnyEquivalent).toFixed(2) : '0.00'}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="vela-ledger-entry-actions">
                        {entry.isPending && (
                          <button type="button" className="vela-ledger-add-cny" onClick={() => fillCny(entry)}>
                            Add CNY
                          </button>
                        )}
                        <button type="button" aria-label="Edit entry" title="Edit entry" className="vela-ledger-edit" onClick={(event) => { event.stopPropagation(); openEditor(entry); }}>
                          <Pencil size={18} strokeWidth={1.7} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {detailEntry && (
        <div className="vela-ledger-detail-backdrop" role="dialog" aria-modal="true" aria-labelledby="ledger-detail-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailEntry(null); }}>
          <div className="vela-ledger-detail-sheet">
            <div className="vela-ledger-detail-head">
              <div>
                <p className="vela-ledger-detail-eyebrow">LEDGER · DETAIL</p>
                <h2 id="ledger-detail-title">{entryLabel(detailEntry)}</h2>
              </div>
              <button type="button" onClick={() => setDetailEntry(null)} className="vela-ledger-detail-close" aria-label="Close details">×</button>
            </div>
            <div className="vela-ledger-detail-amount">
              <strong>{detailEntry.originalCurrency === 'CNY' ? `CNY ${detailEntry.originalAmount.toFixed(2)}` : `${detailEntry.originalCurrency} ${detailEntry.originalAmount.toFixed(2)}`}</strong>
              {detailEntry.originalCurrency !== 'CNY' && <span>CNY {detailEntry.cnyEquivalent.toFixed(2)}</span>}
            </div>
            <div className="vela-ledger-detail-grid">
              <div><span>TYPE</span><strong>{ENTRY_LABELS[detailEntry.entryType]}</strong></div>
              <div><span>WHO PAID</span><strong>{membersById.get(detailEntry.payerId) ?? detailEntry.payerId}</strong></div>
              <div><span>PAYMENT ACCOUNT</span><strong>{accounts.find((account) => account.id === detailEntry.accountId)?.name ?? '—'}</strong></div>
              <div><span>CATEGORY</span><strong>{categories.find((category) => category.id === detailEntry.categoryId)?.name ?? '—'}</strong></div>
              <div><span>PAID</span><strong>{formatPaidTimestamp(getLedgerEntryPaidTimestamp(detailEntry))}</strong></div>
              {detailEntry.entryType === 'prepaid_multi_day' && <><div><span>USAGE START</span><strong>{formatDate(detailEntry.usageStart)}</strong></div><div><span>USAGE END</span><strong>{formatDate(detailEntry.usageEnd)}</strong></div></>}
              {detailEntry.entryType === 'transport' && <><div><span>TRANSPORT</span><strong>{TRANSPORT_LABELS[detailEntry.transportMode]}</strong></div><div><span>OUTBOUND</span><strong>{formatDate(detailEntry.outboundDate)}</strong></div>{detailEntry.journeyType === 'round_trip' && <div><span>RETURN</span><strong>{formatDate(detailEntry.returnDate)}</strong></div>}</>}
              <div><span>STATUS</span><strong>{detailEntry.isPending ? 'Pending' : detailEntry.includeInCost ? 'Included in statistics' : 'Excluded from statistics'}</strong></div>
            </div>
            {detailEntry.note?.trim() && <div className="vela-ledger-detail-note"><span>NOTE</span><p>{detailEntry.note}</p></div>}
            <div className="vela-ledger-detail-footer">
              <button type="button" onClick={() => { const entry = detailEntry; setDetailEntry(null); openEditor(entry); }}><Pencil size={15} strokeWidth={1.7} /> Edit</button>
            </div>
          </div>
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
                  {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
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
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
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

            <div className="mt-4">
              <span className="mb-2 block text-xs uppercase tracking-[0.12em] text-[#857a6a]">Participants &amp; Split</span>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#eee5d5] p-1">
                {([
                  ['equal', 'Equal Split'],
                  ['preset_percentage', 'Preset'],
                  ['custom_percentage', 'Custom'],
                ] as const).map(([value, label]) => {
                  const disabled = value === 'preset_percentage' && !selectedTrip.allocationRules?.percentages;
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={disabled}
                      onClick={() => setEditDraft((draft) => draft ? { ...draft, allocationMode: value, percentages: value === 'custom_percentage' ? draft.percentages : draft.percentages } : draft)}
                      className={`min-h-9 rounded-lg px-1 text-[11px] font-medium ${editDraft.allocationMode === value ? 'bg-white text-[#17243a] shadow-sm' : 'text-[#746b5e]'} ${disabled ? 'opacity-35' : ''}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {editDraft.allocationMode === 'preset_percentage' && selectedTrip.allocationRules?.percentages && (
                <div className="mt-2 rounded-xl bg-[#fbf7ee] px-3 py-2 text-[11px] leading-4 text-[#6f6659]">
                  {Object.entries(selectedTrip.allocationRules.percentages)
                    .filter(([id, percentage]) => selectedTrip.members.some((member) => member.id === id) && Number(percentage) > 0)
                    .map(([id, percentage]) => `${members.find((member) => member.id === id)?.name ?? id} ${percentage}%`)
                    .join(' · ')}
                </div>
              )}

              {editDraft.allocationMode !== 'preset_percentage' && (
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {members.filter((member) => member.archived !== true).map((member) => {
                    const selected = editDraft.participantIds.includes(member.id);
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => setEditDraft((draft) => {
                          if (!draft) return draft;
                          const participantIds = selected
                            ? draft.participantIds.filter((id) => id !== member.id)
                            : [...draft.participantIds, member.id];
                          return {
                            ...draft,
                            participantIds,
                            percentages: participantIds.includes(member.id)
                              ? { ...draft.percentages, [member.id]: draft.percentages[member.id] ?? 0 }
                              : draft.percentages,
                          };
                        })}
                        className={`min-h-9 rounded-xl border px-1 text-[11px] font-medium ${selected ? 'border-[#17243a] bg-[#17243a] text-white' : 'border-black/5 bg-[#fbf7ee] text-[#17243a]'}`}
                      >
                        {member.name}
                        {editDraft.allocationMode === 'custom_percentage' && selected && (
                          <span className="ml-1 opacity-80">{editDraft.percentages[member.id] ?? 0}%</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {editDraft.allocationMode === 'custom_percentage' && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {editDraft.participantIds.map((memberId) => {
                    const member = selectedTrip.members.find((item) => item.id === memberId);
                    if (!member) return null;
                    return (
                      <label key={memberId} className="flex min-h-11 items-center justify-between rounded-xl bg-[#fbf7ee] px-3 shadow-[inset_0_0_0_1px_rgba(80,64,42,.10)]">
                        <span className="text-xs">{member.name}</span>
                        <span className="flex items-center gap-1">
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max="100"
                            step="0.01"
                            value={editDraft.percentages[memberId] ?? 0}
                            onChange={(event) => setEditDraft((draft) => draft ? { ...draft, percentages: { ...draft.percentages, [memberId]: Number(event.target.value) || 0 } } : draft)}
                            className="w-14 bg-transparent text-right text-sm outline-none"
                            aria-label={`${member.name} percentage`}
                          />
                          <span className="text-xs text-[#857a6a]">%</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

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
