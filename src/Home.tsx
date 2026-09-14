import React, { useMemo } from 'react';
import { Calendar, ChevronRight, MapPin, Plus, Database } from 'lucide-react';
import { calculateFinancialTotals } from './core/calculations';
import { Trip } from './core/domain';
import { useVelaStore } from './store/useVelaStore';
import './Home.css';

type HomeProps = { onNavigate: (label: 'Home' | 'Ledger' | 'Balance' | 'Logbook' | 'Atelier') => void };
const DEFAULT_COVER = '/896DCF5B-31E2-44AA-ADEB-1A9E019FC6FC.png';

const dateLabel = (trip: Trip) => {
  const start = new Date(trip.startDate), end = new Date(trip.endDate);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return 'DATES NOT SET';
  const fmt = (value: Date) => `${value.getFullYear()}.${String(value.getMonth() + 1).padStart(2, '0')}.${String(value.getDate()).padStart(2, '0')}`;
  return `${fmt(start)} — ${fmt(end)}`;
};
const dayCount = (trip: Trip) => { const days = Math.round((trip.endDate - trip.startDate) / 86400000) + 1; return days > 0 && days < 1000 ? `${days} DAYS` : ''; };
const localSummary = (trip: Trip) => {
  const local = trip.ledger.reduce((sum, entry) => sum + (entry.isRefund ? -entry.originalAmount : entry.originalAmount), 0);
  const totals = calculateFinancialTotals(trip.ledger);
  return [dayCount(trip), local ? `${trip.localCurrency} ${Math.round(local).toLocaleString('en-US')}` : '', totals.financialTotal ? `¥${Math.round(totals.financialTotal).toLocaleString('en-US')}` : ''].filter(Boolean).join(' · ');
};
const cover = (trip: Trip) => trip.coverImage?.trim() || DEFAULT_COVER;

const createTrip = (addTrip: (trip: unknown) => void) => {
  const now = Date.now(), id = crypto.randomUUID(), memberId = crypto.randomUUID(), accountId = crypto.randomUUID();
  const categoryNames = ['Accommodation', 'Food', 'Transport', 'Shopping', 'Tickets', 'Activities', 'Communication', 'Other'];
  addTrip({ id, title: 'New Journey', destination: '', startDate: now, endDate: now + 86400000, status: 'planning', localCurrency: 'CNY', coverImage: DEFAULT_COVER,
    members: [{ id: memberId, name: 'Me' }], accounts: [{ id: accountId, name: 'Cash' }],
    categories: categoryNames.map((name) => ({ id: `cat_${name.toLowerCase()}`, name, type: name })), ledger: [], createdAt: now, updatedAt: now });
};

export default function Home({ onNavigate }: HomeProps) {
  const trips = useVelaStore((state) => state.trips), addTrip = useVelaStore((state) => state.addTrip);
  const { current, planning, recent } = useMemo(() => {
    const traveling = trips.find((trip) => trip.status === 'traveling');
    const planningTrips = trips.filter((trip) => trip.status === 'planning').sort((a, b) => b.updatedAt - a.updatedAt);
    const achieved = trips.filter((trip) => trip.status === 'achieve').sort((a, b) => b.updatedAt - a.updatedAt);
    const active = traveling || planningTrips[0] || null;
    return { current: active, planning: planningTrips.filter((trip) => trip.id !== active?.id).slice(0, 2), recent: achieved.slice(0, 3) };
  }, [trips]);
  const handleNewTrip = () => { try { createTrip(addTrip); } catch (error) { window.alert(error instanceof Error ? error.message : 'Unable to create trip.'); } };

  const card = (trip: Trip, compact = false) => compact ? (
    <button className="vela-trip-row" key={trip.id} type="button" onClick={() => onNavigate('Ledger')}>
      <img src={cover(trip)} alt="" onError={(event) => { event.currentTarget.src = DEFAULT_COVER; }} />
      <span className="vela-trip-row-copy"><strong>{trip.title}</strong><small>{trip.destination || 'Destination not set'} · {dateLabel(trip)}</small><em>{localSummary(trip) || 'No payments yet'}</em></span><ChevronRight size={17} />
    </button>
  ) : (
    <button className="vela-current-card" key={trip.id} type="button" onClick={() => onNavigate('Ledger')}>
      <span className="vela-current-copy"><span className="vela-current-label">CURRENT TRIP <i /></span><span className="vela-current-status">{trip.status}</span><strong>{trip.title}</strong>
        <span className="vela-destination"><MapPin size={12} />{trip.destination || 'Choose a destination'}</span><span className="vela-date"><Calendar size={13} />{dateLabel(trip)}</span><span className="vela-summary">{localSummary(trip) || 'Your travel record starts here.'}</span>
        <span className="vela-current-tether"><Database size={13} /> Quick Entry will be recorded to this trip <ChevronRight size={13} /></span></span>
      <span className="vela-current-image"><img src={cover(trip)} alt="" onError={(event) => { event.currentTarget.src = DEFAULT_COVER; }} /><b>01</b></span>
    </button>
  );

  return <main className="vela-home">
    <header className="vela-home-header"><div><h1>Vela <span>/ JOURNEYS</span></h1><p>TRAVEL · RECORD · BELONG</p></div>
      <div className="vela-home-actions"><span><b>{trips.filter((trip) => trip.status !== 'achieve').length}</b> TRIPS</span><button type="button" onClick={() => onNavigate('Ledger')}>ALL TRIPS</button><button type="button" className="vela-add" onClick={handleNewTrip} aria-label="Start a new trip"><Plus size={18} /></button></div>
    </header>
    <section className="vela-home-map"><div className="vela-map-copy"><small>VELA · JOURNEY INDEX</small><strong>Further,<br />brighter,<br />together.</strong><span>{current?.destination || 'A place for every journey.'}</span></div><div className="vela-map-orbit" /><div className="vela-map-compass">N<br /><b>✦</b><br />S</div></section>
    {current ? <section className="vela-current-wrap">{card(current)}</section> : <section className="vela-empty-home"><small>YOUR JOURNEY INDEX</small><h2>Nothing has set sail yet.</h2><p>Create your first trip and Vela will keep its plans, payments and balance together.</p><button type="button" onClick={handleNewTrip}><Plus size={15} /> Start a New Journey</button></section>}
    <section className="vela-home-list"><div className="vela-list-heading"><span>PLANNING NEXT</span><button type="button" onClick={() => onNavigate('Ledger')}>View all <ChevronRight size={13} /></button></div>{planning.length ? planning.map((trip) => card(trip, true)) : <div className="vela-list-empty">YOUR NEXT JOURNEY AWAITS.</div>}</section>
    <section className="vela-home-list vela-recent-list"><div className="vela-list-heading"><span>RECENT JOURNEYS</span><button type="button" onClick={() => onNavigate('Logbook')}>View all <ChevronRight size={13} /></button></div>{recent.length ? recent.map((trip) => card(trip, true)) : <div className="vela-list-empty">NO COMPLETED JOURNEYS YET.</div>}</section>
  </main>;
}
