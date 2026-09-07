import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Home, BookOpen, Scale, Compass, Settings, Plus, ChevronRight, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import './styles.css';
import { CATEGORIES, type AllocationMode, type Category, type LedgerEntry, type Plan, loadPlan, makeAllocations, savePlan, isPending, allocationFinal } from './domain';

type Tab = 'Home' | 'Ledger' | 'Balance' | 'Reflection' | 'Atelier';
const nav: { label: Tab; icon: typeof Home }[] = [
  { label: 'Home', icon: Home }, { label: 'Ledger', icon: BookOpen }, { label: 'Balance', icon: Scale }, { label: 'Reflection', icon: Compass }, { label: 'Atelier', icon: Settings },
];
const money = (n: number, c: string) => `${c} ${n.toFixed(2)}`;

function App() {
  const [plan, setPlan] = useState<Plan>(() => loadPlan());
  const [tab, setTab] = useState<Tab>('Home');
  const [quick, setQuick] = useState(false);
  const [showPending, setShowPending] = useState(false);
  const update = (next: Plan) => { setPlan(next); savePlan(next); };

  const balances = useMemo(() => {
    const settled = plan.ledger.filter(e => !isPending(e, plan.settlementCurrency));
    const paid = new Map<string, number>(); const borne = new Map<string, number>();
    plan.members.forEach(m => { paid.set(m.id, 0); borne.set(m.id, 0); });
    settled.forEach(e => {
      paid.set(e.payerId, (paid.get(e.payerId) || 0) + (e.finalAmount || 0));
      e.allocations.forEach(a => borne.set(a.memberId, (borne.get(a.memberId) || 0) + (allocationFinal(e, a) || 0)));
    });
    return plan.members.map(m => ({ ...m, net: +( (paid.get(m.id) || 0) - (borne.get(m.id) || 0)).toFixed(2) }));
  }, [plan]);

  const pendingCount = plan.ledger.filter(e => isPending(e, plan.settlementCurrency)).length;
  const transfers = useMemo(() => {
    const creditors = balances.filter(x => x.net > .005).map(x => ({...x}));
    const debtors = balances.filter(x => x.net < -.005).map(x => ({...x}));
    const result: {from:string;to:string;amount:number}[] = [];
    let i=0,j=0;
    while(i<debtors.length && j<creditors.length){ const amount=+Math.min(-debtors[i].net,creditors[j].net).toFixed(2); result.push({from:debtors[i].name,to:creditors[j].name,amount}); debtors[i].net=+(debtors[i].net+amount).toFixed(2); creditors[j].net=+(creditors[j].net-amount).toFixed(2); if(Math.abs(debtors[i].net)<.005)i++; if(Math.abs(creditors[j].net)<.005)j++; }
    return result;
  }, [balances]);

  function addEntry(input: Omit<LedgerEntry,'id'|'allocations'> & { memberIds:string[] }) {
    const {memberIds, ...entry} = input;
    const next: LedgerEntry = { ...entry, id: crypto.randomUUID(), allocations: makeAllocations(entry.amount, memberIds, plan.members, entry.allocationMode) };
    update({...plan, ledger:[next,...plan.ledger]}); setQuick(false); setTab('Ledger');
  }

  const content = tab === 'Home' ? <HomePage plan={plan} onQuick={() => setQuick(true)} onPlan={() => setTab('Atelier')} />
    : tab === 'Ledger' ? <LedgerPage plan={plan} />
    : tab === 'Balance' ? <BalancePage plan={plan} balances={balances} transfers={transfers} pendingCount={pendingCount} showPending={showPending} setShowPending={setShowPending} />
    : tab === 'Reflection' ? <ReflectionPage plan={plan} />
    : <AtelierPage plan={plan} update={update} />;
  return <div className="app">{quick ? <QuickEntry plan={plan} onSave={addEntry} onClose={() => setQuick(false)} /> : content}<nav className="bottom-nav">{nav.map(({label,icon:Icon})=><button key={label} className={tab===label&&!quick?'active':''} onClick={()=>{setQuick(false);setTab(label)}}><Icon size={19} strokeWidth={1.65}/><span>{label}</span></button>)}</nav></div>;
}

