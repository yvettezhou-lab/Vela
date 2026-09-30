import { getTripDestinations, getTripEndDate, getTripPrimaryCurrency, getTripStartDate } from './core/travelSegment';
import React, { useMemo, useEffect } from 'react';
import { Calendar, ChevronRight, List as ListIcon, MapPin, Plus, X } from 'lucide-react';
import { calculateFinancialTotals } from './core/calculations';
import { Trip } from './core/domain';
import { useVelaStore } from './store/useVelaStore';
import { useTripCover } from './hooks/useTripCover';
import { getJourneyCheckCheckpoint, getJourneyCheckIssues, getTravelingDailyCheckpoint, getUnresolvedFutureJourneyIssues, hasJourneyCheckBeenShown, markJourneyCheckShown, setJourneyCheckResolution } from './core/journeyCheck';
import './Home.css';

type HomeProps = { onNavigate: (label: 'Home' | 'Ledger' | 'Balance' | 'Logbook' | 'Engine') => void; onCreateTrip: () => void; onManageTrips: () => void; onOpenLists: (tripId: string) => void };
const dateLabel = (trip: Trip) => { const start = new Date(getTripStartDate(trip)), end = new Date(getTripEndDate(trip)); if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return 'DATES NOT SET'; const fmt = (value: Date) => `${value.getFullYear()}.${String(value.getMonth() + 1).padStart(2, '0')}.${String(value.getDate()).padStart(2, '0')}`; return `${fmt(start)} — ${fmt(end)}`; };
const dayCount = (trip: Trip) => { const days = Math.round((getTripEndDate(trip) - getTripStartDate(trip)) / 86400000) + 1; return days > 0 && days < 1000 ? `${days} DAYS` : ''; };
const localSummary = (trip: Trip) => { const statsLedger = trip.ledger.filter(entry => entry.includeInCost && !entry.isPending); const local = statsLedger.reduce((sum, entry) => sum + (entry.isRefund ? -entry.originalAmount : entry.originalAmount), 0); const totals = calculateFinancialTotals(trip.ledger); const currency = getTripPrimaryCurrency(trip); const localLabel = local ? `${currency} ${Math.round(local).toLocaleString('en-US')}` : ''; const cnyLabel = currency !== 'CNY' && totals.financialTotal ? `¥${Math.round(totals.financialTotal).toLocaleString('en-US')}` : ''; return [dayCount(trip), localLabel, cnyLabel].filter(Boolean).join(' · '); };
const TripCoverImage: React.FC<{ trip: Trip }> = ({ trip }) => {
  const src = useTripCover(trip.coverImage);
  if (!src) return <span className="vela-trip-cover-placeholder" aria-hidden="true"><img src="/favicon.svg" alt="" /></span>;
  return <img src={src} alt="" />;
};

