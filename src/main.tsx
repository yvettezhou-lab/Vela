import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Compass, Home as HomeIcon, Scale, Settings } from 'lucide-react';
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
  <svg width="27" height="27" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <g stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" opacity=".9">
      <path d="M6 9.5 12.5 7 18 11.5 24.5 8.5 27 14 21 18.5 17 25 10.5 22 7 17 6 9.5" />
      <path d="M12.5 7 10.5 22M18 11.5 21 18.5M24.5 8.5 21 18.5M7 17 17 25" opacity=".78" />
    </g>
    <g fill="currentColor">
      <circle cx="6" cy="9.5" r="1.65"/><circle cx="12.5" cy="7" r="1.5"/><circle cx="18" cy="11.5" r="1.65"/><circle cx="24.5" cy="8.5" r="1.5"/><circle cx="27" cy="14" r="1.25"/><circle cx="21" cy="18.5" r="1.55"/><circle cx="17" cy="25" r="1.6"/><circle cx="10.5" cy="22" r="1.35"/><circle cx="7" cy="17" r="1.2"/>
    </g>
  </svg>
);

const App: React.FC = () => {
  const [activeNav, setActiveNav] = useState<Tab>('Home');
  const [quickOpen, setQuickOpen] = useState(false);
  const [creationOpen, setCreationOpen] = useState(false);
  const trips = useVelaStore((state) => state.trips);
  const currentTrip = useVelaStore((state) => state.getCurrentTrip());
  const currentYear = new Date().getFullYear();
  const achieveTrips = useMemo(() => trips.filter((trip) => trip.status === 'achieve'), [trips]);
  const planningTrips = useMemo(() => trips.filter((trip) => trip.status === 'planning'), [trips]);
  const annualReflection = useMemo(
    () => generateAnnualReflection(achieveTrips, currentYear),
    [achieveTrips, currentYear],
  );
  const completedTripInsights = useMemo(
    () => achieveTrips.map(generateTripInsights),
    [achieveTrips],
  );
  const hasActiveJourney = Boolean(currentTrip && currentTrip.status === 'traveling');

  useEffect(() => {
    if (!quickOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [quickOpen]);

  const handleNavigate = (next: Tab) => { setQuickOpen(false); setCreationOpen(false); setActiveNav(next); window.scrollTo({ top: 0 }); };
  const handleCreated = () => { setActiveNav('Home'); setCreationOpen(false); };
  const content = activeNav === 'Home' ? <HomePage onNavigate={handleNavigate} onCreateTrip={() => setCreationOpen(true)} />
    : activeNav === 'Ledger' ? <main className="page vela-secondary-shell"><LedgerView /></main>
    : activeNav === 'Balance' ? <main className="page vela-secondary-shell"><BalanceEngine /></main>
    : activeNav === 'Logbook' ? <LogbookView annualReflection={annualReflection} plannedTrips={planningTrips} completedTripInsights={completedTripInsights} />
    : <main className="page vela-secondary-shell"><TripManager /></main>;

  const activeTripCount = trips.filter((trip) => trip.status !== 'achieve').length;
  const tripLabel = activeTripCount === 1 ? 'TRIP' : 'TRIPS';

  return <div className="vela-app-root">
    {content}
    <nav className="vela-global-nav" aria-label="Primary navigation">
      {nav.map(({ label, icon: Icon }) => <button key={label} type="button" className={activeNav === label ? 'active' : ''} onClick={() => handleNavigate(label)}><Icon size={18} strokeWidth={1.7} /><span>{label}</span></button>)}
    </nav>
    {hasActiveJourney && currentTrip && <button type="button" className="vela-global-quick" aria-label="Add Quick Entry" onClick={() => setQuickOpen(true)}><VelaConstellationIcon /></button>}
    {quickOpen && hasActiveJourney && currentTrip && <div className="vela-quick-backdrop" role="dialog" aria-modal="true" aria-label="Quick Entry" onMouseDown={(event) => { if (event.target === event.currentTarget) setQuickOpen(false); }}><div className="vela-quick-fullscreen"><QuickEntry onClose={() => setQuickOpen(false)} /></div></div>}
    {creationOpen && <div className="vela-quick-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreationOpen(false); }}><div className="vela-quick-sheet"><TripCreation onClose={() => setCreationOpen(false)} onCreated={handleCreated} /></div></div>}
  </div>;
};

createRoot(document.getElementById('root')!).render(<App />);
