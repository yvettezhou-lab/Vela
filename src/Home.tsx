import React, { useMemo, useState } from 'react';
import { Calendar, ChevronRight, Plus, Database, MapPin } from 'lucide-react';
import './Home.css';

type TripStatus = 'planning' | 'traveling' | 'achieve';

interface Trip {
  id: string;
  name: string;
  subtitle: string;
  startDate: string;
  endDate: string;
  destinations: string[];
  status: TripStatus;
  lastEditedAt: number;
  coverImage: string;
  scriptText?: string;
  ledger?: any[];
}

const DEFAULT_COVER_IMAGE = 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1200&q=85';
const DEMO_PLANNING: Trip[] = [
  { id: 'demo-planning-1', name: 'Japan', subtitle: 'Sunrise & Slow Days', startDate: '2026-10-10', endDate: '2026-10-16', destinations: ['Tokyo', 'Kyoto'], status: 'planning', lastEditedAt: 2, coverImage: DEFAULT_COVER_IMAGE, ledger: [] },
  { id: 'demo-planning-2', name: 'Bali', subtitle: 'Island Notes', startDate: '2026-11-05', endDate: '2026-11-11', destinations: ['Ubud', 'Bali'], status: 'planning', lastEditedAt: 1, coverImage: DEFAULT_COVER_IMAGE, ledger: [] },
];
const DEMO_ACHIEVED: Trip[] = [
  { id: 'demo-achieve-1', name: 'Coron', subtitle: 'Blue Water Journal', startDate: '2026-06-01', endDate: '2026-06-06', destinations: ['Palawan'], status: 'achieve', lastEditedAt: 2, coverImage: DEFAULT_COVER_IMAGE, ledger: [] },
  { id: 'demo-achieve-2', name: 'Penang', subtitle: 'Old Streets & Food', startDate: '2026-05-18', endDate: '2026-05-21', destinations: ['George Town'], status: 'achieve', lastEditedAt: 1, coverImage: DEFAULT_COVER_IMAGE, ledger: [] },
];

const readPlans = (): Trip[] => {
  let parsedData: unknown = [];
  try {
    const rawString = localStorage.getItem('vela.plans.v1') || '[]';
    parsedData = JSON.parse(rawString);
  } catch (error) {
    console.error('Vela Data Error: Invalid JSON in localStorage', error);
  }
  const safeTrips = Array.isArray(parsedData) ? parsedData : [];
  return safeTrips.map((item: any) => {
    const source = item && typeof item === 'object' ? item : {};
    const rawStatus = String(source.status || '').toLowerCase();
    return {
      ...source,
      status: ['traveling', 'travelling', 'in progress'].includes(rawStatus) ? 'traveling' : ['achieve', 'achieved', 'completed'].includes(rawStatus) ? 'achieve' : 'planning',
      subtitle: String(source.subtitle || ''),
      destinations: Array.isArray(source.destinations) ? source.destinations.map(String) : [],
      lastEditedAt: Number(source.lastEditedAt || source.updatedAt || source.createdAt || 0),
      coverImage: String(source.coverImage || ''),
    } as Trip;
  });
};

const fmt = (value: string) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : String(value || '');
};
const dates = (trip: Trip) => trip.startDate && trip.endDate ? `${fmt(trip.startDate)} — ${fmt(trip.endDate)}` : trip.startDate ? fmt(trip.startDate) : 'DATES NOT SET';
const dayCount = (trip: Trip) => {
  if (!trip.startDate || !trip.endDate) return '';
  const count = Math.round((new Date(`${trip.endDate}T00:00:00`).getTime() - new Date(`${trip.startDate}T00:00:00`).getTime()) / 86400000) + 1;
  return count > 0 ? `${count} DAYS` : '';
};
const destinationLabel = (trip: Trip) => trip.destinations.filter(Boolean).join(', ');
const summary = (trip: Trip) => {
  const local: Record<string, number> = {};
  let cny = 0;
  (Array.isArray(trip.ledger) ? trip.ledger : []).forEach((entry: any) => {
    const safeEntry = entry && typeof entry === 'object' ? entry : {};
    const amount = Number(safeEntry.amount) || 0;
    const currency = String(safeEntry.currency || '').toUpperCase();
    if (currency && currency !== 'CNY') local[currency] = (local[currency] || 0) + amount;
    if (String(safeEntry.finalCurrency || '').toUpperCase() === 'CNY' && safeEntry.finalAmount != null) cny += Number(safeEntry.finalAmount) || 0;
    else if (currency === 'CNY') cny += amount;
  });
  return [dayCount(trip), Object.entries(local).map(([currency, amount]) => `${currency} ${Math.round(amount).toLocaleString('en-US')}`).join(' · '), cny ? `¥${Math.round(cny).toLocaleString('en-US')}` : ''].filter(Boolean).join(' · ');
};
const coverImage = (trip: Trip) => trip.coverImage.trim() || DEFAULT_COVER_IMAGE;