function HomePage({plan,onQuick,onPlan}:{plan:Plan;onQuick:()=>void;onPlan:()=>void}) { return <main className="page"><header className="topbar"><div><span className="eyebrow">CURRENT PLAN</span><h1>{plan.name}</h1></div><button className="quiet" onClick={onPlan}>Plan</button></header><section className="hero"><span className="eyebrow">{plan.status.toUpperCase()}</span><h2>{plan.destinations.length?plan.destinations.join(' · '):'Ready for the next journey.'}</h2><p>{plan.ledger.length ? `${plan.ledger.length} real payment${plan.ledger.length===1?'':'s'} recorded.` : 'Create a Plan to bring payments, allocations and settlement into one place.'}</p><button className="primary" onClick={onQuick}><Plus size={17}/> Quick Entry</button></section><section className="section"><div className="section-head"><h3>Recent Ledger</h3><ChevronRight size={17}/></div>{plan.ledger.slice(0,5).map(e=><div className="ledger-row" key={e.id}><div><strong>{e.description}</strong><small>{e.category} · {plan.members.find(m=>m.id===e.payerId)?.name || '—'}</small></div><span>{money(e.amount,e.currency)}</span></div>)}{!plan.ledger.length&&<div className="empty"><BookOpen size={22}/><span>No payments yet.</span></div>}</section></main> }

function LedgerPage({plan}:{plan:Plan}) { return <main className="page"><header className="topbar"><div><span className="eyebrow">TRIP RECORD</span><h1>Ledger</h1></div></header><section className="section ledger-list">{plan.ledger.map(e=><article className="ledger-card" key={e.id}><div><strong>{e.description}</strong><small>{e.usageDate || e.date} · {e.category} · {plan.members.find(m=>m.id===e.payerId)?.name}</small></div><div className="ledger-right"><b>{money(e.amount,e.currency)}</b><small>{isPending(e,plan.settlementCurrency)?'Pending':money(e.finalAmount!,e.finalCurrency!)}</small></div></article>)}{!plan.ledger.length&&<div className="empty large"><BookOpen size={25}/><span>Your real payments will live here.</span></div>}</section></main> }

function BalancePage({plan,balances,transfers,pendingCount,showPending,setShowPending}:{plan:Plan;balances:{id:string;name:string;net:number}[];transfers:{from:string;to:string;amount:number}[];pendingCount:number;showPending:boolean;setShowPending:(v:boolean)=>void}) { return <main className="page"><header className="topbar"><div><span className="eyebrow">SETTLEMENT</span><h1>Balance</h1></div></header>{pendingCount>0&&<button className="pending-filter" onClick={()=>setShowPending(!showPending)}>{showPending?'Show All':'Show Pending'} · {pendingCount}</button>}<section className="section balance-list"><h3>Allocation Result</h3>{balances.map(b=><div className="balance-row" key={b.id}><span>{b.name}</span><b className={b.net>0? 'positive':b.net<0?'negative':''}>{b.net>0?'+':''}{money(b.net,plan.settlementCurrency)}</b></div>)}</section><section className="section"><h3>Transfer Suggestions</h3>{transfers.map((t,i)=><div className="transfer" key={i}><span>{t.from}</span><ArrowUpRight size={16}/><span>{t.to}</span><b>{money(t.amount,plan.settlementCurrency)}</b></div>)}{!transfers.length&&<div className="empty">Nothing to settle yet.</div>}</section>{showPending&&pendingCount>0&&<section className="section"><h3>Pending</h3>{plan.ledger.filter(e=>isPending(e,plan.settlementCurrency)).map(e=><div className="ledger-row" key={e.id}><span>{e.description}</span><b>{money(e.amount,e.currency)}</b></div>)}</section>}</main> }

function ReflectionPage({plan}:{plan:Plan}) { const settled=plan.ledger.filter(e=>!isPending(e,plan.settlementCurrency)); const categories=CATEGORIES.map(c=>({c,n:settled.filter(e=>e.category===c).reduce((s,e)=>s+(e.finalAmount||0),0)})).filter(x=>x.n); return <main className="page"><header className="topbar"><div><span className="eyebrow">A TRIP IN REVIEW</span><h1>Reflection</h1></div></header><section className="reflection-total"><span className="eyebrow">SETTLED TOTAL</span><strong>{money(settled.reduce((s,e)=>s+(e.finalAmount||0),0),plan.settlementCurrency)}</strong></section><section className="section"><h3>Category</h3>{categories.map(x=><div className="balance-row" key={x.c}><span>{x.c}</span><b>{money(x.n,plan.settlementCurrency)}</b></div>)}{!categories.length&&<div className="empty">No settled payments yet.</div>}</section><section className="section"><h3>Currency</h3>{Array.from(new Set(plan.ledger.map(e=>e.currency))).map(c=><div className="balance-row" key={c}><span>{c}</span><b>{plan.ledger.filter(e=>e.currency===c).reduce((s,e)=>s+e.amount,0).toFixed(2)}</b></div>)}</section></main> }

