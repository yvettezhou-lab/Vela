import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Compass, Home as HomeIcon, Scale, Settings } from 'lucide-react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './vela-polish.css';
import './vela-secondary-polish.css';
import './vela-secondary-finish.css';
import './vela-home-shell.css';
import './global-ux.css';
import HomePage from './Home';
import TripManager from './components/TripManager';
import { TripCreation } from './components/TripCreation';
import { QuickEntry } from './components/QuickEntry';
import { BalanceEngine } from './components/BalanceEngine';
import { LedgerView } from './components/LedgerView';
import LogbookView from './components/Logbook';
import { generateAnnualReflection, generateTripInsights } from './utils/reflectionEngine';
import { useVelaStore } from './store/useVelaStore';

type Tab = 'Home' | 'Ledger' | 'Balance' | 'Logbook' | 'Atelier';
const nav = [
  { label: 'Home', icon: HomeIcon },
  { label: 'Ledger', icon: BookOpen },
  { label: 'Balance', icon: Scale },
  { label: 'Logbook', icon: Compass },
  { label: 'Atelier', icon: Settings },
] as const;

const VelaConstellationIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6 18l6-10 6 4" stroke="#FAF9F5" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 4" />
    <circle cx="6" cy="18" r="1.5" fill="#FAF9F5" />
    <circle cx="12" cy="8" r="1.5" fill="#FAF9F5" />
    <circle cx="18" cy="12" r="1.5" fill="#FAF9F5" />
  </svg>
);

const App: React.FC = () => {
  const [activeNav, setActiveNav] = useState<Tab>('Home');
  const [quickOpen, setQuickOpen] = useState(false);
  const [creationOpen, setCreationOpen] = useState(false);
  const trips = useVelaStore((state) => state.trips);
  const currentTrip = useVelaStore((state) => state.getCurrentTrip());
  const currentYear = new Date().getFullYear();
  const reflectionTrips = useMemo(() => trips.filter((trip) => trip.status === 'achieve' || trip.status === 'traveling'), [trips]);
  const planningTrips = useMemo(() => trips.filter((trip) => trip.status === 'planning'), [trips]);
  const annualReflection = useMemo(() => generateAnnualReflection(reflectionTrips, currentYear), [reflectionTrips, currentYear]);
  const tripInsights = useMemo(() => reflectionTrips.map(generateTripInsights), [reflectionTrips]);
  const hasActiveJourney = Boolean(currentTrip && currentTrip.status === 'traveling');

  useEffect(() => {
    if (!quickOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [quickOpen]);

  const handleNavigate = (next: Tab) => { setQuickOpen(false); setCreationOpen(false); setActiveNav(next); window.scrollTo({ top: 0 }); };
  const handleCreated = () => { setActiveNav('Home'); setCreationOpen(false); };
  const content = activeNav === 'Home' ? <HomePage onNavigate={handleNavigate} onCreateTrip={() => setCreationOpen(true)} />
    : activeNav === 'Ledger' ? <main className="page vela-secondary-shell"><LedgerView /></main>
    : activeNav === 'Balance' ? <main className="page vela-secondary-shell"><BalanceEngine /></main>
    : activeNav === 'Logbook' ? <LogbookView annualReflection={annualReflection} plannedTrips={planningTrips} tripInsights={tripInsights} />
    : <main className="page vela-secondary-shell"><TripManager /></main>;

  const quickEntryOverlay = quickOpen && hasActiveJourney && currentTrip
    ? createPortal(
        <div className="fixed inset-0 z-[9999] w-screen h-[100dvh] bg-white overflow-y-auto" role="dialog" aria-modal="true" aria-label="Quick Entry">
          <QuickEntry onClose={() => setQuickOpen(false)} />
        </div>,
        document.body,
      )
    : null;

  return <div className="vela-app-root">
    {content}
    <nav className="vela-global-nav" aria-label="Primary navigation">
      {nav.map(({ label, icon: Icon }) => <button key={label} type="button" className={activeNav === label ? 'active' : ''} onClick={() => handleNavigate(label)}><Icon size={18} strokeWidth={1.7} /><span>{label}</span></button>)}
    </nav>
    {hasActiveJourney && currentTrip && <button type="button" className="vela-global-quick" aria-label="Add Quick Entry" onClick={() => setQuickOpen(true)}><VelaConstellationIcon /></button>}
    {creationOpen && <div className="vela-quick-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreationOpen(false); }}><div className="vela-quick-sheet"><TripCreation onClose={() => setCreationOpen(false)} onCreated={handleCreated} /></div></div>}
    {quickEntryOverlay}
  </div>;
};

createRoot(document.getElementById('root')!).render(<App />);
