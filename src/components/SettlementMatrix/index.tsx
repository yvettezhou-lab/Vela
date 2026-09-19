import React, { useMemo, useState } from 'react';
import { ChevronDown, Scale } from 'lucide-react';
import { useVelaStore } from '../../store/useVelaStore';
import { calculateSegmentSettlements, settlementMemberName, type SettlementSegment } from '../../core/settlement';

const money = (value: number) => `¥${value.toFixed(2)}`;
const originalMoney = (values: Record<string, number>) =>
  Object.entries(values)
    .filter(([, value]) => Math.abs(value) >= 0.01)
    .map(([currency, value]) => `${currency} ${Math.abs(value).toFixed(2)}${value < 0 ? ' refund' : ''}`)
    .join(' · ');

const formatDate = (value: number) =>
  new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

const PayerRow: React.FC<{
  segment: SettlementSegment;
  payerId: string;
  members: ReturnType<typeof useVelaStore.getState>['trips'][number]['members'];
}> = ({ segment, payerId, members }) => {
  const payer = segment.payers.find((item) => item.payerId === payerId)!;
  const [open, setOpen] = useState(true);

  return (
    <article className="settlement-payer">
      <button type="button" className="settlement-payer-head" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span className="settlement-payer-copy">
          <small>PAYER</small>
          <strong>{settlementMemberName(members, payer.payerId)}</strong>
        </span>
        <span className="settlement-payer-paid">
          <small>PAID · CNY</small>
          <strong>{money(payer.paidCny)}</strong>
        </span>
        <ChevronDown size={16} className={open ? 'settlement-chevron open' : 'settlement-chevron'} aria-hidden="true" />
      </button>

      {open && (
        <div className="settlement-debt-list">
          <div className="settlement-original">
            <span>Original paid</span>
            <strong>{originalMoney(payer.originalPaid) || '—'}</strong>
          </div>
          {payer.debts.length ? (
            payer.debts.map((debt) => (
              <div className="settlement-debt" key={debt.memberId}>
                <div>
                  <small>OWES {settlementMemberName(members, payer.payerId).toUpperCase()}</small>
                  <strong>{settlementMemberName(members, debt.memberId)}</strong>
                </div>
                <strong>{money(debt.amountCny)}</strong>
              </div>
            ))
          ) : (
            <div className="settlement-no-debt">No member balance owed to this payer.</div>
          )}
        </div>
      )}
    </article>
  );
};

export const SettlementMatrix: React.FC = () => {
  const trips = useVelaStore((state) => state.trips);
  const defaultTrip = useMemo(() => {
    const traveling = trips.find((trip) => trip.status === 'traveling');
    if (traveling) return traveling;
    return trips
      .filter((trip) => trip.status === 'planning')
      .sort((a, b) => new Date(a.segments[0]?.startDate ?? 0).getTime() - new Date(b.segments[0]?.startDate ?? 0).getTime())[0] ?? null;
  }, [trips]);
  const [selectedTripId, setSelectedTripId] = useState('');
  const selectedTrip = trips.find((trip) => trip.id === selectedTripId) ?? defaultTrip;
  const segments = useMemo(
    () => (selectedTrip ? calculateSegmentSettlements(selectedTrip) : []),
    [selectedTrip],
  );

  if (!selectedTrip) {
    return (
      <section className="settlement-page">
        <header className="settlement-header">
          <span className="settlement-overline">SETTLEMENT</span>
          <h1>Settlement</h1>
          <p>Create a journey before calculating shared expenses.</p>
        </header>
        <div className="settlement-empty">
          <Scale size={20} />
          <span>No journey available yet.</span>
        </div>
      </section>
    );
  }

  return (
    <main className="settlement-page">
      <header className="settlement-header">
        <div>
          <span className="settlement-overline">SETTLEMENT / {selectedTrip.status.toUpperCase()}</span>
          <h1>Settlement</h1>
          <p>{selectedTrip.title || 'Selected journey'}</p>
        </div>
        {trips.length > 1 && (
          <label className="settlement-trip-select">
            <span>TRIP</span>
            <select aria-label="Settlement trip" value={selectedTrip.id} onChange={(event) => setSelectedTripId(event.target.value)}>
              {trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.title || 'Untitled journey'}</option>)}
            </select>
          </label>
        )}
      </header>

      <section className="settlement-summary">
        <div><span>SEGMENTS</span><strong>{segments.length}</strong></div>
        <div><span>PAYERS</span><strong>{segments.reduce((sum, segment) => sum + segment.payers.length, 0)}</strong></div>
        <div><span>LEDGER</span><strong>{selectedTrip.ledger.filter((entry) => !entry.isPending).length}</strong></div>
      </section>

      <section className="settlement-segments" aria-label="Settlement by segment">
        {segments.map((segment, index) => {
          const hasActivity = segment.payers.length > 0;
          return (
            <article className="settlement-segment" key={segment.segmentId}>
              <button type="button" className="settlement-segment-head" onClick={() => {
                const target = document.getElementById(`settlement-segment-${segment.segmentId}`);
                target?.classList.toggle('is-collapsed');
              }}>
                <span className="settlement-segment-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="settlement-segment-title">
                  <strong>{segment.label}</strong>
                  <small>{formatDate(segment.startDate)} — {formatDate(segment.endDate)} · {segment.primaryCurrency}</small>
                </span>
                <span className="settlement-segment-total">{hasActivity ? money(segment.payers.reduce((sum, payer) => sum + payer.paidCny, 0)) : '—'}</span>
                <ChevronDown size={17} aria-hidden="true" />
              </button>
              <div id={`settlement-segment-${segment.segmentId}`} className="settlement-segment-body">
                {hasActivity ? (
                  segment.payers.map((payer) => (
                    <PayerRow key={payer.payerId} segment={segment} payerId={payer.payerId} members={selectedTrip.members} />
                  ))
                ) : (
                  <div className="settlement-segment-empty">No settled expenses in this segment.</div>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
};

export default SettlementMatrix;