function persistCoverImage(id: string, image: string) {
  try {
    const plans = readPlans();
    const next = plans.map((trip) => trip.id === id ? { ...trip, coverImage: image, lastEditedAt: Date.now() } : trip);
    localStorage.setItem('vela.plans.v1', JSON.stringify(next));
    const current = plans.find((trip) => trip.id === id);
    if (current) localStorage.setItem('vela.plan.v1', JSON.stringify({ ...current, coverImage: image, lastEditedAt: Date.now() }));
  } catch (error) {
    console.error('Vela Cover Image Error', error);
  }
}

function goTrip(id: string) {
  try {
    localStorage.setItem('vela.trip.current.v1', id);
    const trip = readPlans().find((item) => item.id === id);
    if (trip) localStorage.setItem('vela.plan.v1', JSON.stringify(trip));
  } catch (error) {
    console.error('Vela Trip Error', error);
  }
  window.location.reload();
}

function newTrip() {
  const id = crypto.randomUUID();
  const me = { id: crypto.randomUUID(), name: 'Me', ratio: 100 };
  const trip: any = { id, name: 'New Journey', subtitle: '', startDate: '', endDate: '', destinations: [], settlementCurrency: 'CNY', status: 'planning', lastEditedAt: Date.now(), coverImage: '', members: [me], accounts: [{ id: crypto.randomUUID(), name: 'Cash' }, { id: crypto.randomUUID(), name: 'Bank Card' }, { id: crypto.randomUUID(), name: 'Alipay' }, { id: crypto.randomUUID(), name: 'WeChat Pay' }], events: [], ledger: [] };
  const plans = readPlans();
  localStorage.setItem('vela.plans.v1', JSON.stringify([trip, ...plans]));
  goTrip(id);
}
function clickElement(selector: string) {
  const element = document.querySelector(selector);
  if (element instanceof HTMLElement) element.click();
}

