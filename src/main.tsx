import React, { useMemo, useState } from 'react';
import { BookOpen, Compass, Home as HomeIcon, Plus, Scale, Settings } from 'lucide-react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './vela-polish.css';
import './vela-secondary-polish.css';
import './vela-secondary-finish.css';
import './vela-home-shell.css';
import HomePage from './Home';
import TripManager from './components/TripManager';
import { QuickEntry } from './components/QuickEntry';
import { BalanceEngine } from './components/BalanceEngine';
import { LedgerView } from './components/LedgerView';
import { calculateFinancialTotals } from './core/calculations';
import { useVelaStore } from './store/useVelaStore';

type Tab = 'Home' | 'Ledger' | 'Balance' | 'Logbook' | 'Atelier';
const nav = [
  { label: 'Home', icon: HomeIcon },
  { label: 'Ledger', icon: BookOpen },
  { label: 'Balance', icon: Scale },
  { label: 'Logbook', icon: Compass },
  { label: 'Atelier', icon: Settings },
] as const;

const Logbook: React.FC = () => {
  const trip = useVelaStore((state) => state.getCurrentTrip());
  const totals = useMemo(() => calculateFinancialTotals(trip?.ledger ?? []), [trip]);
  if (!trip) return <section className="vela-secondary-page"><span className="vela-kicker">LOGBOOK</span><h1>Logbook</h1><p>Select or start a trip to review its financial record.</p></section>;
  return <section className="vela-secondary-page"><span className="vela-kicker">LOGBOOK · {trip.title}</span><h1>Financial Reflection</h1><div className="vela-logbook-stats"><div><small>TOTAL</small><b>¥{totals.financialTotal.toFixed(2)}</b></div><div><small>SETTLED</small><b>¥{totals.settledAmount.toFixed(2)}</b></div><div><small>PENDING</small><b>¥{totals.pendingAmount.toFixed(2)}</b></div></div><p>{trip.ledger.length} payment records in the current trip.</p></section>;
};

const App: React.FC = () => {
  const [tab, setTab] = useState<Tab>('Home');
  const [quickOpen, setQuickOpen] = useState(false);
  const currentTrip = useVelaStore((state) => state.getCurrentTrip());
  const handleNavigate = (next: Tab) => { setQuickOpen(false); setTab(next); window.scrollTo({ top: 0 }); };
  const content = tab === 'Home' ? <HomePage onNavigate={handleNavigate} />
    : tab === 'Ledger' ? <main className="page vela-secondary-shell"><LedgerView /></main>
    : tab === 'Balance' ? <main className="page vela-secondary-shell"><BalanceEngine /></main>
    : tab === 'Logbook' ? <Logbook />
    : <main className="page vela-secondary-shell"><TripManager /></main>;

  return <div className="vela-app-root">
    {content}
    <nav className="vela-global-nav" aria-label="Primary navigation">
      {nav.map(({ label, icon: Icon }) => <button key={label} type="button" className={tab === label ? 'active' : ''} onClick={() => handleNavigate(label)}><Icon size={18} strokeWidth={1.7} /><span>{label}</span></button>)}
    </nav>
    {currentTrip && <button type="button" className="vela-global-quick" aria-label="Quick Entry" onClick={() => setQuickOpen(true)}><Plus size={25} strokeWidth={1.5} /></button>}
    {quickOpen && <div className="vela-quick-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setQuickOpen(false); }}><div className="vela-quick-sheet"><QuickEntry onClose={() => setQuickOpen(false)} /></div></div>}
  </div>;
};

createRoot(document.getElementById('root')!).render(<App />);
