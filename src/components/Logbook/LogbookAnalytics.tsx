import { useMemo, useState } from 'react';
import { BarChart3, PieChart } from 'lucide-react';
import { LedgerEntry, Trip } from '../../core/domain';
import { getTripEndDate, getTripStartDate } from '../../core/travelSegment';

type Scope = 'current' | 'all';
type View = 'category' | 'account' | 'person' | 'type' | 'compare';
type ChartMode = 'donut' | 'bars';
type CompareSort = 'total' | 'daily' | 'person';

const COLORS = ['#a9874b', '#718a72', '#5f6f82', '#ad8250', '#8e8476', '#6f665a', '#a79a87', '#9c7b48'];
const money = (n: number) => `¥${new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
const moneyCompact = (n: number) => {
  const sign = n < 0 ? '−' : n > 0 ? '+' : '';
  return `${sign}¥${new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.abs(n))}`;
};
const entryDate = (entry: LedgerEntry) => entry.entryType === 'flight' ? entry.outboundDate : entry.paymentDate;
const signedSpend = (entry: LedgerEntry) => entry.isRefund ? -entry.cnyEquivalent : entry.cnyEquivalent;
const spend = (entry: LedgerEntry) => Math.max(0, signedSpend(entry));
const tripDays = (trip: Trip) => Math.max(1, Math.floor((getTripEndDate(trip) - getTripStartDate(trip)) / 86400000) + 1);
const activeMembers = (trip: Trip) => trip.members.filter((member) => member.archived !== true);
const isTripInYear = (trip: Trip, year: number) => {
  const start = getTripStartDate(trip);
  const end = getTripEndDate(trip);
  return Number.isFinite(start) && Number.isFinite(end)
    && end >= new Date(year, 0, 1).getTime()
    && start <= new Date(year, 11, 31, 23, 59, 59, 999).getTime();
};
const inYear = (entry: LedgerEntry, year: number) => new Date(entryDate(entry)).getFullYear() === year;

const Donut = ({ items }: { items: { label: string; value: number; color: string }[] }) => {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const radius = 43;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return <div className="logbook-donut-wrap">
    <svg className="logbook-donut" viewBox="0 0 108 108" role="img" aria-label="Spending distribution">
      <circle cx="54" cy="54" r={radius} fill="none" stroke="#e8dfce" strokeWidth="17" />
      {items.map((item) => {
        const length = total ? item.value / total * circumference : 0;
        const circle = <circle key={item.label} cx="54" cy="54" r={radius} fill="none" stroke={item.color} strokeWidth="17" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} transform="rotate(-90 54 54)" />;
        offset += length;
        return circle;
      })}
      <text x="54" y="50" textAnchor="middle" className="logbook-donut-total">{money(total).replace('.00','')}</text>
      <text x="54" y="63" textAnchor="middle" className="logbook-donut-label">Total</text>
    </svg>
  </div>;
};

const Bars = ({ items }: { items: { label: string; value: number }[] }) => {
  const max = Math.max(1, ...items.map((item) => item.value));
  return <div className="logbook-bars">{items.length ? items.map((item) => <div className="logbook-analysis-row" key={item.label}>
    <div className="logbook-analysis-row-head"><span>{item.label}</span><strong>{money(item.value)}</strong></div>
    <div className="logbook-analysis-track"><span style={{ width: `${Math.max(3, item.value / max * 100)}%` }} /></div>
  </div>) : <p className="logbook-empty-inline">No recorded spending for this period.</p>}</div>;
};

const YoYBars = ({ items }: { items: { label: string; current: number; previous: number; difference: number }[] }) => {
  const max = Math.max(1, ...items.flatMap((item) => [item.current, item.previous]));
  return <div className="logbook-bars">{items.length ? items.map((item) => <div className="logbook-analysis-row" key={item.label}>
    <div className="logbook-analysis-row-head">
      <span>{item.label}</span>
      <strong>{moneyCompact(item.difference)}</strong>
    </div>
    <div className="logbook-analysis-track"><span style={{ width: `${Math.max(3, item.current / max * 100)}%` }} /></div>
    <div className="logbook-analysis-track"><span style={{ width: `${Math.max(3, item.previous / max * 100)}%`, opacity: .38 }} /></div>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, letterSpacing: '.08em', color: '#858177', marginTop: 2 }}>
      <span>${item.current ? money(item.current) : '¥0.00'} ${new Date().getFullYear()}</span>
      <span>${item.previous ? money(item.previous) : '¥0.00'} prior</span>
    </div>
  </div>) : <p className="logbook-empty-inline">No allocated spending for these years.</p>}</div>;
};

const TypeBars = ({ items }: { items: { label: string; value: number }[] }) => <Bars items={items} />;

const classifyExpenseType = (trip: Trip, entry: LedgerEntry): 'Fixed' | 'Flexible' => {
  if (entry.entryType === 'flight') return 'Fixed';
  const category = trip.categories.find((item) => item.id === entry.categoryId)?.name?.toLowerCase() ?? '';
  return /(hotel|accommodation|lodging|flight|airfare|air ticket)/.test(category) ? 'Fixed' : 'Flexible';
};

const CompareBars = ({ items, sort, onSortChange }: {
  items: { label: string; total: number; daily: number; person: number; days: number }[];
  sort: CompareSort;
  onSortChange: (value: CompareSort) => void;
}) => {
  const metric = sort === 'daily' ? 'daily' : sort === 'person' ? 'person' : 'total';
  const sorted = [...items].sort((a, b) => b[metric] - a[metric]);
  const max = Math.max(1, ...sorted.map((item) => item[metric]));
  return <div className="logbook-bars">
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 3 }}>
      <select
        aria-label="Sort journeys"
        value={sort}
        onChange={(event) => onSortChange(event.target.value as CompareSort)}
        style={{ fontSize: 8, lineHeight: 1, border: 0, background: 'transparent', color: '#77766e', padding: 0 }}
      >
        <option value="total">Total Spend</option>
        <option value="daily">Daily Avg</option>
        <option value="person">Per Person</option>
      </select>
    </div>
    {sorted.length ? sorted.map((item) => <div className="logbook-analysis-row" key={item.label}>
      <div className="logbook-analysis-row-head">
        <span>{item.label}</span>
        <strong>{sort === 'daily' ? money(item.daily) : sort === 'person' ? money(item.person) : money(item.total)}</strong>
      </div>
      <div className="logbook-analysis-track"><span style={{ width: `${Math.max(3, item[metric] / max * 100)}%` }} /></div>
    </div>) : <p className="logbook-empty-inline">No journeys recorded for this year.</p>}
  </div>;
};

export default function LogbookAnalytics({ trips, activeTrip }: { trips: Trip[]; activeTrip: Trip | null }) {
  const [scope, setScope] = useState<Scope>('current');
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [view, setView] = useState<View>('category');
  const [chartMode, setChartMode] = useState<ChartMode>('donut');
  const [compareSort, setCompareSort] = useState<CompareSort>('total');

  const availableYears = useMemo(() => {
    const years = new Set<number>([new Date().getFullYear()]);
    trips.forEach((trip) => {
      [getTripStartDate(trip), getTripEndDate(trip), ...trip.ledger.map(entryDate)].forEach((value) => {
        const year = new Date(value).getFullYear();
        if (Number.isFinite(year)) years.add(year);
      });
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [trips]);

  const allYearTrips = useMemo(() => trips.filter((trip) => isTripInYear(trip, selectedYear)), [trips, selectedYear]);
  const currentRows = useMemo(() => activeTrip ? activeTrip.ledger.map((entry) => ({ trip: activeTrip, entry })) : [], [activeTrip]);
  const allRows = useMemo(() => trips.flatMap((trip) => trip.ledger.filter((entry) => inYear(entry, selectedYear)).map((entry) => ({ trip, entry }))), [trips, selectedYear]);
  const previousRows = useMemo(() => trips.flatMap((trip) => trip.ledger.filter((entry) => inYear(entry, selectedYear - 1)).map((entry) => ({ trip, entry }))), [trips, selectedYear]);

  const rows = scope === 'current' ? currentRows : allRows;

  const metrics = useMemo(() => {
    const total = rows.reduce((sum, { entry }) => sum + spend(entry), 0);
    if (scope === 'current') {
      const days = activeTrip ? tripDays(activeTrip) : 1;
      const people = activeTrip ? Math.max(1, activeMembers(activeTrip).length) : 1;
      return {
        first: total,
        firstLabel: 'TOTAL EXPENSE',
        second: total / days,
        secondLabel: 'DAILY AVG',
        third: total / people,
        thirdLabel: 'PER PERSON',
      };
    }
    const tripsTaken = allYearTrips.length;
    return {
      first: total,
      firstLabel: `${selectedYear} TOTAL`,
      second: tripsTaken,
      secondLabel: 'TRIPS TAKEN',
      third: tripsTaken ? total / tripsTaken : 0,
      thirdLabel: 'TRIP AVG',
    };
  }, [rows, scope, activeTrip, allYearTrips, selectedYear]);

  const category = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach(({ trip, entry }) => {
      const label = trip.categories.find((item) => item.id === entry.categoryId)?.name ?? entry.categoryId;
      map.set(label, (map.get(label) ?? 0) + spend(entry));
    });
    return Array.from(map.entries()).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value], i) => ({ label, value, color: COLORS[i % COLORS.length] }));
  }, [rows]);

  const account = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach(({ trip, entry }) => {
      const label = trip.accounts.find((item) => item.id === entry.accountId)?.name ?? 'Unknown account';
      map.set(label, (map.get(label) ?? 0) + spend(entry));
    });
    return Array.from(map.entries()).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value }));
  }, [rows]);

  const person = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach(({ trip, entry }) => {
      const allocations = entry.allocations.length ? entry.allocations : [{ memberId: entry.payerId, amount: spend(entry) }];
      allocations.forEach((allocation) => {
        const member = trip.members.find((item) => item.id === allocation.memberId);
        const label = member?.name ?? 'Unknown person';
        const value = entry.isRefund ? -allocation.amount : allocation.amount;
        map.set(label, (map.get(label) ?? 0) + value);
      });
    });
    return Array.from(map.entries()).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value }));
  }, [rows]);

  const previousPerson = useMemo(() => {
    const map = new Map<string, number>();
    previousRows.forEach(({ trip, entry }) => {
      const allocations = entry.allocations.length ? entry.allocations : [{ memberId: entry.payerId, amount: spend(entry) }];
      allocations.forEach((allocation) => {
        const member = trip.members.find((item) => item.id === allocation.memberId);
        const label = member?.name ?? 'Unknown person';
        const value = entry.isRefund ? -allocation.amount : allocation.amount;
        map.set(label, (map.get(label) ?? 0) + value);
      });
    });
    return map;
  }, [previousRows]);

  const yoyPerson = useMemo(() => {
    const current = new Map(person.map((item) => [item.label, item.value]));
    const labels = new Set([...current.keys(), ...previousPerson.keys()]);
    return Array.from(labels).map((label) => {
      const currentValue = current.get(label) ?? 0;
      const previousValue = previousPerson.get(label) ?? 0;
      return { label, current: currentValue, previous: previousValue, difference: currentValue - previousValue };
    }).sort((a, b) => b.current - a.current).slice(0, 8);
  }, [person, previousPerson]);

  const type = useMemo(() => {
    const map = new Map<'Fixed' | 'Flexible', number>([['Fixed', 0], ['Flexible', 0]]);
    rows.forEach(({ trip, entry }) => {
      const key = classifyExpenseType(trip, entry);
      map.set(key, (map.get(key) ?? 0) + spend(entry));
    });
    return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
  }, [rows]);

  const compare = useMemo(() => allYearTrips.map((trip) => {
    const total = trip.ledger.filter((entry) => inYear(entry, selectedYear)).reduce((sum, entry) => sum + spend(entry), 0);
    const days = tripDays(trip);
    const people = Math.max(1, activeMembers(trip).length);
    return { label: trip.title || 'Untitled journey', total, daily: total / days, person: total / people, days };
  }), [allYearTrips, selectedYear]);

  const active = view === 'category' ? category : view === 'account' ? account : person;
  const labels: View[] = scope === 'current' ? ['category', 'account', 'person', 'type'] : ['category', 'account', 'person', 'compare'];
  const labelForView = (item: View) => item[0].toUpperCase() + item.slice(1);

  return <section className="logbook-analytics">
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
      <div className="logbook-time-toggle" role="group" aria-label="Journey scope" style={{ flex: 1, marginBottom: 0 }}>
        {(['current', 'all'] as Scope[]).map((item) => <button key={item} type="button" className={scope === item ? 'active' : ''} onClick={() => setScope(item)}>{item === 'current' ? 'Current Trip' : 'All Trips'}</button>)}
      </div>
      {scope === 'all' && <select aria-label="Year" value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))} style={{ width: 54, height: 25, border: 0, borderRadius: 13, background: '#e9e9ea', color: '#1d2a40', fontSize: 9, textAlign: 'center', padding: 0 }}>
        {availableYears.map((year) => <option key={year} value={year}>{year}</option>)}
      </select>}
    </div>

    <div className="logbook-flow-grid">
      {[{ value: metrics.first, label: metrics.firstLabel }, { value: metrics.second, label: metrics.secondLabel }, { value: metrics.third, label: metrics.thirdLabel }].map((metric) => <article key={metric.label}><span>{metric.label}</span><strong>{typeof metric.value === 'number' && metric.label === 'TRIPS TAKEN' ? Math.round(metric.value).toString() : money(metric.value)}</strong></article>)}
    </div>

    <div className="logbook-view-toggle" role="group" aria-label="Breakdown">
      {labels.map((item) => <button key={item} type="button" className={view === item ? 'active' : ''} onClick={() => setView(item)}>{labelForView(item)}</button>)}
    </div>

    <div className={`logbook-visual-card ${view === 'category' && chartMode === 'donut' ? 'is-category' : ''}`}>
      <div className="logbook-visual-inner">
        <div className="logbook-visual-heading">
          <div>
            <span className="logbook-overline">WHERE THE JOURNEY WENT</span>
            <h3>{view === 'category' ? 'Spending by category' : view === 'account' ? 'Spending by account' : view === 'person' ? 'Spending by person' : view === 'type' ? 'Spending by type' : 'Compare journeys'}</h3>
          </div>
          {view === 'category' && <button type="button" className="logbook-chart-toggle" onClick={() => setChartMode(chartMode === 'donut' ? 'bars' : 'donut')} aria-label="Toggle category chart">{chartMode === 'donut' ? <BarChart3 size={15} /> : <PieChart size={15} />}</button>}
        </div>

        {view === 'category' && chartMode === 'donut'
          ? <div className="logbook-donut-layout"><Donut items={category} /><div className="logbook-legend">{category.length ? category.map((item) => <div key={item.label}><i style={{ background: item.color }} /><span>{item.label}</span><strong>{money(item.value)}</strong></div>) : <p className="logbook-empty-inline">No recorded spending for this period.</p>}</div></div>
          : view === 'person' && scope === 'all'
            ? <YoYBars items={yoyPerson} />
            : view === 'compare' && scope === 'all'
              ? <CompareBars items={compare} sort={compareSort} onSortChange={setCompareSort} />
              : view === 'type'
                ? <TypeBars items={type} />
                : <Bars items={active} />}
      </div>
    </div>
  </section>;
}
