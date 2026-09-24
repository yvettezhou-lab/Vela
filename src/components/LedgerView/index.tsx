import React, { useState } from 'react';
import { Trash2, ChevronDown } from 'lucide-react';
import { LedgerEntry } from '../../core/domain';
import { getLedgerEntryDate } from '../../core/travelSegment';
import { useVelaStore } from '../../store/useVelaStore';

const ENTRY_LABELS: Record<LedgerEntry['entryType'], string> = {
  standard: 'Standard',
  flight: 'Flight',
  prepaid_multi_day: 'Prepaid',
};

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';
};

export const LedgerView: React.FC = () => {
  const trips = useVelaStore((s) => s.trips);
  const currentTrip = useVelaStore((s) => s.getCurrentTrip());
  const deleteLedgerEntry = useVelaStore((s) => s.deleteLedgerEntry);
  const updateLedgerEntry = useVelaStore((s) => s.updateLedgerEntry);
  const [selectedTripId, setSelectedTripId] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending'>('all');
  const [segmentFilterId, setSegmentFilterId] = useState('');

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
                  <strong>{ENTRY_LABELS[entry.entryType]}</strong>
                  {entry.isPending && <span className="vela-ledger-badge pending">CNY Pending</span>}
                  {!entry.includeInCost && <span className="vela-ledger-badge muted">Excluded</span>}
                </div>
                <span className="vela-ledger-entry-meta">
                  {membersById.get(entry.payerId) ?? entry.payerId} · {formatDate(getLedgerEntryDate(entry))}
                </span>
                <span className="vela-ledger-entry-detail">
                  {entry.originalCurrency} · {entry.originalAmount.toFixed(2)} · CNY {entry.isPending ? 'Pending' : entry.cnyEquivalent.toFixed(2)}
                </span>
              </div>

              <div className="vela-ledger-entry-actions">
                {entry.isPending && (
                  <button type="button" className="vela-ledger-add-cny" onClick={() => fillCny(entry)}>
                    Add CNY
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`Delete ${ENTRY_LABELS[entry.entryType]} entry`}
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
    </section>
  );
};

export default LedgerView;
