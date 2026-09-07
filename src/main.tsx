import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Home, BookOpen, Scale, Compass, Settings, Plus, ChevronRight } from 'lucide-react';
import './styles.css';

type Tab = 'Home' | 'Ledger' | 'Balance' | 'Reflection' | 'Atelier';

const nav: { label: Tab; icon: typeof Home }[] = [
  { label: 'Home', icon: Home },
  { label: 'Ledger', icon: BookOpen },
  { label: 'Balance', icon: Scale },
  { label: 'Reflection', icon: Compass },
  { label: 'Atelier', icon: Settings },
];

function HomePage({ onQuickEntry }: { onQuickEntry: () => void }) {
  return <main className="page">
    <header className="topbar"><div><span className="eyebrow">CURRENT PLAN</span><h1>Vela</h1></div><button className="quiet">Plan</button></header>
    <section className="hero"><span className="eyebrow">TRAVEL LEDGER</span><h2>Ready for the next journey.</h2><p>Create a Plan to bring payments, allocations and settlement into one place.</p><button className="primary" onClick={onQuickEntry}><Plus size={17}/> Quick Entry</button></section>
    <section className="section"><div className="section-head"><h3>Recent Ledger</h3><ChevronRight size={17}/></div><div className="empty"><BookOpen size={22}/><span>No payments yet.</span></div></section>
  </main>;
}

function SimplePage({ title, eyebrow, children }: { title: string; eyebrow: string; children?: React.ReactNode }) {
  return <main className="page"><header className="topbar"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1></div></header>{children}</main>;
}

function QuickEntry({ onClose }: { onClose: () => void }) {
  return <main className="page"><header className="topbar"><div><span className="eyebrow">LEDGER</span><h1>Quick Entry</h1></div><button className="quiet" onClick={onClose}>Close</button></header><section className="entry"><label>Description<input placeholder="Hotel" /></label><label>Amount<div className="amount"><span>MYR</span><input inputMode="decimal" placeholder="0.00" /></div></label><div className="two"><label>Category<select><option>Accommodation</option><option>Food</option><option>Transport</option><option>Shopping</option><option>Activities</option><option>Other</option></select></label><label>Payer<select><option>Me</option></select></label></div><button className="primary full" onClick={onClose}>Save Payment</button></section></main>;
}

function App() {
  const [tab, setTab] = useState<Tab>('Home');
  const [quick, setQuick] = useState(false);
  if (quick) return <><QuickEntry onClose={() => setQuick(false)} /></>;
  const content = tab === 'Home' ? <HomePage onQuickEntry={() => setQuick(true)} />
    : tab === 'Ledger' ? <SimplePage title="Ledger" eyebrow="TRIP RECORD" ><div className="empty large"><BookOpen size={25}/><span>Your real payments will live here.</span></div></SimplePage>
    : tab === 'Balance' ? <SimplePage title="Balance" eyebrow="SETTLEMENT"><div className="empty large"><Scale size={25}/><span>Settlement appears when a Plan has allocated payments.</span></div></SimplePage>
    : tab === 'Reflection' ? <SimplePage title="Reflection" eyebrow="A TRIP IN REVIEW"><div className="empty large"><Compass size={25}/><span>Your trip story will take shape here.</span></div></SimplePage>
    : <SimplePage title="Atelier" eyebrow="SETTINGS"><div className="settings-list"><button>Accounts <ChevronRight size={16}/></button><button>Categories <ChevronRight size={16}/></button><button>Members <ChevronRight size={16}/></button><button>Backup & Restore <ChevronRight size={16}/></button></div></SimplePage>;
  return <div className="app">{content}<nav className="bottom-nav">{nav.map(({label, icon: Icon}) => <button key={label} className={tab === label ? 'active' : ''} onClick={() => setTab(label)}><Icon size={19} strokeWidth={1.65}/><span>{label}</span></button>)}</nav></div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
