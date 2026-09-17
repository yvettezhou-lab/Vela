import { AnnualReflection, TripInsights } from '../../types/logbook';
import { Trip } from '../../core/domain';

interface LogbookViewProps {
  annualReflection: AnnualReflection;
  plannedTrips: Trip[];
  tripInsights: TripInsights[];
}

const number = (value: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
const entries = (values: Record<string, number>) => Object.entries(values).sort(([, a], [, b]) => b - a);

export const LogbookView = ({ annualReflection, plannedTrips, tripInsights }: LogbookViewProps) => {
  const currencies = entries(annualReflection.annualExpenditure);
  const categories = entries(annualReflection.topCategories).filter(([, amount]) => amount > 0).slice(0, 6);
  const maxCategory = categories[0]?.[1] || 1;

  return (
    <main className="logbook-page">
      <header className="logbook-header">
        <div><p className="logbook-kicker">REFLECTION / {annualReflection.year}</p><h1>Logbook</h1><p className="logbook-subtitle">A quiet record of where the year has taken you.</p></div>
        <span className="logbook-mark">✦</span>
      </header>

      <section className="logbook-section">
        <div className="logbook-section-heading"><div><span className="logbook-overline">THE YEAR IN MOTION</span><h2>Annual totals</h2></div><span className="logbook-year">{annualReflection.year}</span></div>
        <div className="logbook-stat-grid">
          <article className="logbook-stat"><span>TRIPS</span><strong>{annualReflection.totalTripsCompleted}</strong><small>completed journeys</small></article>
          <article className="logbook-stat"><span>DAYS</span><strong>{annualReflection.totalDaysTraveled}</strong><small>days on the road</small></article>
          <article className="logbook-stat logbook-stat-wide"><span>EXPENDITURE</span><div className="logbook-money-list">{currencies.length ? currencies.map(([currency, amount]) => <div key={currency}><strong>{number(amount)}</strong><small>{currency}</small></div>) : <small>No recorded expenditure yet.</small>}</div></article>
        </div>
      </section>

      {categories.length > 0 && <section className="logbook-section"><div className="logbook-section-heading"><div><span className="logbook-overline">HOW IT WAS SPENT</span><h2>Category rhythm</h2></div></div><div className="logbook-category-list">{categories.map(([name, amount]) => <div className="logbook-category" key={name}><div className="logbook-category-label"><span>{name}</span><strong>{number(amount)}</strong></div><div className="logbook-bar"><span style={{ width: `${Math.max(4, amount / maxCategory * 100)}%` }} /></div></div>)}</div></section>}

      <section className="logbook-section"><div className="logbook-section-heading"><div><span className="logbook-overline">JOURNEY NOTES</span><h2>Completed journeys</h2></div><span className="logbook-count">{tripInsights.length}</span></div>{tripInsights.length ? <div className="logbook-trip-list">{tripInsights.map((insight) => <article className="logbook-trip-card" key={insight.tripId}><div className="logbook-trip-top"><span>{insight.tripId}</span><strong>{insight.totalDays} DAYS</strong></div><div className="logbook-trip-body"><div><small>SPEND</small>{Object.entries(insight.totalExpenditure).map(([currency, amount]) => <strong key={currency}>{number(amount)} <em>{currency}</em></strong>)}</div><div><small>PER DAY</small>{Object.entries(insight.averageCostPerDay).map(([currency, amount]) => <strong key={currency}>{number(amount)} <em>{currency}</em></strong>)}</div><div><small>LARGEST CATEGORY</small><strong>{insight.largestExpense ? insight.largestExpense.categoryId : '—'}</strong></div></div></article>)}</div> : <div className="logbook-empty">Complete a journey to begin your reflection.</div>}</section>

      <section className="logbook-section logbook-planning"><div className="logbook-section-heading"><div><span className="logbook-overline">ON THE HORIZON</span><h2>Planning next</h2></div><span className="logbook-count">{plannedTrips.length}</span></div>{plannedTrips.length ? <div className="logbook-planned-list">{plannedTrips.map((trip) => <div className="logbook-planned-card" key={trip.id}><strong>{trip.title || 'Untitled journey'}</strong><span>{trip.destination || 'Destination not set'}</span><small>{new Date(trip.startDate).toLocaleDateString()} — {new Date(trip.endDate).toLocaleDateString()}</small></div>)}</div> : <div className="logbook-empty">Your next journey awaits.</div>}</section>
    </main>
  );
};

export default LogbookView;
