import { useMemo, useState } from 'react';
import { BarChart3, ChevronRight, Grid2X2, PieChart, TrendingUp } from 'lucide-react';
import { getTripDestinations, getTripEndDate, getTripStartDate } from '../../core/travelSegment';
import { LedgerEntry, Trip } from '../../core/domain';
import { AnnualReflection, TripInsights, TravelFrequency } from '../../types/logbook';
import CrossTripIntelligence from '../CrossTripIntelligence';

interface LogbookViewProps {
  annualReflection: AnnualReflection;
  activeTrip: Trip | null;
  plannedTrips: Trip[];
  tripInsights: TripInsights[];
  reflectionTrips: Trip[];
}

type Period = 'month' | 'year';
type Breakdown = 'category' | 'account' | 'person' | 'trend';
type ChartMode = 'donut' | 'bars';

const money = (value: number) => `¥${new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
const date = (value: number) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

const entryDate = (entry: LedgerEntry) =>
  entry.entryType === 'flight' ? entry.outboundDate : entry.paymentDate;

const signed = (entry: LedgerEntry) => entry.isRefund ? -entry.cnyEquivalent : entry.cnyEquivalent;

const tripLabel = (trip: Trip) => trip.title || getTripDestinations(trip).join(' · ') || 'Untitled journey';

const COLORS = ['#365a5b', '#9b7a4c', '#718783', '#c3a77a', '#526b6d', '#a8b0a5', '#7e6750', '#b6a28a'];

const getTravelFrequency = (trips: Trip[], year: number): TravelFrequency => {
  const selected = trips.filter((trip) => new Date(getTripStartDate(trip)).getFullYear() === year);
  const days = selected.reduce((sum, trip) => sum + Math.max(1, Math.floor((getTripEndDate(trip) - getTripStartDate(trip)) / 86400000) + 1), 0);
  return {
    tripsPerYear: selected.length,
    travelDaysPerYear: days,
    averageTripLength: selected.length ? Math.round((days / selected.length) * 100) / 100 : 0,
    monthsWithTravel: new Set(selected.flatMap((trip) => {
      const months: number[] = [];
      const cursor = new Date(getTripStartDate(trip));
      const end = new Date(getTripEndDate(trip));
      while (cursor <= end) {
        if (cursor.getFullYear() === year) months.push(cursor.getMonth());
        cursor.setDate(cursor.getDate() + 1);
      }
      return months;
    })).size,
    averageGapBetweenTrips: null,
  };
};

const Donut = ({ values }: { values: { label: string; value: number; color: string }[] }) => {
  const total = values.reduce((sum, item) => sum + item.value, 0);
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <svg className="logbook-donut" viewBox="0 0 150 150" role="img" aria-label="Spending distribution">
      <circle cx="75" cy="75" r={radius} fill="none" stroke="#e7e0d4" strokeWidth="20" />
      {values.map((item) => {
        const length = total > 0 ? (item.value / total) * circumference : 0;
        const node = <circle key={item.label} cx="75" cy="75" r={radius} fill="none" stroke={item.color} strokeWidth="20" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} transform="rotate(-90 75 75)" />;
        offset += length;
        return node;
      })}
      <text x="75" y="70" textAnchor="middle" className="logbook-donut-total">{money(total)}</text>
      <text x="75" y="87" textAnchor="middle" className="logbook-donut-label">TOTAL SPEND</text>
    </svg>
  );
};

const TrendChart = ({ values }: { values: { label: string; value: number }[] }) => {
  const max = Math.max(1, ...values.map((item) => item.value));
  return (
    <div className="logbook-trend-chart">
      {values.map((item) => (
        <div className="logbook-trend-column" key={item.label}>
          <span style={{ height: `${Math.max(4, item.value / max * 100)}%` }} title={money(item.value)} />
          <small>{item.label}</small>
        </div>
      ))}
    </div>
  );
};

export const LogbookView = ({ annualReflection, activeTrip, plannedTrips, tripInsights, reflectionTrips }: LogbookViewProps) => {
  const [period, setPeriod] = useState<Period>('year');
  const [breakdown, setBreakdown] = useState<Breakdown>('category');
  const [chartMode, setChartMode] = useState<ChartMode>('donut');
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [annualDrilldown, setAnnualDrilldown] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const allTrips = useMemo(() => reflectionTrips.concat(plannedTrips.filter((trip) => !reflectionTrips.some((item) => item.id === trip.id))), [reflectionTrips, plannedTrips]);
  const now = new Date();

  const scopedEntries = useMemo(() => allTrips.flatMap((trip) => trip.ledger.map((entry) => ({ trip, entry }))).filter(({ entry }) => {
    const d = new Date(entryDate(entry));
    if (period === 'year') return d.getFullYear() === now.getFullYear();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }), [allTrips, period, now]);

  const metrics = useMemo(() => {
    const expense = scopedEntries.reduce((sum, item) => sum + Math.max(0, signed(item.entry)), 0);
    const refunds = scopedEntries.reduce((sum, item) => sum + Math.max(0, -signed(item.entry)), 0);
    const income = 0;
    return { income, expense: Math.max(0, expense - refunds), net: income - Math.max(0, expense - refunds) };
  }, [scopedEntries]);

  const categoryValues = useMemo(() => {
    const map = new Map<string, number>();
    scopedEntries.forEach(({ trip, entry }) => {
      const name = trip.categories.find((category) => category.id === entry.categoryId)?.name ?? entry.categoryId;
      map.set(name, (map.get(name) ?? 0) + Math.max(0, signed(entry)));
    });
    return [...map.entries()].filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value], index) => ({ label, value, color: COLORS[index % COLORS.length] }));
  }, [scopedEntries]);

  const accountValues = useMemo(() => {
    const map = new Map<string, number>();
    scopedEntries.forEach(({ trip, entry }) => {
      const name = trip.accounts.find((account) => account.id === entry.accountId)?.name ?? 'Unknown account';
      map.set(name, (map.get(name) ?? 0) + Math.max(0, signed(entry)));
    });
    return [...map.entries()].filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value }));
  }, [scopedEntries]);

  const personValues = useMemo(() => {
    const map = new Map<string, number>();
    scopedEntries.forEach(({ trip, entry }) => {
      const name = trip.members.find((member) => member.id === entry.payerId)?.name ?? 'Unknown person';
      map.set(name, (map.get(name) ?? 0) + Math.max(0, signed(entry)));
    });
    return [...map.entries()].filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value }));
  }, [scopedEntries]);

  const trendValues = useMemo(() => {
    const count = period === 'year' ? 12 : 31;
    const labels = period === 'year'
      ? Array.from({ length: 12 }, (_, index) => new Date(now.getFullYear(), index, 1).toLocaleDateString(undefined, { month: 'short' }))
      : Array.from({ length: count }, (_, index) => String(index + 1));
    const map = new Map<number, number>();
    scopedEntries.forEach(({ entry }) => {
      const d = new Date(entryDate(entry));
      const key = period === 'year' ? d.getMonth() : d.getDate() - 1;
      map.set(key, (map.get(key) ?? 0) + Math.max(0, signed(entry)));
    });
    return labels.map((label, index) => ({ label, value: map.get(index) ?? 0 }));
  }, [scopedEntries, period, now]);

  const activeValues = breakdown === 'category' ? categoryValues : breakdown === 'account' ? accountValues : personValues;
  const maxBreakdown = Math.max(1, ...activeValues.map((item) => item.value));
  const selectedTrip = selectedTripId ? reflectionTrips.find((trip) => trip.id === selectedTripId) ?? null : null;
  const selectedInsight = selectedTrip ? tripInsights.find((insight) => insight.tripId === selectedTrip.id) ?? null : null;
  const selectedEntry = selectedTrip?.ledger.find((entry) => entry.id === selectedEntryId) ?? null;

  const openTrip = (trip: Trip) => { setAnnualDrilldown(false); setSelectedEntryId(null); setSelectedTripId(trip.id); };
  const closeDrilldown = () => { setSelectedTripId(null); setSelectedEntryId(null); setAnnualDrilldown(false); };

  return (
    <main className="logbook-page">
      <header className="logbook-header">
        <div><p className="logbook-kicker">REFLECTION / {annualReflection.year}</p><h1>Logbook</h1><p className="logbook-subtitle">A quiet record of where the year has taken you.</p></div>
        <span className="logbook-mark">✦</span>
      </header>

      <section className="logbook-analytics">
        <div className="logbook-analytics-top">
          <div><span className="logbook-overline">WHERE YOUR LIFE FLOWS</span><h2>Money in motion</h2></div>
          <div className="logbook-pill-group" role="group" aria-label="Time range">
            {(['month', 'year'] as Period[]).map((value) => <button key={value} type="button" className={period === value ? 'active' : ''} onClick={() => setPeriod(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}
          </div>
        </div>
        <div className="logbook-flow-grid">
          <article><span>INCOME</span><strong>{money(metrics.income)}</strong><small>Recorded inflow</small></article>
          <article><span>EXPENSE</span><strong>{money(metrics.expense)}</strong><small>Net of refunds</small></article>
          <article><span>NET FLOW</span><strong className={metrics.net < 0 ? 'negative' : ''}>{money(metrics.net)}</strong><small>Income − expense</small></article>
        </div>

        <div className="logbook-analytics-toolbar">
          <div className="logbook-pill-group" role="group" aria-label="Breakdown">
            {(['category', 'account', 'person', 'trend'] as Breakdown[]).map((value) => <button key={value} type="button" className={breakdown === value ? 'active' : ''} onClick={() => setBreakdown(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}
          </div>
          {breakdown !== 'trend' && <button type="button" className="logbook-chart-toggle" onClick={() => setChartMode(chartMode === 'donut' ? 'bars' : 'donut')} aria-label={`Switch to ${chartMode === 'donut' ? 'bar' : 'donut'} chart`}>
            {chartMode === 'donut' ? <BarChart3 size={17} /> : <PieChart size={17} />}
          </button>}
        </div>

        <div className="logbook-visual-card">
          {breakdown === 'trend' ? (
            <div><div className="logbook-visual-heading"><div><span className="logbook-overline">SPENDING TREND</span><h3>{period === 'year' ? 'Monthly flow' : 'Daily flow'}</h3></div><TrendingUp size={18} /></div><TrendChart values={trendValues} /></div>
          ) : chartMode === 'donut' && breakdown === 'category' ? (
            <div className="logbook-donut-layout"><Donut values={categoryValues} /><div className="logbook-legend">{categoryValues.length ? categoryValues.map((item) => <div key={item.label}><i style={{ background: item.color }} /><span>{item.label}</span><strong>{money(item.value)}</strong></div>) : <p className="logbook-empty-inline">No recorded spending for this period.</p>}</div></div>
          ) : (
            <div><div className="logbook-visual-heading"><div><span className="logbook-overline">SPENDING BY {breakdown.toUpperCase()}</span><h3>{breakdown === 'category' ? 'Category rhythm' : breakdown === 'account' ? 'Account rhythm' : 'Person rhythm'}</h3></div><Grid2X2 size={17} /></div><div className="logbook-bars">{activeValues.length ? activeValues.map((item) => <div className="logbook-analysis-row" key={item.label}><div className="logbook-analysis-row-head"><span>{item.label}</span><strong>{money(item.value)}</strong></div><div className="logbook-analysis-track"><span style={{ width: `${Math.max(4, item.value / maxBreakdown * 100)}%` }} /></div></div>) : <p className="logbook-empty-inline">No recorded spending for this period.</p>}</div>
          )}
        </div>
      </section>

      <CrossTripIntelligence trips={reflectionTrips.filter((trip) => trip.status === 'achieve')} />

      <section className="logbook-section">
        <div className="logbook-section-heading"><div><span className="logbook-overline">THE YEAR IN MOTION</span><h2>Annual totals</h2></div><span className="logbook-year">{annualReflection.year}</span></div>
        <div className="logbook-stat-grid">
          <button type="button" className="logbook-stat logbook-stat-button" onClick={() => setAnnualDrilldown(true)} aria-label="Explore journeys for the year"><span>TRIPS</span><strong>{annualReflection.totalTripsCompleted}</strong><small>{annualReflection.activeTripCount > 0 ? 'completed journeys + 1 journey in progress' : 'completed journeys'} · tap to explore</small></button>
          <article className="logbook-stat"><span>DAYS</span><strong>{annualReflection.totalDaysTraveled}</strong><small>{annualReflection.activeTripCount > 0 ? 'days on the road includes current journey' : 'days on the road'}</small></article>
          <article className="logbook-stat logbook-stat-wide"><span>EXPENDITURE</span><div className="logbook-money-list">{Object.entries(annualReflection.annualExpenditure).length ? Object.entries(annualReflection.annualExpenditure).map(([currency, amount]) => <div key={currency}><strong>{new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(amount)}</strong><small>{currency}</small></div>) : <small>No recorded expenditure yet.</small>}</div></article>
        </div>
      </section>

      {activeTrip && <section className="logbook-section logbook-live-section"><div className="logbook-section-heading"><div><span className="logbook-overline">IN MOTION NOW</span><h2>{tripLabel(activeTrip)}</h2></div><span className="logbook-live-badge">LIVE</span></div><button type="button" className="logbook-trip-card logbook-trip-button" onClick={() => openTrip(activeTrip)}><div className="logbook-trip-top"><span>{getTripDestinations(activeTrip).join(' · ') || 'Current journey'}</span><strong>{activeTrip.ledger.length} ENTRIES</strong></div><div className="logbook-trip-body"><div><small>SPEND SO FAR</small>{Object.entries(tripInsights.find((insight) => insight.tripId === activeTrip.id)?.totalExpenditure ?? {}).map(([currency, amount]) => <strong key={currency}>{amount.toFixed(2)} <em>{currency}</em></strong>)}</div><div><small>STATUS</small><strong>LIVE</strong></div><div><small>DAYS</small><strong>{Math.max(1, Math.floor((getTripEndDate(activeTrip) - getTripStartDate(activeTrip)) / 86400000) + 1)}</strong></div></div><span className="logbook-drill-hint">View journey →</span></button></section>}

      <section className="logbook-section">
        <div className="logbook-section-heading"><div><span className="logbook-overline">JOURNEY NOTES</span><h2>Completed journeys</h2></div><span className="logbook-count">{tripInsights.filter((insight) => insight.tripId !== activeTrip?.id).length}</span></div>
        {tripInsights.filter((insight) => insight.tripId !== activeTrip?.id).length ? <div className="logbook-trip-list">{tripInsights.filter((insight) => insight.tripId !== activeTrip?.id).map((insight) => { const trip = reflectionTrips.find((item) => item.id === insight.tripId); return <button type="button" className="logbook-trip-card logbook-trip-button" key={insight.tripId} onClick={() => trip && openTrip(trip)}><div className="logbook-trip-top"><span>{trip ? tripLabel(trip) : insight.tripId}</span><strong>{insight.totalDays} DAYS</strong></div><div className="logbook-trip-body"><div><small>SPEND</small>{Object.entries(insight.totalExpenditure).map(([currency, amount]) => <strong key={currency}>{amount.toFixed(2)} <em>{currency}</em></strong>)}</div><div><small>PER DAY</small>{Object.entries(insight.averageCostPerDay).map(([currency, amount]) => <strong key={currency}>{amount.toFixed(2)} <em>{currency}</em></strong>)}</div><div><small>LARGEST EXPENSE</small><strong>{insight.largestExpense ? insight.largestExpense.originalAmount.toFixed(2) : '—'}</strong></div></div><span className="logbook-drill-hint">View journey →</span></button>; })}</div> : <div className="logbook-empty">Complete a journey to begin your reflection.</div>}
      </section>

      <section className="logbook-section logbook-planning"><div className="logbook-section-heading"><div><span className="logbook-overline">ON THE HORIZON</span><h2>Planning next</h2></div><span className="logbook-count">{plannedTrips.length}</span></div>{plannedTrips.length ? <div className="logbook-planned-list">{plannedTrips.map((trip) => <div className="logbook-planned-card" key={trip.id}><strong>{tripLabel(trip)}</strong><span>{getTripDestinations(trip).join(' · ') || 'Destination not set'}</span><small>{new Date(getTripStartDate(trip)).toLocaleDateString()} — {new Date(getTripEndDate(trip)).toLocaleDateString()} · {Math.max(1, Math.floor((getTripEndDate(trip) - getTripStartDate(trip)) / 86400000) + 1)} days</small></div>)}</div> : <div className="logbook-empty">Your next journey awaits.</div>}</section>

      {(annualDrilldown || selectedTrip) && <div className="logbook-drill-overlay" role="dialog" aria-modal="true" aria-label={selectedTrip ? 'Journey details' : 'Annual journey list'}>
        <div className="logbook-drill-sheet">
          <div className="logbook-drill-header"><button type="button" className="logbook-back-button" onClick={selectedTrip ? closeDrilldown : () => setAnnualDrilldown(false)}>{selectedTrip ? '← All journeys' : 'Close'}</button><span className="logbook-overline">{selectedTrip ? 'JOURNEY DETAIL' : `YEAR / ${annualReflection.year}`}</span><button type="button" className="logbook-close-button" onClick={closeDrilldown} aria-label="Close">×</button></div>
          {!selectedTrip && <><h2 className="logbook-drill-title">Journeys in {annualReflection.year}</h2><div className="logbook-drill-list">{reflectionTrips.map((trip) => { const insight = tripInsights.find((item) => item.tripId === trip.id); return <button type="button" className="logbook-drill-trip" key={trip.id} onClick={() => openTrip(trip)}><div><strong>{tripLabel(trip)}</strong><span>{getTripDestinations(trip).join(' · ') || 'Destination not set'}</span></div><div><strong>{insight?.totalDays ?? '—'} d</strong><span>{trip.status === 'traveling' ? 'LIVE' : 'ACHIEVED'}</span></div><span className="logbook-chevron">›</span></button>; })}</div></>}
          {selectedTrip && selectedInsight && <><div className="logbook-drill-trip-heading"><div><span className="logbook-overline">{selectedTrip.status.toUpperCase()}</span><h2 className="logbook-drill-title">{tripLabel(selectedTrip)}</h2><p>{getTripDestinations(selectedTrip).join(' · ') || 'Destination not set'} · {date(getTripStartDate(selectedTrip))} — {date(getTripEndDate(selectedTrip))}</p></div><span className="logbook-drill-days">{selectedInsight.totalDays}<small>DAYS</small></span></div><div className="logbook-drill-metrics"><div><span>SPEND</span>{Object.entries(selectedInsight.totalExpenditure).map(([currency, amount]) => <strong key={currency}>{amount.toFixed(2)} {currency}</strong>)}</div><div><span>ENTRIES</span><strong>{selectedTrip.ledger.length}</strong></div><div><span>PER DAY</span>{Object.entries(selectedInsight.averageCostPerDay).map(([currency, amount]) => <strong key={currency}>{amount.toFixed(2)} {currency}</strong>)}</div></div><div className="logbook-drill-section-title"><span>LEDGER</span><strong>{selectedTrip.ledger.length} entries</strong></div><div className="logbook-ledger-list">{selectedTrip.ledger.length ? selectedTrip.ledger.map((entry) => { const category = selectedTrip.categories.find((item) => item.id === entry.categoryId)?.name || 'Uncategorized'; const payer = selectedTrip.members.find((item) => item.id === entry.payerId)?.name || 'Unknown payer'; return <button type="button" className="logbook-ledger-row" key={entry.id} onClick={() => setSelectedEntryId(entry.id)}><div><strong>{category}</strong><span>{date(entryDate(entry))} · {payer}</span></div><div><strong>{entry.isRefund ? '−' : ''}{entry.originalAmount.toFixed(2)}</strong><span>{entry.originalCurrency}</span></div><span className="logbook-chevron">›</span></button>; }) : <div className="logbook-empty">No ledger entries recorded.</div>}</div></>}
          {selectedEntry && selectedTrip && <div className="logbook-entry-detail"><div className="logbook-entry-detail-header"><div><span className="logbook-overline">LEDGER DETAIL</span><h3>{selectedTrip.categories.find((item) => item.id === selectedEntry.categoryId)?.name || 'Uncategorized'}</h3></div><button type="button" className="logbook-close-button" onClick={() => setSelectedEntryId(null)} aria-label="Close entry">×</button></div><div className="logbook-entry-amount">{selectedEntry.isRefund ? '−' : ''}{selectedEntry.originalAmount.toFixed(2)} <small>{selectedEntry.originalCurrency}</small></div><dl><div><dt>Date</dt><dd>{date(entryDate(selectedEntry))}</dd></div><div><dt>CNY equivalent</dt><dd>¥{selectedEntry.cnyEquivalent.toFixed(2)}</dd></div><div><dt>Payer</dt><dd>{selectedTrip.members.find((item) => item.id === selectedEntry.payerId)?.name || 'Unknown'}</dd></div><div><dt>Account</dt><dd>{selectedTrip.accounts.find((item) => item.id === selectedEntry.accountId)?.name || 'Unknown'}</dd></div><div><dt>Status</dt><dd>{selectedEntry.isPending ? 'Pending' : 'Settled'}</dd></div><div><dt>Type</dt><dd>{selectedEntry.entryType.replaceAll('_', ' ')}</dd></div></dl></div>}
        </div>
      </div>}
    </main>
  );
};

export default LogbookView;
