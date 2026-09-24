import { useMemo, useState } from 'react';
import { LedgerEntry, Trip } from '../../core/domain';
import { findSegmentByDate, getTripEndDate, getTripStartDate } from '../../core/travelSegment';

type Breakdown = 'category' | 'segment' | 'account' | 'person';
const COLORS = ['#a9874b','#718a72','#5f6f82','#ad8250','#8e8476','#6f665a','#a79a87','#9c7b48'];
const money = (n:number) => '¥' + new Intl.NumberFormat(undefined,{maximumFractionDigits:0}).format(Math.abs(n));
const dateOf = (e:LedgerEntry) => e.entryType === 'flight' ? e.outboundDate : e.paymentDate;
const spend = (e:LedgerEntry) => e.isRefund ? -e.cnyEquivalent : e.cnyEquivalent;
const countsInStats=(_t:Trip,e:LedgerEntry)=>e.includeInCost&&!e.isPending;
const Chart = ({items,mode,onToggle}:{items:{label:string;value:number;color?:string}[];mode:'donut'|'bar';onToggle:()=>void}) => {
 const total=items.reduce((s,i)=>s+i.value,0), r=43, circ=2*Math.PI*r; let o=0;
 return <button type="button" className="logbook-chart-switcher" onClick={onToggle} aria-label="Toggle chart type">
   {mode==='donut' ? <svg className="logbook-donut" viewBox="0 0 108 108" role="img" aria-label="Spending donut chart"><circle cx="54" cy="54" r={r} fill="none" stroke="#e8dfce" strokeWidth="17"/>{items.map(i=>{const l=total?i.value/total*circ:0;const el=<circle key={i.label} cx="54" cy="54" r={r} fill="none" stroke={i.color||'#a9874b'} strokeWidth="17" strokeDasharray={l+" "+(circ-l)} strokeDashoffset={-o} transform="rotate(-90 54 54)"/>;o+=l;return el;})}<text x="54" y="50" textAnchor="middle" className="logbook-donut-total">{money(total)}</text><text x="54" y="63" textAnchor="middle" className="logbook-donut-label">TOTAL</text></svg>
   : <div className="logbook-bar-chart">{items.map((i,idx)=><div className="logbook-bar-item" key={i.label}><span className="logbook-bar-value">{money(i.value)}</span><div className="logbook-bar-column"><i style={{height:(total?Math.max(8,i.value/Math.max(...items.map(x=>x.value))*100):0)+'%',background:i.color||COLORS[idx%COLORS.length]}}/></div></div>)}</div>}
 </button>;
};
export default function LogbookAnalytics({trip}:{trip:Trip|null}){
 const [view,setView]=useState<Breakdown>('category');
 const [chartMode,setChartMode]=useState<'donut'|'bar'>('donut');
 const [selectedLabel,setSelectedLabel]=useState<string|null>(null);
 const rows=useMemo(()=>trip?trip.ledger.filter(e=>countsInStats(trip,e)):[],[trip]);
 const category=useMemo(()=>{const m=new Map<string,number>();rows.forEach(e=>{const n=trip?.categories.find(c=>c.id===e.categoryId)?.name??'Uncategorized';m.set(n,(m.get(n)??0)+spend(e));});return [...m].filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,7).map(([label,value],i)=>({label,value,color:COLORS[i%COLORS.length]}));},[rows,trip]);
 const segment=useMemo(()=>{const m=new Map<string,number>();rows.forEach(e=>{const s=trip?findSegmentByDate(trip.segments,dateOf(e)):undefined;const label=s?.destinations.map(d=>d.city||d.country).filter(Boolean).join(' · ')||s?.primaryCurrency||'Unassigned';m.set(label,(m.get(label)??0)+spend(e));});return [...m].filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([label,value],i)=>({label,value,color:COLORS[i%COLORS.length]}));},[rows,trip]);
 const account=useMemo(()=>{const m=new Map<string,number>();rows.forEach(e=>{const n=trip?.accounts.find(a=>a.id===e.accountId)?.name??'Unknown account';m.set(n,(m.get(n)??0)+spend(e));});return [...m].filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,7).map(([label,value],i)=>({label,value,color:COLORS[i%COLORS.length]}));},[rows,trip]);
 const person=useMemo(()=>{const m=new Map<string,number>();rows.forEach(e=>{const allocations=e.allocations.length?e.allocations:[{memberId:e.payerId,amount:spend(e)}];allocations.forEach(x=>{const n=trip?.members.find(p=>p.id===x.memberId)?.name??'Unknown';m.set(n,(m.get(n)??0)+(e.isRefund?-x.amount:x.amount));});});return [...m].filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([label,value],i)=>({label,value,color:COLORS[i%COLORS.length]}));},[rows,trip]);
 const items=view==='category'?category:view==='segment'?segment:view==='account'?account:person;
 const title=view==='category'?'Spending by category':view==='segment'?'Spending by destination':view==='account'?'Spending by account':'Allocated cost by person';
 const tabs:[Breakdown,string][]=[['category','Category'],['segment','Journey'],['account','Account'],['person','Person']];
 const selected=items.find(i=>i.label===selectedLabel);
 const detailRows=useMemo(()=>rows.filter(e=>{
   if(!selectedLabel) return false;
   if(view==='category') return (trip?.categories.find(c=>c.id===e.categoryId)?.name??'Uncategorized')===selectedLabel;
   if(view==='segment'){const s=trip?findSegmentByDate(trip.segments,dateOf(e)):undefined;return (s?.destinations.map(d=>d.city||d.country).filter(Boolean).join(' · ')||s?.primaryCurrency||'Unassigned')===selectedLabel;}
   if(view==='account') return (trip?.accounts.find(a=>a.id===e.accountId)?.name??'Unknown account')===selectedLabel;
   const memberId=trip?.members.find(p=>p.name===selectedLabel)?.id;
   return !!memberId && e.allocations.some(a=>a.memberId===memberId && a.amount>0);
 }),[rows,trip,view,selectedLabel]);
 return <section className="logbook-analytics"><div className="logbook-analytics-heading"><span className="logbook-overline">WHERE THE JOURNEY WENT</span><h2>How this journey was spent</h2></div><div className="logbook-view-toggle">{tabs.map(([id,label])=><button key={id} type="button" className={view===id?'active':''} onClick={()=>{setView(id);setSelectedLabel(null)}}>{label}</button>)}</div><div className="logbook-visual-card"><div className="logbook-visual-inner"><div className="logbook-visual-heading"><div><span className="logbook-overline">{view==='segment'?'WHERE THE JOURNEY WENT':'WHERE THE MONEY WENT'}</span><h3>{title}</h3></div></div><div className="logbook-donut-layout"><div className="logbook-chart-area"><Chart items={items} mode={chartMode} onToggle={()=>setChartMode(m=>m==='donut'?'bar':'donut')}/><span className="logbook-chart-hint">Tap chart to switch</span></div><div className="logbook-legend">{items.length?items.map(i=><div key={i.label} className={selectedLabel===i.label?'selected':''} onClick={()=>setSelectedLabel(selectedLabel===i.label?null:i.label)}><i style={{background:i.color||'#a9874b'}}/><span>{i.label}</span><strong>{money(i.value)}</strong></div>):<p className="logbook-empty-inline">No recorded spending.</p>}</div></div></div></div>{selectedLabel&&<div className="logbook-selected-detail"><div className="logbook-selected-detail-heading"><span>{selectedLabel}</span><strong>{selected?money(selected.value):''}</strong></div><div className="logbook-detail-list">{detailRows.map((e,idx)=>{const categoryName=trip?.categories.find(c=>c.id===e.categoryId)?.name??'Uncategorized';const detailAmount=view==='person'?((e.allocations.find(a=>trip?.members.find(p=>p.id===a.memberId)?.name===selectedLabel)?.amount)??(e.payerId===trip?.members.find(p=>p.name===selectedLabel)?.id?spend(e):0)):e.cnyEquivalent;return <div key={e.id??idx}><span>{new Date(dateOf(e)).toLocaleDateString(undefined,{month:'short',day:'numeric'})} · {categoryName}</span><b>{money(detailAmount)}</b></div>;})}</div></div>}</section>;
}