function AtelierPage({plan,update}:{plan:Plan;update:(p:Plan)=>void}) { const [name,setName]=useState(plan.name); const [dest,setDest]=useState(plan.destinations.join(', ')); return <main className="page"><header className="topbar"><div><span className="eyebrow">SETTINGS</span><h1>Atelier</h1></div></header><section className="entry"><label>Plan Name<input value={name} onChange={e=>setName(e.target.value)}/></label><label>Destinations<input value={dest} placeholder="Kuala Lumpur, Penang" onChange={e=>setDest(e.target.value)}/></label><label>Settlement Currency<select value={plan.settlementCurrency} onChange={e=>update({...plan,settlementCurrency:e.target.value})}><option>CNY</option><option>MYR</option><option>USD</option><option>SGD</option></select></label><button className="primary full" onClick={()=>update({...plan,name,destinations:dest.split(',').map(s=>s.trim()).filter(Boolean)})}>Save Plan</button></section><section className="section settings-list"><button>Accounts <ChevronRight size={16}/></button><button>Categories <ChevronRight size={16}/></button><button>Members <ChevronRight size={16}/></button><button>Backup & Restore <ChevronRight size={16}/></button></section></main> }

function QuickEntry({plan,onSave,onClose}:{plan:Plan;onSave:(x:Omit<LedgerEntry,'id'|'allocations'>&{memberIds:string[]})=>void;onClose:()=>void}) { const [description,setDescription]=useState(''); const [amount,setAmount]=useState(''); const [currency,setCurrency]=useState('MYR'); const [category,setCategory]=useState<Category>('Accommodation'); const [payerId,setPayerId]=useState(plan.members[0]?.id||''); const [accountId,setAccountId]=useState(plan.accounts[0]?.id||''); const [mode,setMode]=useState<AllocationMode>('Default'); const [members,setMembers]=useState<string[]>(plan.members.map(m=>m.id)); const today=new Date().toISOString().slice(0,10); const submit=()=>{const n=Number(amount);if(!description.trim()||!Number.isFinite(n)||n<=0)return;onSave({date:today,usageDate:today,description:description.trim(),category,amount:n,currency,payerId,accountId,allocationMode:mode,memberIds:members});}; return <main className="page"><header className="topbar"><div><span className="eyebrow">LEDGER</span><h1>Quick Entry</h1></div><button className="quiet" onClick={onClose}>Close</button></header><section className="entry"><label>Description<input value={description} onChange={e=>setDescription(e.target.value)} placeholder="Hotel" autoFocus/></label><label>Amount<div className="amount"><select value={currency} onChange={e=>setCurrency(e.target.value)}><option>MYR</option><option>CNY</option><option>USD</option><option>SGD</option></select><input value={amount} onChange={e=>setAmount(e.target.value)} inputMode="decimal" placeholder="0.00"/></div></label><div className="two"><label>Category<select value={category} onChange={e=>setCategory(e.target.value as Category)}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></label><label>Payer<select value={payerId} onChange={e=>setPayerId(e.target.value)}>{plan.members.map(m=><option value={m.id} key={m.id}>{m.name}</option>)}</select></label></div><label>Account<select value={accountId} onChange={e=>setAccountId(e.target.value)}>{plan.accounts.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select></label><label>Allocation Mode<select value={mode} onChange={e=>setMode(e.target.value as AllocationMode)}><option>Default</option><option>Split</option><option>Custom</option></select></label><div className="member-picks"><span className="eyebrow">PARTICIPANTS</span>{plan.members.map(m=><label className="check" key={m.id}><input type="checkbox" checked={members.includes(m.id)} onChange={e=>setMembers(e.target.checked?[...members,m.id]:members.filter(x=>x!==m.id))}/>{m.name}</label>)}</div><button className="primary full" onClick={submit}>Save Payment</button></section></main> }

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
