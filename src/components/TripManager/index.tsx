import React, { useState } from 'react';
import { TripStatus } from '../../core/domain';
import { useVelaStore } from '../../store/useVelaStore';

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
  return action === 'start' ? `无法开始行程：${message}` : `无法归档行程：${message}`;
}

export const TripManager: React.FC = () => {
  const trips = useVelaStore((state) => state.trips);
  const updateTripStatus = useVelaStore((state) => state.updateTripStatus);
  const [error, setError] = useState<string | null>(null);

  const grouped: Record<TripStatus, typeof trips> = {
    traveling: trips.filter((trip) => trip.status === 'traveling'),
    planning: trips
      .filter((trip) => trip.status === 'planning')
      .sort((a, b) => b.updatedAt - a.updatedAt),
    achieve: trips.filter((trip) => trip.status === 'achieve'),
  };

  const changeStatus = (tripId: string, newStatus: TripStatus, action: 'start' | 'archive') => {
    setError(null);
    try {
      updateTripStatus(tripId, newStatus);
    } catch (caught) {
      setError(lifecycleError(caught, action));
    }
  };

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
              {grouped[status].map((trip) => (
                <article key={trip.id} style={styles.card}>
                  <div style={styles.cardMain}>
                    <div style={styles.tripTitle}>{trip.title}</div>
                    <div style={styles.destination}>{trip.destination || '—'}</div>
                    <div style={styles.meta}>{trip.localCurrency} · {trip.members.length} members</div>
                  </div>
                  <div style={styles.actions}>
                    {status === 'planning' && (
                      <button
                        type="button"
                        onClick={() => changeStatus(trip.id, 'traveling', 'start')}
                        style={styles.primaryButton}
                      >
                        Start Trip
                      </button>
                    )}
                    {status === 'traveling' && (
                      <button
                        type="button"
                        onClick={() => changeStatus(trip.id, 'achieve', 'archive')}
                        style={styles.secondaryButton}
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ))}
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
  actions: { flexShrink: 0 },
  primaryButton: { border: 0, borderRadius: 7, padding: '8px 11px', background: '#172033', color: '#fff', cursor: 'pointer', fontSize: 12 },
  secondaryButton: { border: '1px solid #c9c5ba', borderRadius: 7, padding: '8px 11px', background: '#fff', color: '#172033', cursor: 'pointer', fontSize: 12 },
};

export default TripManager;
