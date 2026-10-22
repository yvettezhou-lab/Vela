import './styles.css';
import React, { useMemo, useState } from 'react';
import { ChevronDown, Download, Scale } from 'lucide-react';
import { useVelaStore } from '../../store/useVelaStore';
import { calculateMinimalSettlementTransfers, calculateSegmentSettlements, settlementMemberName, type SettlementSegment } from '../../core/settlement';
import { getSegmentForLedgerEntry } from '../../core/travelSegment';
import { isLedgerEntryIncludedInCost } from '../../core/ledger';
import type { Trip } from '../../core/domain';
import { exportSettlementCollection, exportSettlementCollectionAll, exportSettlementRaw } from '../../core/settlementExport';

const money = (value: number) => `¥${value.toFixed(2)}`;
const originalMoney = (values: Record<string, number>) => Object.entries(values).filter(([, value]) => Math.abs(value) >= 0.01).map(([currency, value]) => `${currency} ${Math.abs(value).toFixed(2)}${value < 0 ? ' refund' : ''}`).join(' · ');
const formatDate = (value: number) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

const PayerRow: React.FC<{ segment: SettlementSegment; payerId: string; members: ReturnType<typeof useVelaStore.getState>['trips'][number]['members'] }> = ({ segment, payerId, members }) => {
  const payer = segment.payers.find((item) => item.payerId === payerId)!;
  const [open, setOpen] = useState(false);
  return <article className="settlement-payer">
    <button type="button" className="settlement-payer-head" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
      <span className="settlement-payer-copy"><small>PAYER</small><strong>{settlementMemberName(members, payer.payerId)}</strong></span>
      <span className="settlement-payer-paid"><small>PAID · CNY</small><strong>{money(payer.paidCny)}</strong></span>
      <ChevronDown size={16} className={open ? 'settlement-chevron open' : 'settlement-chevron'} aria-hidden="true" />
    </button>
    {open && <div className="settlement-debt-list">
      <div className="settlement-original"><span>Original paid</span><strong>{originalMoney(payer.originalPaid) || '—'}</strong></div>
      {payer.debts.length ? payer.debts.map((debt) => <div className="settlement-debt" key={debt.memberId}><div><small>OWES {settlementMemberName(members, payer.payerId).toUpperCase()}</small><strong>{settlementMemberName(members, debt.memberId)}</strong></div><strong>{money(debt.amountCny)}</strong></div>) : <div className="settlement-no-debt">No member balance owed to this payer.</div>}
    </div>}
  </article>;
};

