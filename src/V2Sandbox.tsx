import React, { useEffect, useState } from 'react';
import { QuickEntry } from './components/QuickEntry';
import { useVelaStore } from './store/useVelaStore';

const TEST_TRIP_ID = 'v2-sandbox-trip';
const TEST_TRIP = {
  id: TEST_TRIP_ID,
  title: 'V2 Quick Entry Sandbox',
  destination: 'Kunming Test',
  startDate: 1789344000000,
  endDate: 1789948800000,
  status: 'traveling' as const,
  localCurrency: 'CNY',
  members: [
    { id: 'v2-member-1', name: 'Test A' },
    { id: 'v2-member-2', name: 'Test B' },
  ],
  accounts: [{ id: 'v2-account-1', name: 'Test Card' }],
  categories: [
    { id: 'cat_transport', name: 'Transport', type: 'expense' },
    { id: 'cat_food', name: 'Food', type: 'expense' },
  ],
  ledger: [],
  createdAt: 1789388919186,
  updatedAt: 1789388919186,
};

export default function V2Sandbox() {
  const currentTrip = useVelaStore((state) => state.getCurrentTrip());
  const trips = useVelaStore((state) => state.trips);
  const addTrip = useVelaStore((state) => state.addTrip);
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    if (currentTrip) {
      setReady(true);
      return;
    }

    try {
      addTrip(TEST_TRIP);
      setReady(true);
    } catch (error) {
      setInitError(error instanceof Error ? error.message : String(error));
    }
  }, [currentTrip, addTrip]);

  const travelingCount = trips.filter((trip) => trip.status === 'traveling').length;

  if (initError) {
    return <main style={styles.page}><h1>V2 Quick Entry Sandbox</h1><pre style={styles.error}>{initError}</pre></main>;
  }

  if (!ready) {
    return <main style={styles.page}><h1>V2 Quick Entry Sandbox</h1><p>Initializing test trip…</p></main>;
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.eyebrow}>ISOLATED TEST</div>
          <h1 style={styles.title}>V2 Quick Entry</h1>
          <p style={styles.meta}>Current Trip: {currentTrip?.title ?? '—'} · Traveling trips: {travelingCount}</p>
        </div>
        <div style={styles.badge}>Core Store</div>
      </header>
      <section style={styles.panel}>
        <p style={styles.note}>Sandbox only. Quick Entry writes exclusively through useVelaStore.</p>
        <QuickEntry onClose={() => undefined} />
      </section>
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
  panel: { maxWidth: 760, margin: '0 auto' },
  note: { padding: '10px 12px', margin: '0 0 12px', border: '1px dashed #c9c5ba', borderRadius: 8, fontSize: 13 },
  error: { whiteSpace: 'pre-wrap', color: '#a11' },
};