export default function Home() {
  const [coverOverrides, setCoverOverrides] = useState<Record<string, string>>({});
  const { currentTrip, planningTrips, recentJourneysTrips, activeCount } = useMemo(() => {
    const stored = readPlans();
    const planning = stored.filter((trip) => trip.status === 'planning').sort((a, b) => b.lastEditedAt - a.lastEditedAt);
    const traveling = stored.find((trip) => trip.status === 'traveling');
    const achieved = stored.filter((trip) => trip.status === 'achieve').sort((a, b) => b.lastEditedAt - a.lastEditedAt);
    const displayPlanning = planning.length ? planning : DEMO_PLANNING;
    const displayRecent = achieved.length ? achieved.slice(0, 2) : DEMO_ACHIEVED;
    const current = traveling || displayPlanning[0] || null;
    return { currentTrip: current, planningTrips: displayPlanning.filter((trip) => trip.id !== current?.id).slice(0, 2), recentJourneysTrips: displayRecent, activeCount: stored.length || 3 };
  }, []);

  const replaceCover = (trip: Trip) => {
    const next = window.prompt('Enter a new cover image URL', coverOverrides[trip.id] || trip.coverImage || '');
    if (!next?.trim()) return;
    const image = next.trim();
    persistCoverImage(trip.id, image);
    setCoverOverrides((previous) => ({ ...previous, [trip.id]: image }));
  };
  const imageFor = (trip: Trip) => coverOverrides[trip.id] || coverImage(trip);
  const handleImageError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    if (event.currentTarget.src !== DEFAULT_COVER_IMAGE) event.currentTarget.src = DEFAULT_COVER_IMAGE;
  };
  const nav = (label: string) => {
    document.querySelectorAll('.bottom-nav button').forEach((button) => {
      if (button.textContent?.trim().startsWith(label) && button instanceof HTMLElement) button.click();
    });
  };

  const card = (trip: Trip, compact = false, recent = false) => (
    <div className={compact ? `vela-compact-card${recent ? ' vela-recent-card' : ''}` : 'vela-hero-card'} onClick={() => goTrip(trip.id)}>
      {compact ? <>
        <img className="vela-compact-img" src={imageFor(trip)} alt="" onClick={(event) => { event.stopPropagation(); replaceCover(trip); }} onError={handleImageError} />
        <div className="vela-compact-content">
          <div className="vela-compact-topline"><h3 className="vela-compact-title">{trip.name}</h3><span className={`vela-badge ${trip.status === 'achieve' ? 'achieve' : ''}`}>{trip.status}</span></div>
          {destinationLabel(trip) && <div className="vela-destination"><MapPin size={11} />{destinationLabel(trip)}</div>}
          {trip.subtitle && trip.subtitle !== trip.name && <div className="vela-compact-subtitle">{trip.subtitle}</div>}
          <div className="vela-date"><Calendar size={12} />{dates(trip)}</div>
          {summary(trip) && <small className="vela-summary">{summary(trip)}</small>}
        </div><ChevronRight size={16} />
      </> : <>
        <div className="vela-hero-content">
          <div className="vela-hero-label">CURRENT TRIP <span className={`vela-status-dot ${trip.status === 'traveling' ? 'green' : 'blue'}`} /></div>
          <div className="vela-hero-sublabel">{trip.status}</div>
          <h2 className="vela-hero-title">{trip.name}</h2>
          {destinationLabel(trip) && <div className="vela-destination"><MapPin size={13} />{destinationLabel(trip)}</div>}
          {trip.subtitle && trip.subtitle !== trip.name && <div className="vela-hero-subtitle">{trip.subtitle}</div>}
          <div className="vela-date"><Calendar size={14} />{dates(trip)}</div>
          {summary(trip) && <div className="vela-summary">{summary(trip)}</div>}
          <div className="vela-hero-tether"><span><Database size={14} /> Quick Entry will be recorded<br />to this trip</span><ChevronRight size={14} /></div>
        </div>
        <div className="vela-hero-image-wrapper" onClick={(event) => { event.stopPropagation(); replaceCover(trip); }} style={{ backgroundImage: `url("${imageFor(trip)}")` }}>
          <img className="vela-hero-cover-img" src={imageFor(trip)} alt="" onError={handleImageError} />
          <div className="vela-hero-index">01</div>
          {trip.scriptText && <div className="vela-hero-script">{trip.scriptText}</div>}
        </div>
      </>}
    </div>
  );

  return <div className="vela-app-container">
    <header className="vela-header"><div className="vela-brand"><h1>Vela <span>/ JOURNEYS</span></h1><div className="vela-subtitle">TRAVEL · RECORD · BELONG</div></div><div className="vela-header-actions"><div className="vela-trip-count"><strong>{activeCount}</strong> TRIPS</div><button className="vela-all-trips" onClick={() => clickElement('[data-vela-all]')}>ALL TRIPS</button><button className="vela-add-btn" onClick={newTrip}><Plus size={18} /></button></div></header>
    {currentTrip && <section className="vela-hero-section">{card(currentTrip)}</section>}
    <section className="vela-list-section"><div className="vela-list-header"><div className="vela-list-title">PLANNING NEXT</div><button className="vela-view-all" onClick={() => clickElement('[data-vela-all]')}>View all <ChevronRight size={14} /></button></div>{planningTrips.length ? planningTrips.map((trip) => <div key={trip.id}>{card(trip, true)}</div>) : <div className="vela-section-placeholder">YOUR NEXT JOURNEY AWAITS.</div>}</section>
    <section className="vela-list-section vela-recent-section"><div className="vela-list-header"><div className="vela-list-title">RECENT JOURNEYS</div><button className="vela-view-all" onClick={() => clickElement('[data-vela-all]')}>View all <ChevronRight size={14} /></button></div>{recentJourneysTrips.map((trip) => <div key={trip.id}>{card(trip, true, true)}</div>)}</section>
    <div className="vela-bottom-scenery"><div className="vela-scenery-text">FURTHER<br />BRIGHTER<br />TOGETHER</div><div className="vela-ufo-wrapper" onClick={() => clickElement('.home-quick')}><div className="vela-ufo-btn"><span>🛸</span></div><div className="vela-ufo-label">QUICK ENTRY</div></div></div>
    <nav className="vela-bottom-nav">{['Home', 'Ledger', 'Balance', 'Logbook', 'Atelier'].map((label) => <button key={label} className={`vela-nav-item ${label === 'Home' ? 'active' : ''}`} onClick={() => (label === 'Home' ? null : nav(label))}><span className="vela-nav-icon">{label === 'Home' ? '⌂' : label === 'Ledger' ? '▤' : label === 'Balance' ? '⚖' : label === 'Logbook' ? '◎' : '⌘'}</span>{label}</button>)}</nav>
  </div>;
}