export default function Home({ onNavigate, onCreateTrip, onManageTrips, onOpenLists }: HomeProps) {
  const trips = useVelaStore((state) => state.trips);
  const updateTrip = useVelaStore((state) => state.updateTrip);
  const [journeyCheckOpen, setJourneyCheckOpen] = React.useState(false);
  const [journeyCheckTripId, setJourneyCheckTripId] = React.useState<string | null>(null);
  const [journeyCheckIssues, setJourneyCheckIssues] = React.useState<ReturnType<typeof getJourneyCheckIssues>>([]);
  useEffect(() => {
    if (journeyCheckOpen) return;
    const candidates = trips
      .map((trip) => {
        const checkpoint = trip.status === 'traveling'
          ? getTravelingDailyCheckpoint(trip)
          : getJourneyCheckCheckpoint(trip);
        const issues = trip.status === 'traveling'
          ? getUnresolvedFutureJourneyIssues(trip)
          : getJourneyCheckIssues(trip).filter((issue) => trip.journeyCheck?.resolutions?.[issue.id] !== 'self_drive' && trip.journeyCheck?.resolutions?.[issue.id] !== 'local_transport');
        return { trip, checkpoint, issues };
      })
      .filter(({ trip, checkpoint, issues }) => checkpoint && issues.length && !hasJourneyCheckBeenShown(trip, checkpoint));

    const candidate = candidates[0];
    if (!candidate?.checkpoint) return;
    updateTrip(candidate.trip.id, markJourneyCheckShown(candidate.trip, candidate.checkpoint));
    setJourneyCheckTripId(candidate.trip.id);
    setJourneyCheckIssues(candidate.issues);
    setJourneyCheckOpen(true);
  }, [trips, updateTrip, journeyCheckOpen]);

  const { current, planning, recent } = useMemo(() => {
    const traveling = trips.find((trip) => trip.status === 'traveling');
    const planningTrips = trips.filter((trip) => trip.status === 'planning').sort((a, b) => b.updatedAt - a.updatedAt);
    const achieved = trips.filter((trip) => trip.status === 'achieve').sort((a, b) => b.updatedAt - a.updatedAt);
    return { current: traveling || null, planning: planningTrips.slice(0, 3), recent: achieved.slice(0, 3) };
  }, [trips]);

  const card = (trip: Trip, compact = false) => compact ? (
    <div className="vela-trip-row" key={trip.id}>
      <button className="vela-trip-row-main" type="button" onClick={() => onNavigate('Ledger')}>
        <TripCoverImage trip={trip} />
        <span className="vela-trip-row-copy"><strong>{trip.title}</strong><small>{getTripDestinations(trip).join(' · ') || 'Destination not set'} · {dateLabel(trip)}</small><em>{localSummary(trip) || 'No payments yet'}</em></span>
      </button>
      <button className="vela-list-shortcut" type="button" onClick={() => onOpenLists(trip.id)}><ListIcon size={13}/> List</button>
      <ChevronRight className="vela-trip-row-chevron" size={17} />
    </div>
  ) : (
    <div className="vela-current-card" key={trip.id}>
      <button className="vela-current-main" type="button" onClick={() => onNavigate('Ledger')}>
        <span className="vela-current-copy"><span className="vela-current-label">CURRENT TRIP <i /></span><strong>{trip.title}</strong><span className="vela-destination"><MapPin size={12} />{getTripDestinations(trip).join(' · ') || 'Choose a destination'}</span><span className="vela-date"><Calendar size={13} />{dateLabel(trip)}</span><span className="vela-summary">{localSummary(trip) || 'Your travel record starts here.'}</span></span>
        <span className="vela-current-image"><TripCoverImage trip={trip} /></span>
      </button>
      <button className="vela-current-list" type="button" onClick={() => onOpenLists(trip.id)}><ListIcon size={13}/> List</button>
    </div>
  );

  const activeTripCount = trips.filter((trip) => trip.status === 'planning' || trip.status === 'traveling').length;
  const tripLabel = activeTripCount === 1 ? 'TRIP' : 'TRIPS';

  const journeyTrip = journeyCheckTripId ? trips.find((trip) => trip.id === journeyCheckTripId) ?? null : null;
  const activeJourneyIssues = journeyTrip ? getJourneyCheckIssues(journeyTrip).filter((issue) => journeyTrip.journeyCheck?.resolutions?.[issue.id] !== 'self_drive' && journeyTrip.journeyCheck?.resolutions?.[issue.id] !== 'local_transport') : journeyCheckIssues;
  const resolveJourneyIssue = (issueId: string, resolution: 'self_drive' | 'local_transport' | 'later') => {
    if (!journeyTrip) return;
    const next = setJourneyCheckResolution(journeyTrip, issueId, resolution);
    updateTrip(journeyTrip.id, next);
    if (resolution === 'later' || activeJourneyIssues.length <= 1) setJourneyCheckOpen(false);
  };

  return <main className="vela-home">
    <header className="vela-home-header"><div><h1>Vela <span>/ JOURNEYS</span></h1><p>TRAVEL · RECORD · BELONG</p></div><div className="vela-home-actions"><button type="button" className="vela-trip-count" onClick={onManageTrips} aria-label={`Manage trips: ${activeTripCount} ${tripLabel}`}><b>{activeTripCount}</b> {tripLabel}</button><button type="button" className="vela-add" onClick={onCreateTrip} aria-label="Start a new trip"><Plus size={18} /></button></div></header>
    {current ? <section className="vela-current-wrap">{card(current)}</section> : <section className="vela-empty-home"><small>YOUR JOURNEY INDEX</small><h2>Nothing has set sail yet.</h2><p>Create your first trip and Vela will keep its plans, payments and balance together.</p><button type="button" onClick={onCreateTrip}><Plus size={15} /> Start a New Journey</button></section>}
    <section className="vela-home-list"><div className="vela-list-heading"><span>PLANNING NEXT</span><button type="button" onClick={() => onNavigate('Ledger')}>View all <ChevronRight size={13} /></button></div><div className="vela-planning-stack">{planning.length ? planning.map((trip) => card(trip, true)) : <div className="vela-list-empty">YOUR NEXT JOURNEY AWAITS.</div>}</div></section>
    <section className="vela-home-list vela-recent-list"><div className="vela-list-heading"><span>RECENT JOURNEYS</span><button type="button" onClick={() => onNavigate('Logbook')}>View all <ChevronRight size={13} /></button></div>{recent.length ? recent.map((trip) => card(trip, true)) : <div className="vela-list-empty">NO COMPLETED JOURNEYS YET.</div>}</section>
  
    {journeyCheckOpen && journeyTrip && <div className="vela-journey-check-backdrop" role="dialog" aria-modal="true" aria-label="Journey Check">
      <div className="vela-journey-check-modal">
        <button type="button" className="vela-journey-check-close" onClick={() => setJourneyCheckOpen(false)} aria-label="Close"><X size={17}/></button>
        <small>JOURNEY CHECK</small>
        <h2>出发前，把行程接起来。</h2>
        <p>Vela 检查了各段目的地之间是否有交通衔接。没有记录的段落，可以现在指定方式，也可以稍后处理。</p>
        <div className="vela-journey-check-list">
          {activeJourneyIssues.map((issue) => <div className="vela-journey-check-item" key={issue.id}>
            <strong>{issue.from} → {issue.to}</strong>
            <span>这两站之间没有明确的行程衔接</span>
            <div><button type="button" onClick={() => resolveJourneyIssue(issue.id, 'self_drive')}>🚗 自驾</button><button type="button" onClick={() => resolveJourneyIssue(issue.id, 'local_transport')}>🚕 当地交通</button><button type="button" onClick={() => resolveJourneyIssue(issue.id, 'later')}>⏳ 稍后</button></div>
          </div>)}
        </div>
        {!activeJourneyIssues.length && <div className="vela-journey-check-done">✓ 行程衔接已经处理好了。</div>}
        <button type="button" className="vela-journey-check-dismiss" onClick={() => setJourneyCheckOpen(false)}>先看看，不处理</button>
      </div>
    </div>}
  </main>;
  
}
