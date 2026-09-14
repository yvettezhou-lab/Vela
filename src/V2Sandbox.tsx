import React from 'react';
import { TripManager } from './components/TripManager';
import { QuickEntry } from './components/QuickEntry';
import { BalanceEngine } from './components/BalanceEngine';
import { useVelaStore } from './store/useVelaStore';

export default function V2Sandbox() {
  const currentTrip = useVelaStore((state) => state.getCurrentTrip());
  const trips = useVelaStore((state) => state.trips);

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.eyebrow}>ISOLATED TEST</div>
          <h1 style={styles.title}>V2 Trip Manager + Ledger</h1>
          <p style={styles.meta}>
            Current Trip: {currentTrip?.title ?? '—'} · Traveling trips: {trips.filter((trip) => trip.status === 'traveling').length}
          </p>
        </div>
        <div style={styles.badge}>Core Store</div>
      </header>

      <div style={styles.stack}>
        <TripManager />

        <section style={styles.panel}>
          <p style={styles.note}>
            Sandbox only. Trip Manager controls the real Trip context; Quick Entry writes through useVelaStore, while Balance Engine reads the same store projection.
          </p>
          <QuickEntry onClose={() => undefined} />
          <BalanceEngine />
        </section>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100dvh', padding: 24, background: '#f6f5f0', color: '#172033', boxSizing: 'border-box' },
  header: { maxWidth: 760, margin: '0 auto 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 },
  eyebrow: { fontSize: 11, letterSpacing: '0.14em', opacity: 0.6 },
  title: { margin: '4px 0', fontSize: 28 },
  meta: { margin: 0, opacity: 0.65 },
  badge: { padding: '6px 9px', border: '1px solid #d7d4ca', borderRadius: 999, fontSize: 12 },
  stack: { maxWidth: 760, margin: '0 auto', display: 'grid', gap: 16 },
  panel: { display: 'grid', gap: 12 },
  note: { padding: '10px 12px', margin: 0, border: '1px dashed #c9c5ba', borderRadius: 8, fontSize: 13 },
};
