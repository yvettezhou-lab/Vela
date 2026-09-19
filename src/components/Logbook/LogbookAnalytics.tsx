import { useMemo, useState } from 'react';
import { LedgerEntry, Trip } from '../../core/domain';
import { getSegmentByDate, getTripEndDate, getTripStartDate } from '../../core/travelSegment';

type Breakdown = 'category' | 'segment' | 'account' | 'person';
const COLORS = ['#a9874b','#718a72','#5f6f82','#ad8250','#8e8476','#6f665a','#a79a87','#9c7b48'];
const money = (n:number) => '¥' + new Intl.NumberFormat(undefined,{maximumFractionDigits:0}).format(Math.abs(n));
const dateOf = (e:LedgerEntry) => e.entryType === 'flight' ? e.outboundDate : e.paymentDate;
const spend = (e:LedgerEntry) => e.isRefund ? -e.cnyEquivalent : e.cnyEquivalent;
const Donut = ({items}:{items:{label:string;value:number;color:string}[]}) => {
 const total=items.reduce((s,i)=>s+i.value,0), r=43, c=2*Math.PI*r; let o=0;
 return <div className="logbook-donut-layout"><div className="logbook-donut-wrap"><svg className="logbook-donut" viewBox="0 0 108 108" role="img" aria-label="Spending by category"><circle cx="54" cy="54" r={r} fill="none" stroke="#e8dfce" strokeWidth="17"/>{items.map(i=>{const l=total?i.value/total*c:0;const el=<circle key={i.label} cx="54" cy="54" r={r} fill="none" stroke={i.color} strokeWidth="17" strokeDasharray={l+" "+(c-l)} strokeDashoffset={-o} transform="rotate(-90 54 54)"/>;o+=l;return el;})}<text x="54" y="50" textAnchor="middle" className="logbook-donut-total">{money(total)}</text><text x="54" y="63" textAnchor="middle" className="logbook-donut-label">TOTAL</text></svg></div><div className="logbook-legend">{items.length?items.map(i=><div key={i.label}><i style={{background:i.color}}/><span>{i.label}</span><strong>{money(i.value)}</strong></div>):<p className="logbook-empty-inline">No recorded spending.</p>}</div></div>;
};
const Bars = ({items}:{items:{label:string;value:number}[]}) => {const max=Math.max(1,...items.map(i=>i.value));return <div className="logbook-bars">{items.length?items.map(i=><div className="logbook-analysis-row" key={i.label}><div className="logbook-analysis-row-head"><span>{i.label}</span><strong>{money(i.value)}</strong></div><div className="logbook-analysis-track"><span style={{width:Math.max(3,i.value/max*100)+'%'}}/></div></div>):<p className="logbook-empty-inline">No recorded spending.</p>}</div>};
export default function LogbookAnalytics({trip}:{trip:Trip|null}){
 const [view,setView]=useState<Breakdown>('category');
 const rows=useMemo(()=>trip?trip.ledger.filter(e=>!e.isPending):[],[trip]);
 const category=useMemo(()=>{const m=new Map<string,number>();rows.forEach(e=>{const n=trip?.categories.find(c=>c.id===e.categoryId)?.name??'Uncategorized';m.set(n,(m.get(n)??0)+spend(e));});return [...m].filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,7).map(([label,value],i)=>({label,value,color:COLORS[i%COLORS.length]}));},[rows,trip]);
 const segment=useMemo(()=>{const m=new Map<string,number>();rows.forEach(e=>{const s=trip?getSegmentByDate(trip.segments,dateOf(e)):undefined;const label=s?.destinations.map(d=>d.city||d.country).filter(Boolean).join(' · ')||s?.primaryCurrency||'Unassigned';m.set(label,(m.get(label)??0)+spend(e));});return [...m].filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([label,value])=>({label,value}));},[rows,trip]);
 const account=useMemo(()=>{const m=new Map<string,number>();rows.forEach(e=>{const n=trip?.accounts.find(a=>a.id===e.accountId)?.name??'Unknown account';m.set(n,(m.get(n)??0)+spend(e));});return [...m].filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,7).map(([label,value])=>({label,value}));},[rows,trip]);
 const person=useMemo(()=>{const m=new Map<string,number>();rows.forEach(e=>{const allocations=e.allocations.length?e.allocations:[{memberId:e.payerId,amount:spend(e)}];allocations.forEach(x=>{const n=trip?.members.find(p=>p.id===x.memberId)?.name??'Unknown';m.set(n,(m.get(n)??0)+(e.isRefund?-x.amount:x.amount));});});return [...m].filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([label,value])=>({label,value}));},[rows,trip]);
 const items=view==='category'?category:view==='segment'?segment:view==='account'?account:person;
 const title=view==='category'?'Spending by category':view==='segment'?'Spending by destination':view==='account'?'Spending by account':'Allocated cost by person';
 const tabs:[Breakdown,string][]=[['category','Category'],['segment','Journey'],['account','Account'],['person','Person']];
 return <section className="logbook-analytics"><div className="logbook-analytics-heading"><span className="logbook-overline">WHERE THE JOURNEY WENT</span><h2>How this journey was spent</h2></div><div className="logbook-view-toggle">{tabs.map(([id,label])=><button key={id} type="button" className={view===id?'active':''} onClick={()=>setView(id)}>{label}</button>)}</div><div className="logbook-visual-card"><div className="logbook-visual-inner"><div className="logbook-visual-heading"><div><span className="logbook-overline">{view==='segment'?'WHERE THE JOURNEY WENT':'WHERE THE MONEY WENT'}</span><h3>{title}</h3></div></div>{view==='category'?<Donut items={category}/>:<Bars items={items}/>}</div></div></section>;
}
