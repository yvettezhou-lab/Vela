import React, { useState } from 'react';
import { TripStatus } from '../../core/domain';
import { useVelaStore } from '../../store/useVelaStore';
import { calculatePlanningContext } from '../../utils/planningEngine';

const STATUS_LABELS: Record<TripStatus, string> = {
  traveling: 'Traveling',
  planning: 'Planning',
  achieve: 'Achieve',
};

const STATUS_ORDER: TripStatus[] = ['traveling', 'planning', 'achieve'];

function lifecycleError(error: unknown, action: 'start' | 'archive'): string {
  const message = error instanceof Error ? error.message : String(error);
  if (action === 'start' && message.toLowerCase().includes('traveling')) {
    return '无法开始行程，已有正在进行中的行程';
  }
  return action === 'start' ? `无法开始行程：${message}` : `无法结束行程：${message}`;
}

export const TripManager: React.FC = () => {
  const trips = useVelaStore((state) => state.trips);
  const updateTripStatus = useVelaStore((state) => state.updateTripStatus);
  const [error, setError] = useState<string | null>(null);
  const [endingTripId, setEndingTripId] = useState<string | null>(null);

  const grouped: Record<TripStatus, typeof trips> = {
    traveling: trips.filter((trip) => trip.status === 'traveling'),
    planning: trips
      .filter((trip) => trip.status === 'planning')
      .sort((a, b) => b.updatedAt - a.updatedAt),
    achieve: trips.filter((trip) => trip.status === 'achieve'),
  };

  const startTrip = (tripId: string) => {
    setError(null);
    try {
      updateTripStatus(tripId, 'traveling');
    } catch (caught) {
      setError(lifecycleError(caught, 'start'));
    }
  };

  const requestEndJourney = (tripId: string) => {
    setError(null);
    setEndingTripId(tripId);
  };

  const confirmEndJourney = () => {
    if (!endingTripId) return;
    setError(null);
    try {
      updateTripStatus(endingTripId, 'achieve');
      setEndingTripId(null);
    } catch (caught) {
      setError(lifecycleError(caught, 'archive'));
    }
  };

  const endingTrip = endingTripId ? trips.find((trip) => trip.id === endingTripId) : null;

  return (
    <section style={styles.container} aria-label="Trip Manager">
      <div style={styles.header}>
        <div>
          <div style={styles.eyebrow}>TRIP MANAGER</div>
          <h2 style={styles.title}>Your Journeys</h2>
        </div>
        <div style={styles.count}>{trips.length} trips</div>
      </div>

      {error && (
        <div role="alert" style={styles.error}>
          {error}
          <button type="button" onClick={() => setError(null)} style={styles.dismiss}>×</button>
        </div>
      )}

      {STATUS_ORDER.map((status) => (
        <section key={status} style={styles.group} aria-labelledby={`trip-status-${status}`}>
          <div style={styles.groupHeader}>
            <h3 id={`trip-status-${status}`} style={styles.groupTitle}>{STATUS_LABELS[status]}</h3>
            <span style={styles.groupCount}>{grouped[status].length}</span>
          </div>

          {grouped[status].length === 0 ? (
            <div style={styles.empty}>No {STATUS_LABELS[status].toLowerCase()} trips.</div>
          ) : (
            <div style={styles.list}>
              {grouped[status].map((trip) => {
                const planningContext = status === 'planning' ? calculatePlanningContext(trip) : null;
                return (
                  <article key={trip.id} style={styles.card}>
                    <div style={styles.cardMain}>
                      <div style={styles.tripTitle}>{trip.title}</div>
                      <div style={styles.destination}>{trip.destination || '—'}</div>
                      <div style={styles.meta}>{trip.localCurrency} · {trip.members.length} members</div>
                      {planningContext && (
                        <div style={styles.planningContext} aria-label={`Planning context for ${trip.title}`}>
                          <span>{planningContext.durationDays} days</span>
                          <span>{planningContext.memberCount} {planningContext.memberCount === 1 ? 'traveler' : 'travelers'}</span>
                          <span>{planningContext.currency}</span>
                        </div>
                      )}
                    </div>
                    <div style={styles.actions}>
                      {status === 'planning' && (
                        <button
                          type="button"
                          onClick={() => startTrip(trip.id)}
                          style={styles.primaryButton}
                        >
                          Start Trip
                        </button>
                      )}
                      {status === 'traveling' && (
                        <button
                          type="button"
                          onClick={() => requestEndJourney(trip.id)}
                          style={styles.secondaryButton}
                        >
                          End Journey
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ))}

      {endingTrip && (
        <div role="presentation" style={styles.backdrop} onMouseDown={(event) => {
          if (event.target === event.currentTarget) setEndingTripId(null);
        }}>
          <div role="dialog" aria-modal="true" aria-labelledby="end-journey-title" style={styles.dialog}>
            <div style={styles.dialogEyebrow}>END JOURNEY</div>
            <h3 id="end-journey-title" style={styles.dialogTitle}>Finish {endingTrip.title}?</h3>
            <p style={styles.dialogBody}>
              This will close the active journey and move it to Achieve. Its existing ledger entries remain unchanged and will be reflected in completed journeys.
            </p>
            <div style={styles.dialogActions}>
              <button type="button" onClick={() => setEndingTripId(null)} style={styles.cancelButton}>Keep traveling</button>
              <button type="button" onClick={confirmEndJourney} style={styles.confirmButton}>End Journey</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 20,
    border: '1px solid #d7d4ca',
    borderRadius: 14,
    background: '#fff',
    color: '#172033',
    boxSizing: 'border-box',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 18 },
  eyebrow: { fontSize: 10, letterSpacing: '0.16em', opacity: 0.55 },
  title: { margin: '3px 0 0', fontSize: 24 },
  count: { fontSize: 12, opacity: 0.6 },
  error: {
    display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center',
    marginBottom: 14, padding: '10px 12px', border: '1px solid #d7a5a5', borderRadius: 8,
    background: '#fff5f5', color: '#8a2020', fontSize: 13,
  },
  dismiss: { border: 0, background: 'transparent', fontSize: 18, cursor: 'pointer', color: 'inherit' },
  group: { marginTop: 18 },
  groupHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  groupTitle: { margin: 0, fontSize: 14, letterSpacing: '0.04em' },
  groupCount: { minWidth: 20, padding: '2px 6px', borderRadius: 999, background: '#f0eee8', fontSize: 11, textAlign: 'center' },
  empty: { padding: '12px 0', color: '#7b7d82', fontSize: 13 },
  list: { display: 'grid', gap: 8 },
  card: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14,
    padding: 13, border: '1px solid #e2dfd6', borderRadius: 10,
  },
  cardMain: { minWidth: 0 },
  tripTitle: { fontWeight: 650, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis' },
  destination: { marginTop: 2, fontSize: 13, opacity: 0.72 },
  meta: { marginTop: 5, fontSize: 11, opacity: 0.5 },
  planningContext: { display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 8, fontSize: 11, color: '#62656b' },
  actions: { flexShrink: 0 },
  primaryButton: { border: 0, borderRadius: 7, padding: '8px 11px', background: '#172033', color: '#fff', cursor: 'pointer', fontSize: 12 },
  secondaryButton: { border: '1px solid #c9c5ba', borderRadius: 7, padding: '8px 11px', background: '#fff', color: '#172033', cursor: 'pointer', fontSize: 12 },
  backdrop: { position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(23, 32, 51, 0.28)' },
  dialog: { width: 'min(420px, 100%)', padding: 22, borderRadius: 16, border: '1px solid #d7d4ca', background: '#fffdf8', boxShadow: '0 18px 50px rgba(23, 32, 51, 0.18)' },
  dialogEyebrow: { fontSize: 10, letterSpacing: '0.16em', opacity: 0.55 },
  dialogTitle: { margin: '6px 0 10px', fontSize: 22, lineHeight: 1.2 },
  dialogBody: { margin: 0, color: '#62656b', fontSize: 14, lineHeight: 1.55 },
  dialogActions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 },
  cancelButton: { border: '1px solid #c9c5ba', borderRadius: 8, padding: '9px 12px', background: '#fff', color: '#172033', cursor: 'pointer', fontSize: 12 },
  confirmButton: { border: 0, borderRadius: 8, padding: '9px 12px', background: '#172033', color: '#fff', cursor: 'pointer', fontSize: 12 },
};

export default TripManager;