const TransferRow: React.FC<{ transfer: { fromMemberId: string; toMemberId: string; amountCny: number }; trip: Trip; segment: SettlementSegment }> = ({ transfer, trip, segment }) => {
  const [open, setOpen] = useState(false);
  const related = trip.ledger.filter((entry) => {
    if (entry.isPending || getSegmentForLedgerEntry(trip.segments, entry)?.id !== segment.segmentId) return false;
    const involvesPair = (entry.payerId === transfer.toMemberId && entry.allocations.some((a) => a.memberId === transfer.fromMemberId)) || (entry.payerId === transfer.fromMemberId && entry.allocations.some((a) => a.memberId === transfer.toMemberId));
    return involvesPair;
  }).map((entry) => {
    const otherId = entry.payerId === transfer.toMemberId ? transfer.fromMemberId : transfer.toMemberId;
    const amount = entry.allocations.find((a) => a.memberId === otherId)?.amount ?? 0;
    const dateValue = entry.entryType === 'flight' ? entry.outboundDate : entry.entryType === 'transport' ? entry.paymentDate ?? entry.outboundDate : entry.paymentDate;
    const category = trip.categories.find((item) => item.id === entry.categoryId)?.name ?? entry.categoryId;
    return { id: entry.id, payer: settlementMemberName(trip.members, entry.payerId), other: settlementMemberName(trip.members, otherId), date: new Date(dateValue).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), category, note: entry.note?.trim() || '', amount: entry.isRefund ? -Math.abs(amount) : amount, refund: entry.isRefund };
  });
  return <div className={`settlement-transfer${open ? ' is-open' : ''}`}>
    <button type="button" className="settlement-final-row" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
      <span><strong>{settlementMemberName(trip.members, transfer.fromMemberId)}</strong><span> → </span><strong>{settlementMemberName(trip.members, transfer.toMemberId)}</strong></span>
      <span className="settlement-transfer-amount">{money(transfer.amountCny)} <ChevronDown size={14} /></span>
    </button>
    {open && <div className="settlement-transfer-details">
      <p>Related ledger items · net settlement may include offsets across other members.</p>
      {related.length ? related.map((item) => <div className="settlement-transfer-item" key={item.id}><div><strong>{item.category}</strong><span>{item.date} · {item.payer} paid · {item.other}'s share{item.note ? ` · ${item.note}` : ''}</span></div><strong className={item.refund ? 'is-refund' : ''}>{money(item.amount)}</strong></div>) : <span className="settlement-no-debt">No direct ledger items for this pair in this segment.</span>}
    </div>}
  </div>;
};

const SegmentRow: React.FC<{ segment: SettlementSegment; index: number; trip: Trip; members: Trip['members']; showSegmentLabel: boolean }> = ({ segment, index, trip, members, showSegmentLabel }) => {
  const hasActivity = segment.payers.length > 0;
  const transfers = calculateMinimalSettlementTransfers(segment);
  return <article className="settlement-segment settlement-segment-static">
    {showSegmentLabel && <div className="settlement-static-label"><span>{String(index + 1).padStart(2, '0')}</span><strong>{segment.label}</strong><small>{formatDate(segment.startDate)} — {formatDate(segment.endDate)} · {segment.primaryCurrency}</small></div>}
    {hasActivity ? <>
      <section className="settlement-final">
        <div className="settlement-final-heading"><span>FINAL SETTLEMENT</span><strong>{transfers.length} {transfers.length === 1 ? 'TRANSFER' : 'TRANSFERS'}</strong></div>
        {transfers.length ? transfers.map((transfer, transferIndex) => (
          <TransferRow key={`${transfer.fromMemberId}-${transfer.toMemberId}-${transfer.amountCny}-${transferIndex}`} transfer={transfer} trip={trip} segment={segment} />
        )) : <div className="settlement-no-debt">Everyone is settled.</div>}
      </section>
      <div className="settlement-detail-label">PAYMENT DETAIL</div>
      {segment.payers.map((payer) => <PayerRow key={payer.payerId} segment={segment} payerId={payer.payerId} members={members} />)}
    </> : <div className="settlement-segment-empty">No settled expenses in this segment.</div>}
  </article>;
};

const ExportPanel: React.FC<{ trip: ReturnType<typeof useVelaStore.getState>['trips'][number] }> = ({ trip }) => {
  const activeMembers = trip.members.filter((member) => member.archived !== true);
  const [exportTarget, setExportTarget] = useState('all');
  const validTarget = exportTarget === 'all' || exportTarget === 'all-people' || activeMembers.some((member) => member.id === exportTarget);
  const target = validTarget ? exportTarget : 'all';
  const download = () => {
    if (target === 'all') exportSettlementRaw(trip);
    else if (target === 'all-people') exportSettlementCollectionAll(trip);
    else exportSettlementCollection(trip, target);
  };
  return <section className="settlement-export">
    <div className="settlement-export-heading"><span>EXPORT</span><strong>Settlement files</strong></div>
    <div className="settlement-export-actions settlement-export-picker">
      <select aria-label="Export type" value={target} onChange={(event) => setExportTarget(event.target.value)}>
        <option value="all">All</option>
        <option value="all-people">All Members</option>
        {activeMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
      </select>
      <button type="button" className="settlement-export-button" disabled={target !== 'all' && target !== 'all-people' && !activeMembers.some((member) => member.id === target)} onClick={download}><Download size={15} /><span>Download</span></button>
    </div>
  </section>;
};

export const SettlementMatrix: React.FC = () => {
  const trips = useVelaStore((state) => state.trips);
  const defaultTrip = useMemo(() => { const traveling = trips.find((trip) => trip.status === 'traveling'); if (traveling) return traveling; return trips.filter((trip) => trip.status === 'planning').sort((a, b) => Math.min(...a.segments.map((segment) => segment.startDate)) - Math.min(...b.segments.map((segment) => segment.startDate)))[0] ?? null; }, [trips]);
  const [selectedTripId, setSelectedTripId] = useState('');
  const selectedTrip = trips.find((trip) => trip.id === selectedTripId) ?? defaultTrip;
  const segments = useMemo(() => selectedTrip ? calculateSegmentSettlements(selectedTrip) : [], [selectedTrip]);

  if (!selectedTrip) return <section className="settlement-page"><header className="settlement-header"><span className="settlement-overline">SETTLEMENT</span><h1>Settlement</h1><p>Create a journey before calculating shared expenses.</p></header><div className="settlement-empty"><Scale size={20} /><span>No journey available yet.</span></div></section>;

  return <main className="settlement-page">
    <header className="settlement-header"><div><span className="settlement-overline">SETTLEMENT / {selectedTrip.status.toUpperCase()}</span><h1>Settlement</h1><p>{selectedTrip.title || 'Selected journey'}</p></div>{trips.length > 1 && <label className="settlement-trip-select"><span>TRIP</span><select aria-label="Settlement trip" value={selectedTrip.id} onChange={(event) => setSelectedTripId(event.target.value)}>{trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.title || 'Untitled journey'}</option>)}</select></label>}</header>
    <section className="settlement-summary settlement-count-summary"><div><span>SEGMENTS</span><strong>{segments.length}</strong></div><div><span>PAYERS</span><strong>{segments.reduce((sum, segment) => sum + segment.payers.length, 0)}</strong></div><div><span>LEDGER</span><strong>{selectedTrip.ledger.filter((entry) => !entry.isPending).length}</strong></div></section>
    <section className="settlement-summary settlement-financial-summary"><div><span>TOTAL AMOUNT</span><strong>{money(selectedTrip.ledger.filter((entry) => !entry.isPending).reduce((sum, entry) => sum + (entry.isRefund || entry.entryDirection === 'income' ? -Math.abs(entry.cnyEquivalent) : Math.abs(entry.cnyEquivalent)), 0))}</strong></div><div><span>INCLUDED IN STATS</span><strong>{money(selectedTrip.ledger.filter(isLedgerEntryIncludedInCost).reduce((sum, entry) => sum + (entry.isRefund || entry.entryDirection === 'income' ? -Math.abs(entry.cnyEquivalent) : Math.abs(entry.cnyEquivalent)), 0))}</strong></div><div><span>AVG. DAILY / PERSON</span><strong>{(() => { const dates = selectedTrip.segments.flatMap((segment) => [segment.startDate, segment.endDate]).filter(Number.isFinite); if (!dates.length) return money(0); const start = new Date(Math.min(...dates)); const end = new Date(Math.max(...dates)); const days = Math.max(1, Math.round((new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime() - new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()) / 86400000) + 1); const includedEntries = selectedTrip.ledger.filter(isLedgerEntryIncludedInCost); const participatingIds = new Set(includedEntries.flatMap((entry) => [entry.payerId, ...entry.allocations.filter((allocation) => Math.abs(allocation.amount) >= 0.01).map((allocation) => allocation.memberId)])); const people = Math.max(1, participatingIds.size); const total = includedEntries.reduce((sum, entry) => sum + (entry.isRefund || entry.entryDirection === 'income' ? -Math.abs(entry.cnyEquivalent) : Math.abs(entry.cnyEquivalent)), 0); return money(total / days / people); })()}</strong></div></section>
    <ExportPanel trip={selectedTrip} />
    <section className="settlement-segments" aria-label="Settlement transfers">{segments.map((segment, index) => <SegmentRow key={segment.segmentId} segment={segment} index={index} trip={selectedTrip} members={selectedTrip.members} showSegmentLabel={segments.length > 1} />)}</section>
  </main>;
};

export default SettlementMatrix;
