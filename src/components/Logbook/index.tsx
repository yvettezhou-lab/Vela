import { getTripDestinations, getTripEndDate, getTripStartDate } from '../../core/travelSegment';

import { AnnualReflection, LedgerEntry, Trip, TripInsights } from '../../types/logbook';
import CrossTripIntelligence from '../CrossTripIntelligence';

interface LogbookViewProps {
  annualReflection: AnnualReflection;
  activeTrip: Trip | null;
  plannedTrips: Trip[];
  tripInsights: TripInsights[];
  reflectionTrips: Trip[];
}

const number = (value: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
const entries = (values: Record<string, number>) => Object.entries(values).sort(([, a], [, b]) => b - a);
const date = (value: number) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

const ledgerDate = (entry: LedgerEntry) => {
  if (entry.entryType === 'standard' || entry.entryType === 'prepaid_multi_day') return entry.paymentDate;
  return entry.outboundDate;
};

export const LogbookView = ({ annualReflection, activeTrip, plannedTrips, tripInsights, reflectionTrips }: LogbookViewProps) => {
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [annualDrilldown, setAnnualDrilldown] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const currencies = entries(annualReflection.annualExpenditure);
  const categories = entries(annualReflection.topCategories).filter(([, amount]) => amount > 0).slice(0, 6);
  const maxCategory = categories[0]?.[1] || 1;
  const activeInsight = activeTrip ? tripInsights.find((insight) => insight.tripId === activeTrip.id) ?? null : null;
  const completedInsights = tripInsights.filter((insight) => insight.tripId !== activeTrip?.id);
  const selectedTrip = useMemo(() => reflectionTrips.find((trip) => trip.id === selectedTripId) ?? null, [reflectionTrips, selectedTripId]);
  const selectedInsight = selectedTrip ? tripInsights.find((insight) => insight.tripId === selectedTrip.id) ?? null : null;
  const selectedEntry = selectedTrip?.ledger.find((entry) => entry.id === selectedEntryId) ?? null;

  const openTrip = (trip: Trip) => {
    setAnnualDrilldown(false);
    setSelectedEntryId(null);
    setSelectedTripId(trip.id);
  };

  const closeDrilldown = () => {
    setSelectedTripId(null);
    setSelectedEntryId(null);
    setAnnualDrilldown(false);
  };

  return (
    <main className="logbook-page">
      <header className="logbook-header">
        <div><p className="logbook-kicker">REFLECTION / {annualReflection.year}</p><h1>Logbook</h1><p className="logbook-subtitle">A quiet record of where the year has taken you.</p></div>
        <span className="logbook-mark">✦</span>
      </header>

      <CrossTripIntelligence trips={reflectionTrips.filter((trip) => trip.status === 'achieve')} />

      <section className="logbook-section">
        <div className="logbook-section-heading"><div><span className="logbook-overline">THE YEAR IN MOTION</span><h2>Annual totals</h2></div><span className="logbook-year">{annualReflection.year}</span></div>
        <div className="logbook-stat-grid">
          <button type="button" className="logbook-stat logbook-stat-button" onClick={() => setAnnualDrilldown(true)} aria-label="Explore journeys for the year"><span>TRIPS</span><strong>{annualReflection.totalTripsCompleted}</strong><small>{annualReflection.activeTripCount > 0 ? 'completed journeys + 1 journey in progress' : 'completed journeys'} · tap to explore</small></button>
          <article className="logbook-stat"><span>DAYS</span><strong>{annualReflection.totalDaysTraveled}</strong><small>{annualReflection.activeTripCount > 0 ? 'days on the road includes current journey' : 'days on the road'}</small></article>
          <article className="logbook-stat logbook-stat-wide"><span>EXPENDITURE</span><div className="logbook-money-list">{currencies.length ? currencies.map(([currency, amount]) => <div key={currency}><strong>{number(amount)}</strong><small>{currency}</small></div>) : <small>No recorded expenditure yet.</small>}</div>{annualReflection.activeTripCount > 0 && <small className="logbook-live-note">live spend included</small>}</article>
        </div>
      </section>

      <section className="logbook-section">
        <div className="logbook-section-heading"><div><span className="logbook-overline">TRAVEL RHYTHM</span><h2>Frequency</h2></div></div>
        <div className="logbook-stat-grid">
          <article className="logbook-stat"><span>TRIPS / YEAR</span><strong>{annualReflection.travelFrequency.tripsPerYear}</strong><small>journeys reflected</small></article>
          <article className="logbook-stat"><span>AVG. LENGTH</span><strong>{number(annualReflection.travelFrequency.averageTripLength)}</strong><small>days per journey</small></article>
          <article className="logbook-stat"><span>TRAVEL DAYS</span><strong>{annualReflection.travelFrequency.travelDaysPerYear}</strong><small>{annualReflection.travelFrequency.monthsWithTravel} months with travel</small></article>
          <article className="logbook-stat"><span>AVG. GAP</span><strong>{annualReflection.travelFrequency.averageGapBetweenTrips == null ? '—' : number(annualReflection.travelFrequency.averageGapBetweenTrips)}</strong><small>days between journeys</small></article>
        </div>
      </section>

      {activeInsight && activeTrip && <section className="logbook-section logbook-live-section"><div className="logbook-section-heading"><div><span className="logbook-overline">IN MOTION NOW</span><h2>{activeTrip.title || getTripDestinations(activeTrip).join(' · ') || 'Current journey'}</h2></div><span className="logbook-live-badge">LIVE</span></div><button type="button" className="logbook-trip-card logbook-trip-button" onClick={() => openTrip(activeTrip)}><div className="logbook-trip-top"><span>{getTripDestinations(activeTrip).join(' · ') || 'Current journey'}</span><strong>{activeInsight.totalDays} DAYS</strong></div><div className="logbook-trip-body"><div><small>SPEND SO FAR</small>{Object.entries(activeInsight.totalExpenditure).map(([currency, amount]) => <strong key={currency}>{number(amount)} <em>{currency}</em></strong>)}</div><div><small>PER DAY</small>{Object.entries(activeInsight.averageCostPerDay).map(([currency, amount]) => <strong key={currency}>{number(amount)} <em>{currency}</em></strong>)}</div><div><small>ENTRIES</small><strong>{activeTrip.ledger.length}</strong></div></div><span className="logbook-drill-hint">View journey →</span></button></section>}

      {categories.length > 0 && <section className="logbook-section"><div className="logbook-section-heading"><div><span className="logbook-overline">HOW IT WAS SPENT</span><h2>Category rhythm</h2></div></div><div className="logbook-category-list">{categories.map(([name, amount]) => <div className="logbook-category" key={name}><div className="logbook-category-label"><span>{name}</span><strong>{number(amount)}</strong></div><div className="logbook-bar"><span style={{ width: `${Math.max(4, amount / maxCategory * 100)}%` }} /></div></div>)}</div></section>}

      <section className="logbook-section">
        <div className="logbook-section-heading"><div><span className="logbook-overline">JOURNEY NOTES</span><h2>Completed journeys</h2></div><span className="logbook-count">{completedInsights.length}</span></div>
        {completedInsights.length ? <div className="logbook-trip-list">{completedInsights.map((insight) => { const trip = reflectionTrips.find((item) => item.id === insight.tripId); return <button type="button" className="logbook-trip-card logbook-trip-button" key={insight.tripId} onClick={() => trip && openTrip(trip)}><div className="logbook-trip-top"><span>{trip?.title || trip?.destination || insight.tripId}</span><strong>{insight.totalDays} DAYS</strong></div><div className="logbook-trip-body"><div><small>SPEND</small>{Object.entries(insight.totalExpenditure).map(([currency, amount]) => <strong key={currency}>{number(amount)} <em>{currency}</em></strong>)}</div><div><small>PER DAY</small>{Object.entries(insight.averageCostPerDay).map(([currency, amount]) => <strong key={currency}>{number(amount)} <em>{currency}</em></strong>)}</div><div><small>LARGEST EXPENSE</small><strong>{insight.largestExpense ? number(insight.largestExpense.originalAmount) : '—'}</strong></div></div><div className="logbook-trip-structure">{insight.expenseStructure.slice(0, 4).map((item) => <span key={item.category}>{item.category} {item.share}%</span>)}</div><span className="logbook-drill-hint">View journey →</span></button>; })}</div> : <div className="logbook-empty">Complete a journey to begin your reflection.</div>}
      </section>

      <section className="logbook-section logbook-planning"><div className="logbook-section-heading"><div><span className="logbook-overline">ON THE HORIZON</span><h2>Planning next</h2></div><span className="logbook-count">{annualReflection.plannedTripCount}</span></div>{plannedTrips.length ? <div className="logbook-planned-list">{plannedTrips.map((trip) => <div className="logbook-planned-card" key={trip.id}><strong>{trip.title || 'Untitled journey'}</strong><span>{getTripDestinations(trip).join(' · ') || 'Destination not set'}</span><small>{new Date(getTripStartDate(trip)).toLocaleDateString()} — {new Date(getTripEndDate(trip)).toLocaleDateString()} · {Math.max(1, Math.floor((getTripEndDate(trip) - getTripStartDate(trip)) / 86400000) + 1)} days</small></div>)}</div> : <div className="logbook-empty">Your next journey awaits.</div>}</section>

      {(annualDrilldown || selectedTrip) && <div className="logbook-drill-overlay" role="dialog" aria-modal="true" aria-label={selectedTrip ? 'Journey details' : 'Annual journey list'}>
        <div className="logbook-drill-sheet">
          <div className="logbook-drill-header">
            <button type="button" className="logbook-back-button" onClick={selectedTrip ? closeDrilldown : () => setAnnualDrilldown(false)}>{selectedTrip ? '← All journeys' : 'Close'}</button>
            <span className="logbook-overline">{selectedTrip ? 'JOURNEY DETAIL' : `YEAR / ${annualReflection.year}`}</span>
            <button type="button" className="logbook-close-button" onClick={closeDrilldown} aria-label="Close">×</button>
          </div>

          {!selectedTrip && <>
            <h2 className="logbook-drill-title">Journeys in {annualReflection.year}</h2>
            <div className="logbook-drill-list">{reflectionTrips.map((trip) => { const insight = tripInsights.find((item) => item.tripId === trip.id); return <button type="button" className="logbook-drill-trip" key={trip.id} onClick={() => openTrip(trip)}><div><strong>{trip.title || getTripDestinations(trip).join(' · ') || 'Untitled journey'}</strong><span>{getTripDestinations(trip).join(' · ') || 'Destination not set'}</span></div><div><strong>{insight?.totalDays ?? '—'} d</strong><span>{trip.status === 'traveling' ? 'LIVE' : 'ACHIEVED'}</span></div><span className="logbook-chevron">›</span></button>; })}</div>
          </>}

          {selectedTrip && selectedInsight && <>
            <div className="logbook-drill-trip-heading"><div><span className="logbook-overline">{selectedTrip.status.toUpperCase()}</span><h2 className="logbook-drill-title">{selectedTrip.title || getTripDestinations(selectedTrip).join(' · ') || 'Untitled journey'}</h2><p>{getTripDestinations(selectedTrip).join(' · ') || 'Destination not set'} · {date(getTripStartDate(selectedTrip))} — {date(getTripEndDate(selectedTrip))}</p></div><span className="logbook-drill-days">{selectedInsight.totalDays}<small>DAYS</small></span></div>
            <div className="logbook-drill-metrics"><div><span>SPEND</span>{Object.entries(selectedInsight.totalExpenditure).map(([currency, amount]) => <strong key={currency}>{number(amount)} {currency}</strong>)}</div><div><span>ENTRIES</span><strong>{selectedTrip.ledger.length}</strong></div><div><span>PER DAY</span>{Object.entries(selectedInsight.averageCostPerDay).map(([currency, amount]) => <strong key={currency}>{number(amount)} {currency}</strong>)}</div></div>
            <div className="logbook-drill-section-title"><span>LEDGER</span><strong>{selectedTrip.ledger.length} entries</strong></div>
            <div className="logbook-ledger-list">{selectedTrip.ledger.length ? selectedTrip.ledger.map((entry) => { const category = selectedTrip.categories.find((item) => item.id === entry.categoryId)?.name || 'Uncategorized'; const payer = selectedTrip.members.find((item) => item.id === entry.payerId)?.name || 'Unknown payer'; return <button type="button" className="logbook-ledger-row" key={entry.id} onClick={() => setSelectedEntryId(entry.id)}><div><strong>{category}</strong><span>{date(ledgerDate(entry))} · {payer}</span></div><div><strong>{entry.isRefund ? '−' : ''}{number(entry.originalAmount)}</strong><span>{entry.originalCurrency}</span></div><span className="logbook-chevron">›</span></button>; }) : <div className="logbook-empty">No ledger entries recorded.</div>}</div>
          </>}

          {selectedEntry && selectedTrip && <div className="logbook-entry-detail"><div className="logbook-entry-detail-header"><div><span className="logbook-overline">LEDGER DETAIL</span><h3>{selectedTrip.categories.find((item) => item.id === selectedEntry.categoryId)?.name || 'Uncategorized'}</h3></div><button type="button" className="logbook-close-button" onClick={() => setSelectedEntryId(null)} aria-label="Close entry">×</button></div><div className="logbook-entry-amount">{selectedEntry.isRefund ? '−' : ''}{number(selectedEntry.originalAmount)} <small>{selectedEntry.originalCurrency}</small></div><dl><div><dt>Date</dt><dd>{date(ledgerDate(selectedEntry))}</dd></div><div><dt>CNY equivalent</dt><dd>¥{number(selectedEntry.cnyEquivalent)}</dd></div><div><dt>Payer</dt><dd>{selectedTrip.members.find((item) => item.id === selectedEntry.payerId)?.name || 'Unknown'}</dd></div><div><dt>Account</dt><dd>{selectedTrip.accounts.find((item) => item.id === selectedEntry.accountId)?.name || 'Unknown'}</dd></div><div><dt>Status</dt><dd>{selectedEntry.isPending ? 'Pending' : 'Settled'}</dd></div><div><dt>Type</dt><dd>{selectedEntry.entryType.replaceAll('_', ' ')}</dd></div></dl></div>}
        </div>
      </div>}
    </main>
  );
};

export default LogbookView;
