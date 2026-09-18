import { getTripDestinations, getTripPrimaryCurrency, getTripStartDate } from '../../core/travelSegment';
import React, { useMemo, useState } from 'react';
import { TripStatus } from '../../core/domain';
import { useVelaStore } from '../../store/useVelaStore';
import { generateTripContextHub } from '../../utils/tripContextHubEngine';

const statusLabel: Record<TripStatus, string> = { planning: 'Planning', traveling: 'Traveling', achieve: 'Achieve' };
const money = (amount: number): string => amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
const dateLabel = (timestamp: number): string => new Date(timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

export const TripContextHub: React.FC = () => {
  const trips = useVelaStore((state) => state.trips);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedTrip = trips.find((trip) => trip.id === selectedId) ?? trips.find((trip) => trip.status === 'traveling') ?? trips[0] ?? null;
  const context = useMemo(() => selectedTrip ? generateTripContextHub(selectedTrip) : null, [selectedTrip]);

  return (
    <section style={styles.container} aria-label="Trip Context Hub">
      <div style={styles.header}>
        <div><div style={styles.eyebrow}>TRIP CONTEXT HUB</div><h2 style={styles.title}>Your Journey, In Context</h2></div>
        {selectedTrip && <span style={styles.status}>{statusLabel[selectedTrip.status]}</span>}
      </div>

      <div style={styles.tripPicker} aria-label="Select trip">
        {trips.map((trip) => <button key={trip.id} type="button" onClick={() => setSelectedId(trip.id)} style={{ ...styles.tripButton, ...(selectedTrip?.id === trip.id ? styles.tripButtonActive : {}) }}><strong>{trip.title}</strong><span>{getTripDestinations(trip).join(' · ') || '—'} · {dateLabel(getTripStartDate(trip))}</span></button>)}
      </div>

      {!selectedTrip || !context ? <div style={styles.empty}>No trips yet.</div> : <>
        <div style={styles.hero}>
          <div><div style={styles.heroTitle}>{selectedTrip.title}</div><div style={styles.heroSub}>{getTripDestinations(selectedTrip).join(' · ') || 'Destination not set'}</div></div>
          <div style={styles.duration}><strong>{context.durationDays}</strong><span>days</span></div>
        </div>

        <div style={styles.grid}>
          <section style={styles.card} aria-labelledby="hub-people"><h3 id="hub-people" style={styles.cardTitle}>PEOPLE</h3><div style={styles.people}>{context.memberNames.map((name) => <span key={name} style={styles.pill}>{name}</span>)}</div></section>
          <section style={styles.card} aria-labelledby="hub-accounts"><h3 id="hub-accounts" style={styles.cardTitle}>ACCOUNTS USED</h3>{context.accounts.length ? context.accounts.map((account) => <div key={account.accountId} style={styles.row}><span>{account.account}</span><span>{account.entryCount} entries</span></div>) : <div style={styles.muted}>No ledger entries yet.</div>}</section>
        </div>

        <section style={styles.card} aria-labelledby="hub-spending"><div style={styles.sectionHead}><h3 id="hub-spending" style={styles.cardTitle}>SPENDING BREAKDOWN</h3><span style={styles.muted}>{context.ledgerCount} ledger entries</span></div>{context.categories.length ? context.categories.map((item) => <div key={item.category} style={styles.categoryRow}><div style={styles.row}><span>{item.category}</span><strong>{money(item.amount)} · {item.share}%</strong></div><div style={styles.bar}><div style={{ ...styles.barFill, width: `${Math.min(100, item.share)}%` }} /></div></div>) : <div style={styles.muted}>No spending recorded yet.</div>}</section>

        <section style={styles.card} aria-labelledby="hub-reflection"><div className="hub-reflection-head" style={styles.sectionHead}><h3 id="hub-reflection" style={styles.cardTitle}>TRIP REFLECTION</h3><span style={styles.muted}>{getTripPrimaryCurrency(selectedTrip)}</span></div><div style={styles.reflectionGrid}>{Object.entries(context.totalExpenditure).map(([currency, amount]) => <div key={currency}><div style={styles.metricLabel}>TOTAL SPEND</div><strong style={styles.metric}>{money(amount)} {currency}</strong></div>)}{Object.entries(context.averageCostPerDay).map(([currency, amount]) => <div key={`avg-${currency}`}><div style={styles.metricLabel}>AVERAGE / DAY</div><strong style={styles.metric}>{money(amount)} {currency}</strong></div>)}</div></section>

        <section style={styles.card} aria-labelledby="hub-history"><div style={styles.sectionHead}><h3 id="hub-history" style={styles.cardTitle}>HISTORY</h3><span style={styles.muted}>Ledger timeline</span></div>{context.history.length ? <div style={styles.history}>{context.history.map((entry) => <div key={entry.id} style={styles.historyRow}><div><strong>{entry.category}</strong><div style={styles.historyMeta}>{entry.account} · {dateLabel(entry.createdAt)}</div></div><span style={entry.isRefund ? styles.refund : styles.historyAmount}>{entry.isRefund ? '−' : ''}{money(Math.abs(entry.amount))} {entry.currency}</span></div>)}</div> : <div style={styles.muted}>No history yet.</div>}</section>
      </>}
    </section>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: { padding: 20, border: '1px solid #d7d4ca', borderRadius: 14, background: '#fff', color: '#172033', boxSizing: 'border-box' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  eyebrow: { fontSize: 10, letterSpacing: '0.16em', opacity: 0.55 }, title: { margin: '3px 0 0', fontSize: 24 }, status: { padding: '4px 8px', borderRadius: 999, background: '#f0eee8', fontSize: 10, letterSpacing: '0.06em' },
  tripPicker: { display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, marginBottom: 6 }, tripButton: { flex: '0 0 auto', minWidth: 150, display: 'grid', gap: 3, textAlign: 'left', border: '1px solid #e2dfd6', borderRadius: 9, padding: '9px 10px', background: '#fffdf8', color: '#172033', cursor: 'pointer' }, tripButtonActive: { borderColor: '#172033', background: '#f7f5ef' },
  hero: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '14px 0 18px' }, heroTitle: { fontSize: 20, fontWeight: 650 }, heroSub: { marginTop: 3, fontSize: 12, opacity: 0.6 }, duration: { display: 'flex', alignItems: 'baseline', gap: 5 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 8 }, card: { padding: 13, border: '1px solid #e2dfd6', borderRadius: 10, marginBottom: 8 }, cardTitle: { margin: 0, fontSize: 10, letterSpacing: '0.14em', fontWeight: 650 }, people: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }, pill: { padding: '5px 8px', borderRadius: 999, background: '#f0eee8', fontSize: 11 },
  row: { display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginTop: 9, fontSize: 12 }, muted: { fontSize: 10, opacity: 0.52 }, sectionHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, categoryRow: { marginTop: 9 }, bar: { height: 4, marginTop: 5, borderRadius: 999, background: '#ece9e1', overflow: 'hidden' }, barFill: { height: '100%', borderRadius: 999, background: '#172033' }, reflectionGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginTop: 12 }, metricLabel: { fontSize: 9, letterSpacing: '0.1em', opacity: 0.5 }, metric: { display: 'block', marginTop: 4, fontSize: 16 }, history: { display: 'grid', gap: 0, marginTop: 8 }, historyRow: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderTop: '1px solid #eeeae2', fontSize: 12 }, historyMeta: { marginTop: 3, fontSize: 10, opacity: 0.5 }, historyAmount: { whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }, refund: { whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', opacity: 0.6 }, empty: { padding: 18, textAlign: 'center', color: '#7b7d82', fontSize: 13 },
};

export default TripContextHub;
