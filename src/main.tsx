import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './vela-polish.css';
import './vela-secondary-polish.css';
import './vela-secondary-finish.css';
import TripManager from './components/TripManager';
import { QuickEntry } from './components/QuickEntry';
import { BalanceEngine } from './components/BalanceEngine';
import { LedgerView } from './components/LedgerView';
import { useVelaStore } from './store/useVelaStore';

const App: React.FC = () => {
  const currentTrip = useVelaStore((state) => state.getCurrentTrip());

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.eyebrow}>VELA · CORE</div>
          <h1 style={styles.title}>Trip Ledger</h1>
          <p style={styles.subtitle}>
            {currentTrip ? `Current Trip: ${currentTrip.title}` : 'Select or start a trip to continue.'}
          </p>
        </div>
      </header>

      <TripManager />

      {currentTrip && (
        <div style={styles.coreStack}>
          <QuickEntry />
          <BalanceEngine />
          <LedgerView />
        </div>
      )}
    </main>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100dvh',
    boxSizing: 'border-box',
    padding: '24px 16px 48px',
    background: '#FAF9F5',
    color: '#172033',
  },
  header: {
    maxWidth: 760,
    margin: '0 auto 18px',
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: '0.16em',
    opacity: 0.55,
  },
  title: {
    margin: '4px 0',
    fontSize: 30,
  },
  subtitle: {
    margin: 0,
    fontSize: 13,
    opacity: 0.65,
  },
  coreStack: {
    maxWidth: 760,
    margin: '0 auto',
  },
};

createRoot(document.getElementById('root')!).render(<App />);
