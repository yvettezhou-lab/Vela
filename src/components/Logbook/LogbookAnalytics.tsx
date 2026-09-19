import { useMemo, useState } from 'react';
import { BarChart3, Grid2X2, PieChart, TrendingUp } from 'lucide-react';
import { LedgerEntry, Trip } from '../../core/domain';

type Period = 'month' | 'year';
type View = 'category' | 'account' | 'person' | 'trend';
type ChartMode = 'donut' | 'bars';

const COLORS = ['#365a5b', '#9b7a4c', '#718783', '#c3a77a', '#526b6d', '#a8b0a5', '#7e6750', '#b6a28a'];
const money = (n: number) => `¥${new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
const entryDate = (entry: LedgerEntry) => entry.entryType === 'flight' ? entry.outboundDate : entry.paymentDate;
const signed = (entry: LedgerEntry) => entry.isRefund ? -entry.cnyEquivalent : entry.cnyEquivalent;

const Donut = ({ items }: { items: { label: string; value: number; color: string }[] }) => {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return <svg className="logbook-donut" viewBox="0 0 150 150" role="img" aria-label="Spending distribution">
    <circle cx="75" cy="75" r={radius} fill="none" stroke="#e7e0d4" strokeWidth="20" />
    {items.map((item) => {
      const length = total ? item.value / total * circumference : 0;
      const circle = <circle key={item.label} cx="75" cy="75" r={radius} fill="none" stroke={item.color} strokeWidth="20" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} transform="rotate(-90 75 75)" />;
      offset += length;
      return circle;
    })}
    <text x="75" y="70" textAnchor="middle" className="logbook-donut-total">{money(total)}</text>
    <text x="75" y="87" textAnchor="middle" className="logbook-donut-label">TOTAL SPEND</text>
  </svg>;
};

const Bars = ({ items }: { items: { label: string; value: number }[] }) => {
  const max = Math.max(1, ...items.map((item) => item.value));
  return <div className="logbook-bars">{items.length ? items.map((item) => <div className="logbook-analysis-row" key={item.label}>
    <div className="logbook-analysis-row-head"><span>{item.label}</span><strong>{money(item.value)}</strong></div>
    <div className="logbook-analysis-track"><span style={{ width: `${Math.max(4, item.value / max * 100)}%` }} /></div>
  </div>) : <p className="logbook-empty-inline">No recorded spending for this period.</p>}</div>;
};

const Trend = ({ values }: { values: { label: string; value: number }[] }) => {
  const max = Math.max(1, ...values.map((item) => item.value));
  return <div className="logbook-trend-chart">{values.map((item) => <div className="logbook-trend-column" key={item.label}>
    <span style={{ height: `${Math.max(4, item.value / max * 100)}%` }} title={money(item.value)} />
    <small>{item.label}</small>
  </div>)}</div>;
};

export default function LogbookAnalytics({ trips }: { trips: Trip[] }) {
  const [period, setPeriod] = useState<Period>('year');
  const [view, setView] = useState<View>('category');
  const [chartMode, setChartMode] = useState<ChartMode>('donut');
  const now = new Date();

  const rows = useMemo(() => trips.flatMap((trip) => trip.ledger.map((entry) => ({ trip, entry }))).filter(({ entry }) => {
    const d = new Date(entryDate(entry));
    return period === 'year'
      ? d.getFullYear() === now.getFullYear()
      : d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }), [trips, period, now]);

  const metrics = useMemo(() => {
    let expense = 0;
    let refunds = 0;
    rows.forEach(({ entry }) => {
      const value = signed(entry);
      if (value >= 0) expense += value;
      else refunds += -value;
    });
    expense = Math.max(0, expense - refunds);
    return { income: 0, expense, net: -expense };
  }, [rows]);

  const category = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach(({ trip, entry }) => {
      const label = trip.categories.find((item) => item.id === entry.categoryId)?.name ?? entry.categoryId;
      map.set(label, (map.get(label) ?? 0) + Math.max(0, signed(entry)));
    });
    return Array.from(map.entries()).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value], i) => ({ label, value, color: COLORS[i % COLORS.length] }));
  }, [rows]);

  const account = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach(({ trip, entry }) => {
      const label = trip.accounts.find((item) => item.id === entry.accountId)?.name ?? 'Unknown account';
      map.set(label, (map.get(label) ?? 0) + Math.max(0, signed(entry)));
    });
    return Array.from(map.entries()).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value }));
  }, [rows]);

  const person = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach(({ trip, entry }) => {
      const label = trip.members.find((item) => item.id === entry.payerId)?.name ?? 'Unknown person';
      map.set(label, (map.get(label) ?? 0) + Math.max(0, signed(entry)));
    });
    return Array.from(map.entries()).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value }));
  }, [rows]);

  const trend = useMemo(() => {
    const length = period === 'year' ? 12 : 31;
    const result = Array.from({ length }, (_, index) => ({ label: period === 'year' ? new Date(now.getFullYear(), index, 1).toLocaleDateString(undefined, { month: 'short' }) : String(index + 1), value: 0 }));
    rows.forEach(({ entry }) => {
      const d = new Date(entryDate(entry));
      const index = period === 'year' ? d.getMonth() : d.getDate() - 1;
      if (result[index]) result[index].value += Math.max(0, signed(entry));
    });
    return result;
  }, [rows, period, now]);

  const active = view === 'category' ? category : view === 'account' ? account : person;

  return <section className="logbook-analytics">
    <div className="logbook-analytics-top">
      <div><span className="logbook-overline">WHERE YOUR LIFE FLOWS</span><h2>Money in motion</h2></div>
      <div className="logbook-pill-group" role="group" aria-label="Time range">
        {(['month', 'year'] as Period[]).map((item) => <button key={item} type="button" className={period === item ? 'active' : ''} onClick={() => setPeriod(item)}>{item === 'month' ? 'Month' : 'Year'}</button>)}
      </div>
    </div>
    <div className="logbook-flow-grid">
      <article><span>INCOME</span><strong>{money(metrics.income)}</strong><small>Recorded inflow</small></article>
      <article><span>EXPENSE</span><strong>{money(metrics.expense)}</strong><small>Net of refunds</small></article>
      <article><span>NET FLOW</span><strong className="negative">{money(metrics.net)}</strong><small>Income − expense</small></article>
    </div>
    <div className="logbook-analytics-toolbar">
      <div className="logbook-pill-group" role="group" aria-label="Breakdown">
        {(['category', 'account', 'person', 'trend'] as View[]).map((item) => <button key={item} type="button" className={view === item ? 'active' : ''} onClick={() => setView(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}
      </div>
      {view !== 'trend' && <button type="button" className="logbook-chart-toggle" aria-label="Toggle chart" onClick={() => setChartMode(chartMode === 'donut' ? 'bars' : 'donut')}>{chartMode === 'donut' ? <BarChart3 size={17} /> : <PieChart size={17} />}</button>}
    </div>
    <div className="logbook-visual-card">
      {view === 'trend' ? <div><div className="logbook-visual-heading"><div><span className="logbook-overline">SPENDING TREND</span><h3>{period === 'year' ? 'Monthly flow' : 'Daily flow'}</h3></div><TrendingUp size={18} /></div><Trend values={trend} /></div>
        : view === 'category' && chartMode === 'donut' ? <div className="logbook-donut-layout"><Donut items={category} /><div className="logbook-legend">{category.length ? category.map((item) => <div key={item.label}><i style={{ background: item.color }} /><span>{item.label}</span><strong>{money(item.value)}</strong></div>) : <p className="logbook-empty-inline">No recorded spending for this period.</p>}</div></div>
        : <div><div className="logbook-visual-heading"><div><span className="logbook-overline">SPENDING BY {view.toUpperCase()}</span><h3>{view === 'category' ? 'Category rhythm' : view === 'account' ? 'Account rhythm' : 'Person rhythm'}</h3></div><Grid2X2 size={17} /></div><Bars items={active} /></div>}
    </div>
  </section>;
}
