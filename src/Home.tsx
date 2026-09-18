import { getTripDestinations, getTripEndDate, getTripPrimaryCurrency, getTripStartDate } from './core/travelSegment';
import React, { useMemo, useState } from 'react';
import { Calendar, ChevronRight, MapPin, Plus, Database } from 'lucide-react';
import { calculateFinancialTotals } from './core/calculations';
import { Trip } from './core/domain';
import { useVelaStore } from './store/useVelaStore';
import { useTripCover } from './hooks/useTripCover';
import './Home.css';

type HomeProps = { onNavigate: (label: 'Home' | 'Ledger' | 'Balance' | 'Logbook' | 'Atelier') => void; onCreateTrip: () => void; onManageTrips: () => void };
const DEFAULT_COVER = '/896DCF5B-31E2-44AA-ADEB-1A9E019FC6FC.png';
const dateLabel = (trip: Trip) => { const start = new Date(getTripStartDate(trip)), end = new Date(getTripEndDate(trip)); if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return 'DATES NOT SET'; const fmt = (value: Date) => `${value.getFullYear()}.${String(value.getMonth() + 1).padStart(2, '0')}.${String(value.getDate()).padStart(2, '0')}`; return `${fmt(start)} — ${fmt(end)}`; };
const dayCount = (trip: Trip) => { const days = Math.round((getTripEndDate(trip) - getTripStartDate(trip)) / 86400000) + 1; return days > 0 && days < 1000 ? `${days} DAYS` : ''; };
const localSummary = (trip: Trip) => { const local = trip.ledger.reduce((sum, entry) => sum + (entry.isRefund ? -entry.originalAmount : entry.originalAmount), 0); const totals = calculateFinancialTotals(trip.ledger); return [dayCount(trip), local ? `${getTripPrimaryCurrency(trip)} ${Math.round(local).toLocaleString('en-US')}` : '', totals.financialTotal ? `¥${Math.round(totals.financialTotal).toLocaleString('en-US')}` : ''].filter(Boolean).join(' · '); };
const TripCoverImage: React.FC<{ trip: Trip }> = ({ trip }) => {
  const src = useTripCover(trip.coverImage);
  return <img src={src || DEFAULT_COVER} alt="" onError={(event) => { event.currentTarget.src = DEFAULT_COVER; }} />;
};

export default function Home({ onNavigate, onCreateTrip, onManageTrips }: HomeProps) {
  const trips = useVelaStore((state) => state.trips);
  const [transitionError, setTransitionError] = useState('');
  const { current, planning, recent } = useMemo(() => {
    const traveling = trips.find((trip) => trip.status === 'traveling');
    const planningTrips = trips.filter((trip) => trip.status === 'planning').sort((a, b) => b.updatedAt - a.updatedAt);
    const achieved = trips.filter((trip) => trip.status === 'achieve').sort((a, b) => b.updatedAt - a.updatedAt);
    return { current: traveling || null, planning: planningTrips.slice(0, 3), recent: achieved.slice(0, 3) };
  }, [trips]);

  const startJourney = (tripId: string) => {
    setTransitionError('');
    try { useVelaStore.getState().updateTripStatus(tripId, 'traveling'); onNavigate('Home'); }
    catch (error) { const message = error instanceof Error ? error.message : ''; setTransitionError(/traveling|already|active|ongoing|in progress/i.test(message) ? 'Action Denied: You already have an active journey. Archive it before starting a new one.' : message || 'Unable to start this journey.'); }
  };

  const card = (trip: Trip, compact = false) => compact ? (
    <div className="vela-trip-row" key={trip.id}>
      <button className="vela-trip-row-main" type="button" onClick={() => onNavigate('Ledger')}>
        <TripCoverImage trip={trip} />
        <span className="vela-trip-row-copy"><strong>{trip.title}</strong><small>{getTripDestinations(trip).join(' · ') || 'Destination not set'} · {dateLabel(trip)}</small><em>{localSummary(trip) || 'No payments yet'}</em></span>
        <span className={`vela-status-pill ${trip.status}`}>{trip.status === 'achieve' ? 'ACHIEVE' : 'PLANNING'}</span>
      </button>
      {trip.status === 'planning' && <button className="vela-start-journey" type="button" onClick={() => startJourney(trip.id)}>Start Journey</button>}
      <ChevronRight className="vela-trip-row-chevron" size={17} />
    </div>
  ) : (
    <button className="vela-current-card" key={trip.id} type="button" onClick={() => onNavigate('Ledger')}>
      <span className="vela-current-copy"><span className="vela-current-label">CURRENT TRIP <i /></span><span className="vela-current-status">{trip.status}</span><strong>{trip.title}</strong><span className="vela-destination"><MapPin size={12} />{getTripDestinations(trip).join(' · ') || 'Choose a destination'}</span><span className="vela-date"><Calendar size={13} />{dateLabel(trip)}</span><span className="vela-summary">{localSummary(trip) || 'Your travel record starts here.'}</span><span className="vela-current-tether"><Database size={13} /> Quick Entry will be recorded to this trip <ChevronRight size={13} /></span></span>
      <span className="vela-current-image"><TripCoverImage trip={trip} /><b>01</b></span>
    </button>
  );

  const activeTripCount = trips.filter((trip) => trip.status !== 'achieve').length;
  const tripLabel = activeTripCount === 1 ? 'TRIP' : 'TRIPS';

  return <main className="vela-home">
    <header className="vela-home-header"><div><h1>Vela <span>/ JOURNEYS</span></h1><p>TRAVEL · RECORD · BELONG</p></div><div className="vela-home-actions"><button type="button" className="vela-trip-count" onClick={onManageTrips} aria-label={`Manage trips: ${activeTripCount} ${tripLabel}`}><b>{activeTripCount}</b> {tripLabel}</button><button type="button" className="vela-add" onClick={onCreateTrip} aria-label="Start a new trip"><Plus size={18} /></button></div></header>
    {current ? <section className="vela-current-wrap">{card(current)}</section> : <section className="vela-empty-home"><small>YOUR JOURNEY INDEX</small><h2>Nothing has set sail yet.</h2><p>Create your first trip and Vela will keep its plans, payments and balance together.</p><button type="button" onClick={onCreateTrip}><Plus size={15} /> Start a New Journey</button></section>}
    <section className="vela-home-list"><div className="vela-list-heading"><span>PLANNING NEXT</span><button type="button" onClick={() => onNavigate('Ledger')}>View all <ChevronRight size={13} /></button></div><div className="vela-planning-stack">{planning.length ? planning.map((trip) => card(trip, true)) : <div className="vela-list-empty">YOUR NEXT JOURNEY AWAITS.</div>}</div>{transitionError && <div className="vela-transition-alert" role="alert">{transitionError}</div>}</section>
    <section className="vela-home-list vela-recent-list"><div className="vela-list-heading"><span>RECENT JOURNEYS</span><button type="button" onClick={() => onNavigate('Logbook')}>View all <ChevronRight size={13} /></button></div>{recent.length ? recent.map((trip) => card(trip, true)) : <div className="vela-list-empty">NO COMPLETED JOURNEYS YET.</div>}</section>
  </main>;
}
