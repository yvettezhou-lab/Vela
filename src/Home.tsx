import React, { useMemo } from 'react';
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
      status: ['traveling', 'travelling', 'in progress'].includes(rawStatus)
        ? 'traveling'
        : ['achieve', 'achieved', 'completed'].includes(rawStatus)
          ? 'achieve'
          : 'planning',
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

const dates = (trip: Trip) => {
  if (trip.startDate && trip.endDate) return `${fmt(trip.startDate)} — ${fmt(trip.endDate)}`;
  return trip.startDate ? fmt(trip.startDate) : 'DATES NOT SET';
};

const dayCount = (trip: Trip) => {
  if (!trip.startDate || !trip.endDate) return '';
  const start = new Date(`${trip.startDate}T00:00:00`);
  const end = new Date(`${trip.endDate}T00:00:00`);
  const count = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
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
    if (String(safeEntry.finalCurrency || '').toUpperCase() === 'CNY' && safeEntry.finalAmount != null) {
      cny += Number(safeEntry.finalAmount) || 0;
    } else if (currency === 'CNY') {
      cny += amount;
    }
  });
  return [
    dayCount(trip),
    Object.entries(local).map(([currency, amount]) => `${currency} ${Math.round(amount).toLocaleString('en-US')}`).join(' · '),
    cny ? `¥${Math.round(cny).toLocaleString('en-US')}` : '',
  ].filter(Boolean).join(' · ');
};

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
  const trip: any = {
    id, name: 'New Journey', subtitle: '', startDate: '', endDate: '', destinations: [],
    settlementCurrency: 'CNY', status: 'planning', lastEditedAt: Date.now(), coverImage: '',
    members: [me], accounts: [
      { id: crypto.randomUUID(), name: 'Cash' }, { id: crypto.randomUUID(), name: 'Bank Card' },
      { id: crypto.randomUUID(), name: 'Alipay' }, { id: crypto.randomUUID(), name: 'WeChat Pay' },
    ], events: [], ledger: [],
  };
  const plans = readPlans();
  localStorage.setItem('vela.plans.v1', JSON.stringify([trip, ...plans]));
  goTrip(id);
}

function clickElement(selector: string) {
  const element = document.querySelector(selector);
  if (element instanceof HTMLElement) element.click();
}

export default function Home() {
  const { currentTrip, planningTrips, activeCount } = useMemo(() => {
    const safeTrips = readPlans();
    const active = safeTrips.filter((trip) => trip.status !== 'achieve');
    const traveling = active.find((trip) => trip.status === 'traveling');
    const planning = active
      .filter((trip) => trip.status === 'planning')
      .sort((a, b) => b.lastEditedAt - a.lastEditedAt);
    const current = traveling || planning[0] || null;
    const remainingPlanning = planning.filter((trip) => trip.id !== current?.id).slice(0, 2);
    return { currentTrip: current, planningTrips: remainingPlanning, activeCount: active.length };
  }, []);

  const nav = (label: string) => {
    document.querySelectorAll('.bottom-nav button').forEach((button) => {
      if (button.textContent?.trim().startsWith(label) && button instanceof HTMLElement) button.click();
    });
  };

  const card = (trip: Trip, compact = false) => (
    <div className={compact ? 'vela-compact-card' : 'vela-hero-card'} onClick={() => goTrip(trip.id)}>
      {compact ? (
        <>
          <img className="vela-compact-img" src={trip.coverImage || ''} alt="" />
          <div className="vela-compact-content">
            <div className="vela-compact-topline">
              <h3 className="vela-compact-title">{trip.name}</h3>
              <span className="vela-badge">{trip.status}</span>
            </div>
            {destinationLabel(trip) && <div className="vela-destination"><MapPin size={11} />{destinationLabel(trip)}</div>}
            {trip.subtitle && trip.subtitle !== trip.name && <div className="vela-compact-subtitle">{trip.subtitle}</div>}
            <div className="vela-date"><Calendar size={12} />{dates(trip)}</div>
            {summary(trip) && <small className="vela-summary">{summary(trip)}</small>}
          </div>
          <ChevronRight size={16} />
        </>
      ) : (
        <>
          <div className="vela-hero-content">
            <div className="vela-hero-label">CURRENT TRIP <span className="vela-status-dot green" /></div>
            <div className="vela-hero-sublabel">{trip.status}</div>
            <h2 className="vela-hero-title">{trip.name}</h2>
            {destinationLabel(trip) && <div className="vela-destination"><MapPin size={13} />{destinationLabel(trip)}</div>}
            {trip.subtitle && trip.subtitle !== trip.name && <div className="vela-hero-subtitle">{trip.subtitle}</div>}
            <div className="vela-date"><Calendar size={14} />{dates(trip)}</div>
            {summary(trip) && <div className="vela-summary">{summary(trip)}</div>}
            <div className="vela-hero-tether"><span><Database size={14} /> Quick Entry will be recorded<br />to this trip</span><ChevronRight size={14} /></div>
          </div>
          <div className="vela-hero-image-wrapper" style={trip.coverImage ? { backgroundImage: `url("${trip.coverImage}")` } : undefined}>
            <div className="vela-hero-index">01</div>
            {trip.scriptText && <div className="vela-hero-script">{trip.scriptText}</div>}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="vela-app-container">
      <header className="vela-header">
        <div className="vela-brand"><h1>Vela <span>/ JOURNEYS</span></h1><div className="vela-subtitle">TRAVEL · RECORD · BELONG</div></div>
        <div className="vela-header-actions">
          <div className="vela-trip-count"><strong>{activeCount}</strong> TRIPS</div>
          <button className="vela-all-trips" onClick={() => clickElement('[data-vela-all]')}>ALL TRIPS</button>
          <button className="vela-add-btn" onClick={newTrip}><Plus size={18} /></button>
        </div>
      </header>

      {currentTrip && <section className="vela-hero-section">{card(currentTrip)}</section>}

      {planningTrips.length > 0 && (
        <section className="vela-list-section">
          <div className="vela-list-header"><div className="vela-list-title">PLANNING NEXT</div><button className="vela-view-all" onClick={() => clickElement('[data-vela-all]')}>View all <ChevronRight size={14} /></button></div>
          {planningTrips.map((trip) => <div key={trip.id}>{card(trip, true)}</div>)}
        </section>
      )}

      {!currentTrip && (
        <section className="vela-empty"><p>YOUR NEXT JOURNEY AWAITS.</p><button onClick={newTrip}><Plus size={15} /> NEW TRIP</button></section>
      )}

      <div className="vela-bottom-scenery">
        <div className="vela-scenery-text">FURTHER<br />BRIGHTER<br />TOGETHER</div>
        <div className="vela-ufo-wrapper" onClick={() => clickElement('.home-quick')}><div className="vela-ufo-btn"><span>🛸</span></div><div className="vela-ufo-label">QUICK ENTRY</div></div>
      </div>

      <nav className="vela-bottom-nav">
        {['Home', 'Ledger', 'Balance', 'Logbook', 'Atelier'].map((label) => (
          <button key={label} className={`vela-nav-item ${label === 'Home' ? 'active' : ''}`} onClick={() => (label === 'Home' ? null : nav(label))}>
            <span className="vela-nav-icon">{label === 'Home' ? '⌂' : label === 'Ledger' ? '▤' : label === 'Balance' ? '⚖' : label === 'Logbook' ? '◎' : '⌘'}</span>{label}
          </button>
        ))}
      </nav>
    </div>
  );
}
