import { useMemo, useState } from 'react';
import { getTripDestinations, getTripEndDate, getTripStartDate } from '../../core/travelSegment';
import { AnnualReflection, LedgerEntry, Trip } from '../../types/logbook';
import { useTripCover } from '../../hooks/useTripCover';
import LogbookAnalytics from './LogbookAnalytics';
interface Props { annualReflection: AnnualReflection; activeTrip: Trip|null; reflectionTrips: Trip[]; }
const num=(v:number)=>new Intl.NumberFormat(undefined,{maximumFractionDigits:0}).format(v);
const date=(v:number)=>new Date(v).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
const entryDate=(e:LedgerEntry)=>e.entryType==='flight'?e.outboundDate:e.paymentDate;
const signed=(e:LedgerEntry)=>e.isRefund?-e.cnyEquivalent:e.cnyEquivalent;
const countsInStats=(_t:Trip,e:LedgerEntry)=>e.includeInCost&&!e.isPending;
const days=(t:Trip)=>Math.max(1,Math.floor((getTripEndDate(t)-getTripStartDate(t))/86400000)+1);
export const LogbookView=({annualReflection,activeTrip,reflectionTrips}:Props)=>{
 const defaultTripId=activeTrip?.id??reflectionTrips.find(t=>t.status==='achieve')?.id??reflectionTrips.find(t=>t.status==='planning')?.id??reflectionTrips[0]?.id??null;
 const [selectedTripId,setSelectedTripId]=useState<string|null>(defaultTripId);
 const selectedTrip=useMemo(()=>reflectionTrips.find(t=>t.id===selectedTripId)??null,[reflectionTrips,selectedTripId]);
 const coverSrc=useTripCover(selectedTrip?.coverImage);
 const total=selectedTrip?selectedTrip.ledger.filter(e=>countsInStats(selectedTrip,e)).reduce((s,e)=>s+signed(e),0):0;
 const people=selectedTrip?.members.filter(m=>m.archived!==true).length??0;
 const segmentCount=selectedTrip?.segments.length??0;
 return <main className="logbook-page">
  <header className="logbook-header"><div><p className="logbook-kicker">LOGBOOK / {annualReflection.year}</p><h1>Logbook</h1><p className="logbook-subtitle">A financial record of where the journey took you.</p></div></header>
  <section className="logbook-journey-card"><div className="logbook-journey-cover">{coverSrc?<img src={coverSrc} alt="" />:<span>✦</span>}</div><div><span className="logbook-overline">THIS JOURNEY</span><h2>{selectedTrip?.title||'Choose a journey'}</h2>{selectedTrip&&<small>{date(getTripStartDate(selectedTrip))} — {date(getTripEndDate(selectedTrip))} · {days(selectedTrip)} days · {people} travelers</small>}</div><div className="logbook-journey-selector"><select aria-label="Select journey" value={selectedTrip?.id??''} onChange={e=>setSelectedTripId(e.target.value)}>{reflectionTrips.map((t,i)=><option key={t.id} value={t.id}>{t.title||getTripDestinations(t).join(' · ')||'Untitled journey'}</option>)}</select></div></section>
  {selectedTrip&&<section className="logbook-section logbook-glance"><div className="logbook-section-heading"><div><span className="logbook-overline">THE JOURNEY AT A GLANCE</span><h2>One trip, clearly seen.</h2></div></div><div className="logbook-glance-grid"><article><span>TOTAL EXPENSE</span><strong>¥{num(total)}</strong></article><article><span>DAILY AVG</span><strong>¥{num(total/days(selectedTrip))}</strong></article><article><span>PER PERSON</span><strong>¥{num(total/Math.max(1,people))}</strong></article><article><span>PER PERSON / DAY</span><strong>¥{num(total/Math.max(1,people)/days(selectedTrip))}</strong></article></div><div className="logbook-facts">{days(selectedTrip)} DAYS · {segmentCount} SEGMENTS · {people} PEOPLE</div></section>}
  <LogbookAnalytics trip={selectedTrip}/>

  <section className="logbook-note"><div className="logbook-note-kicker">A note from this journey</div><div className="logbook-note-copy">{selectedTrip?days(selectedTrip)+' days across '+segmentCount+' segments, with '+selectedTrip.ledger.filter(e=>!e.isPending).length+' recorded expenses.':'Complete a journey to begin your reflection.'}</div></section>

 </main>;
};
export default LogbookView;