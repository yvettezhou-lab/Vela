import React, { useState } from 'react';
import { BookOpen, Compass, Home as HomeIcon, Plus, Scale, Settings } from 'lucide-react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './vela-polish.css';
import './vela-secondary-polish.css';
import './vela-secondary-finish.css';
import './vela-home-shell.css';
import HomePage from './Home';
import TripManager from './components/TripManager';
import { TripCreation } from './components/TripCreation';
import { QuickEntry } from './components/QuickEntry';
import { BalanceEngine } from './components/BalanceEngine';
import { LedgerView } from './components/LedgerView';
import LogbookView from './components/Logbook';
import { useVelaStore } from './store/useVelaStore';

type Tab = 'Home' | 'Ledger' | 'Balance' | 'Logbook' | 'Atelier';
const nav = [
  { label: 'Home', icon: HomeIcon },
  { label: 'Ledger', icon: BookOpen },
  { label: 'Balance', icon: Scale },
  { label: 'Logbook', icon: Compass },
  { label: 'Atelier', icon: Settings },
] as const;

const App: React.FC = () => {
  const [activeNav, setActiveNav] = useState<Tab>('Home');
  const [quickOpen, setQuickOpen] = useState(false);
  const [creationOpen, setCreationOpen] = useState(false);
  const currentTrip = useVelaStore((state) => state.getCurrentTrip());
  const hasActiveJourney = Boolean(currentTrip && currentTrip.status === 'traveling');
  const handleNavigate = (next: Tab) => { setQuickOpen(false); setCreationOpen(false); setActiveNav(next); window.scrollTo({ top: 0 }); };
  const handleCreated = () => { setActiveNav('Home'); setCreationOpen(false); };
  const content = activeNav === 'Home' ? <HomePage onNavigate={handleNavigate} onCreateTrip={() => setCreationOpen(true)} />
    : activeNav === 'Ledger' ? <main className="page vela-secondary-shell"><LedgerView /></main>
    : activeNav === 'Balance' ? <main className="page vela-secondary-shell"><BalanceEngine /></main>
    : activeNav === 'Logbook' ? <LogbookView />
    : <main className="page vela-secondary-shell"><TripManager /></main>;

  return <div className="vela-app-root">
    {content}
    <nav className="vela-global-nav" aria-label="Primary navigation">
      {nav.map(({ label, icon: Icon }) => <button key={label} type="button" className={activeNav === label ? 'active' : ''} onClick={() => handleNavigate(label)}><Icon size={18} strokeWidth={1.7} /><span>{label}</span></button>)}
    </nav>
    {hasActiveJourney && currentTrip && <button type="button" className="vela-global-quick" aria-label="Quick Entry" onClick={() => setQuickOpen(true)}><Plus size={25} strokeWidth={1.5} /></button>}
    {quickOpen && hasActiveJourney && currentTrip && <div className="vela-quick-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setQuickOpen(false); }}><div className="vela-quick-sheet"><QuickEntry onClose={() => setQuickOpen(false)} /></div></div>}
    {creationOpen && <div className="vela-quick-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreationOpen(false); }}><div className="vela-quick-sheet"><TripCreation onClose={() => setCreationOpen(false)} onCreated={handleCreated} /></div></div>}
  </div>;
};

createRoot(document.getElementById('root')!).render(<App />);
