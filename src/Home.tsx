import React, { useMemo, useEffect } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { Trip } from './core/domain';
import { HomeJourneyCheck } from './HomeJourneyCheck';
import { HomeTripCard } from './HomeTripCard';
import { useVelaStore } from './store/useVelaStore';
import {
  getJourneyCheckCheckpoint,
  getJourneyCheckIssues,
  getTravelingDailyCheckpoint,
  getUnresolvedFutureJourneyIssues,
  hasJourneyCheckBeenShown,
  markJourneyCheckShown,
  setJourneyCheckResolution,
} from './core/journeyCheck';
import './Home.css';

type HomeProps = {
  onNavigate: (
    label: 'Home' | 'Ledger' | 'Balance' | 'Logbook' | 'Engine',
  ) => void;
  onCreateTrip: () => void;
  onManageTrips: () => void;
  onOpenLists: (tripId: string) => void;
};

export default function Home({
  onNavigate,
  onCreateTrip,
  onManageTrips,
  onOpenLists,
}: HomeProps) {
  const trips = useVelaStore((state) => state.trips);
  const updateTrip = useVelaStore((state) => state.updateTrip);
  const [journeyCheckOpen, setJourneyCheckOpen] = React.useState(false);
  const [journeyCheckTripId, setJourneyCheckTripId] = React.useState<string | null>(null);
  const [journeyCheckIssues, setJourneyCheckIssues] =
    React.useState<ReturnType<typeof getJourneyCheckIssues>>([]);
  useEffect(() => {
    if (journeyCheckOpen) return;

    const candidates = trips
      .map((trip) => {
        const checkpoint =
          trip.status === 'traveling'
            ? getTravelingDailyCheckpoint(trip)
            : getJourneyCheckCheckpoint(trip);
        const issues =
          trip.status === 'traveling'
            ? getUnresolvedFutureJourneyIssues(trip)
            : getJourneyCheckIssues(trip).filter(
                (issue) =>
                  trip.journeyCheck?.resolutions?.[issue.id] !== 'self_drive' &&
                  trip.journeyCheck?.resolutions?.[issue.id] !== 'local_transport',
              );

        return { trip, checkpoint, issues };
      })
      .filter(
        ({ trip, checkpoint, issues }) =>
          checkpoint &&
          issues.length &&
          !hasJourneyCheckBeenShown(trip, checkpoint),
      );

    const candidate = candidates[0];
    if (!candidate?.checkpoint) return;

    updateTrip(
      candidate.trip.id,
      markJourneyCheckShown(candidate.trip, candidate.checkpoint),
    );
    setJourneyCheckTripId(candidate.trip.id);
    setJourneyCheckIssues(candidate.issues);
    setJourneyCheckOpen(true);
  }, [trips, updateTrip, journeyCheckOpen]);

  const { current, planning, recent } = useMemo(() => {
    const traveling = trips.find((trip) => trip.status === 'traveling');
    const planningTrips = trips
      .filter((trip) => trip.status === 'planning')
      .sort((a, b) => b.updatedAt - a.updatedAt);
    const achieved = trips
      .filter((trip) => trip.status === 'achieve')
      .sort((a, b) => b.updatedAt - a.updatedAt);
    return { current: traveling || null, planning: planningTrips.slice(0, 3), recent: achieved.slice(0, 3) };
  }, [trips]);

  const card = (trip: Trip, compact = false) => (
    <HomeTripCard
      key={trip.id}
      trip={trip}
      compact={compact}
      onNavigate={() => onNavigate('Ledger')}
      onOpenLists={() => onOpenLists(trip.id)}
    />
  );

  const activeTripCount = trips.filter(
    (trip) => trip.status === 'planning' || trip.status === 'traveling',
  ).length;
  const tripLabel = activeTripCount === 1 ? 'TRIP' : 'TRIPS';

  const journeyTrip = journeyCheckTripId
    ? trips.find((trip) => trip.id === journeyCheckTripId) ?? null
    : null;
  const activeJourneyIssues = journeyTrip
    ? getJourneyCheckIssues(journeyTrip).filter(
        (issue) =>
          journeyTrip.journeyCheck?.resolutions?.[issue.id] !== 'self_drive' &&
          journeyTrip.journeyCheck?.resolutions?.[issue.id] !== 'local_transport',
      )
    : journeyCheckIssues;
  const resolveJourneyIssue = (issueId: string, resolution: 'self_drive' | 'local_transport' | 'later') => {
    if (!journeyTrip) return;
    const next = setJourneyCheckResolution(journeyTrip, issueId, resolution);
    updateTrip(journeyTrip.id, next);
    if (resolution === 'later' || activeJourneyIssues.length <= 1) {
      setJourneyCheckOpen(false);
    }
  };

  return <main className="vela-home">
    <header className="vela-home-header"><div><h1>Vela <span>/ JOURNEYS</span></h1><p>TRAVEL · RECORD · BELONG</p></div><div className="vela-home-actions"><button type="button" className="vela-trip-count" onClick={onManageTrips} aria-label={`Manage trips: ${activeTripCount} ${tripLabel}`}><b>{activeTripCount}</b> {tripLabel}</button><button type="button" className="vela-add" onClick={onCreateTrip} aria-label="Start a new trip"><Plus size={18} /></button></div></header>
    {current ? <section className="vela-current-wrap">{card(current)}</section> : <section className="vela-empty-home"><small>YOUR JOURNEY INDEX</small><h2>Nothing has set sail yet.</h2><p>Create your first trip and Vela will keep its plans, payments and balance together.</p><button type="button" onClick={onCreateTrip}><Plus size={15} /> Start a New Journey</button></section>}
    <section className="vela-home-list"><div className="vela-list-heading"><span>PLANNING NEXT</span><button type="button" onClick={() => onNavigate('Ledger')}>View all <ChevronRight size={13} /></button></div><div className="vela-planning-stack">{planning.length ? planning.map((trip) => card(trip, true)) : <div className="vela-list-empty">YOUR NEXT JOURNEY AWAITS.</div>}</div></section>
    <section className="vela-home-list vela-recent-list"><div className="vela-list-heading"><span>RECENT JOURNEYS</span><button type="button" onClick={() => onNavigate('Logbook')}>View all <ChevronRight size={13} /></button></div>{recent.length ? recent.map((trip) => card(trip, true)) : <div className="vela-list-empty">NO COMPLETED JOURNEYS YET.</div>}</section>
  
    {journeyCheckOpen && journeyTrip && (
      <HomeJourneyCheck
        issues={activeJourneyIssues}
        onResolve={resolveJourneyIssue}
        onClose={() => setJourneyCheckOpen(false)}
      />
    )}
  </main>;
  
}
