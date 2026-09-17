import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Compass, Home as HomeIcon, Scale, Settings } from 'lucide-react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './vela-polish.css';
import './vela-secondary-polish.css';
import './vela-secondary-finish.css';
import './vela-home-shell.css';
import './global-ux.css';
import './logbook.css';
import HomePage from './Home';
import TripManager from './components/TripManager';
import { TripCreation } from './components/TripCreation';
import { QuickEntry } from './components/QuickEntry';
import { BalanceEngine } from './components/BalanceEngine';
import { LedgerView } from './components/LedgerView';
import LogbookView from './components/Logbook';
import { calculateAnnualTotals, generateTripInsights } from './utils/reflectionEngine';
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

const GlobalNav: React.FC<{ activeNav: Tab; onNavigate: (next: Tab) => void }> = ({ activeNav, onNavigate }) => (
  <nav className="vela-global-nav" aria-label="Primary navigation">
    {nav.map(({ label, icon: Icon }) => <button key={label} type="button" className={activeNav === label ? 'active' : ''} onClick={() => onNavigate(label)}><Icon size={18} strokeWidth={1.7} /><span>{label}</span></button>)}
  </nav>
);

const App: React.FC = () => {
  const [activeNav, setActiveNav] = useState<Tab>('Home');
  const [route, setRoute] = useState(() => window.location.pathname);
  const [creationOpen, setCreationOpen] = useState(false);
  const trips = useVelaStore((state) => state.trips);
  const currentTrip = useVelaStore((state) => state.getCurrentTrip());
  const currentYear = new Date().getFullYear();
  const achieveTrips = useMemo(() => trips.filter((trip) => trip.status === 'achieve'), [trips]);
  const activeTrip = useMemo(() => trips.find((trip) => trip.status === 'traveling') ?? null, [trips]);
  const planningTrips = useMemo(() => trips.filter((trip) => trip.status === 'planning'), [trips]);
  const annualReflection = useMemo(
    () => calculateAnnualTotals(achieveTrips, activeTrip, planningTrips, currentYear),
    [achieveTrips, activeTrip, planningTrips, currentYear],
  );
  const reflectionTrips = useMemo(
    () => activeTrip ? [...achieveTrips, activeTrip] : achieveTrips,
    [achieveTrips, activeTrip],
  );
  const tripInsights = useMemo(() => reflectionTrips.map(generateTripInsights), [reflectionTrips]);
  const hasActiveJourney = Boolean(currentTrip && currentTrip.status === 'traveling');

  useEffect(() => {
    const onPopState = () => setRoute(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const openQuickEntry = () => {
    window.history.pushState({}, '', '/entry/new');
    setRoute('/entry/new');
  };

  const closeQuickEntry = () => {
    window.history.pushState({}, '', '/');
    setRoute('/');
  };

  const handleNavigate = (next: Tab) => {
    if (window.location.pathname !== '/') window.history.pushState({}, '', '/');
    setRoute('/');
    setCreationOpen(false);
    setActiveNav(next);
    window.scrollTo({ top: 0 });
  };

  const handleCreated = () => { setActiveNav('Home'); setCreationOpen(false); };

  if (route === '/entry/new') {
    return (
      <div className="vela-entry-route">
        <QuickEntry onClose={closeQuickEntry} />
        <GlobalNav activeNav={activeNav} onNavigate={handleNavigate} />
      </div>
    );
  }

  const content = activeNav === 'Home' ? <HomePage onNavigate={handleNavigate} onCreateTrip={() => setCreationOpen(true)} />
    : activeNav === 'Ledger' ? <main className="page vela-secondary-shell"><LedgerView /></main>
    : activeNav === 'Balance' ? <main className="page vela-secondary-shell"><BalanceEngine /></main>
    : activeNav === 'Logbook' ? <LogbookView annualReflection={annualReflection} activeTrip={activeTrip} plannedTrips={planningTrips} tripInsights={tripInsights} />
    : <main className="page vela-secondary-shell"><TripManager /></main>;

  return <div className="vela-app-root">
    {content}
    <GlobalNav activeNav={activeNav} onNavigate={handleNavigate} />
    {hasActiveJourney && currentTrip && <button type="button" className="vela-global-quick" aria-label="Add Quick Entry" onClick={openQuickEntry}><VelaConstellationIcon /></button>}
    {creationOpen && <div className="vela-quick-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreationOpen(false); }}><div className="vela-quick-sheet"><TripCreation onClose={() => setCreationOpen(false)} onCreated={handleCreated} /></div></div>}
  </div>;
};

createRoot(document.getElementById('root')!).render(<App />);
