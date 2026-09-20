import React, { useEffect, useMemo, useState } from 'react';
import { Archive, ChevronDown, Pencil, Plus } from 'lucide-react';
import { Category, Member, Trip } from '../../core/domain';
import { MasterDataItem, MasterDataType, useVelaStore } from '../../store/useVelaStore';
import './masterData.css';

const makeId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
type Config = { type: MasterDataType; label: string; singular: string };
const CONFIGS: Config[] = [{ type: 'categories', label: 'Categories', singular: 'Category' }, { type: 'accounts', label: 'Accounts', singular: 'Account' }];
const isArchived = (item: MasterDataItem) => item.archived === true;
type VelaStateUpdate = ReturnType<typeof useVelaStore.getState>['updateMasterData'];

const MasterDataSection: React.FC<{ tripId: string; config: Config; items: MasterDataItem[]; update: VelaStateUpdate; archive: (id: string) => void }> = ({ tripId, config, items, update, archive }) => {
  const [editorOpen, setEditorOpen] = useState(false); const [editingId, setEditingId] = useState<string | null>(null); const [name, setName] = useState(''); const [categoryType, setCategoryType] = useState('expense'); const [showArchived, setShowArchived] = useState(false);
  const visible = useMemo(() => items.filter((item) => showArchived || !isArchived(item)), [items, showArchived]);
  const beginCreate = () => { setEditingId(null); setName(''); setCategoryType('expense'); setEditorOpen(true); };
  const beginEdit = (item: MasterDataItem) => { setEditingId(item.id); setName(item.name); setCategoryType('type' in item ? item.type : 'expense'); setEditorOpen(true); };
  const closeEditor = () => { setEditorOpen(false); setEditingId(null); setName(''); };
  const save = () => { if (!name.trim()) return; const base = config.type === 'categories' ? { id: editingId ?? makeId('category'), name, type: categoryType } : { id: editingId ?? makeId('account'), name }; const original = items.find((item) => item.id === editingId); update(tripId, config.type, editingId, { ...base, ...(original?.archived ? { archived: true } : {}) } as MasterDataItem); closeEditor(); };
  return <div className="master-data-group"><div className="master-data-group-head"><div><span className="master-data-kicker">{config.label.toUpperCase()}</span></div><button type="button" className="master-data-add" onClick={beginCreate}><Plus size={14} /> Add {config.singular.toLowerCase()}</button></div>
    {editorOpen && <div className="master-data-editor"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={`${config.singular} name`} onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') closeEditor(); }} />{config.type === 'categories' && <select value={categoryType} onChange={(e) => setCategoryType(e.target.value)}><option value="expense">Expense</option><option value="income">Income</option></select>}<button type="button" onClick={save}>Save</button><button type="button" className="ghost" onClick={closeEditor}>Cancel</button></div>}
    <div className="master-data-list">{visible.map((item) => <div key={item.id} className={`master-data-row ${isArchived(item) ? 'archived' : ''}`}><div><strong>{item.name}</strong>{config.type === 'categories' && <small>{(item as Category).type}</small>}{isArchived(item) && <em>Archived</em>}</div><div className="master-data-actions">{!isArchived(item) && <><button type="button" aria-label={`Edit ${item.name}`} onClick={() => beginEdit(item)}><Pencil size={14} /></button><button type="button" aria-label={`Archive ${item.name}`} onClick={() => { if (window.confirm(`Archive ${item.name}? Historical ledger references will be preserved.`)) archive(item.id); }}><Archive size={14} /></button></>}</div></div>)}{visible.length === 0 && <p className="master-data-empty">No {config.label.toLowerCase()} yet.</p>}</div>
    {items.some(isArchived) && <button type="button" className="master-data-archived-toggle" onClick={() => setShowArchived((v) => !v)}>{showArchived ? 'Hide archived' : `Show archived (${items.filter(isArchived).length})`}</button>}
  </div>;
};

const PeopleAndAllocation: React.FC<{ trip: Trip; update: VelaStateUpdate; archive: (id: string) => void }> = ({ trip, update, archive }) => {
  const updateTrip = useVelaStore((state) => state.updateTrip);
  const activeMembers = trip.members.filter((member) => member.archived !== true);
  const [percentages, setPercentages] = useState<Record<string, number>>({});
  const [editorOpen, setEditorOpen] = useState(false); const [name, setName] = useState(''); const [message, setMessage] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  useEffect(() => {
    const existing = trip.allocationRules?.percentages ?? {};
    setPercentages(Object.fromEntries(activeMembers.map((member) => [member.id, Number(existing[member.id] ?? 0)])));
    setMessage('');
  }, [trip.id, trip.updatedAt]);
  const total = activeMembers.reduce((sum, member) => sum + (Number(percentages[member.id]) || 0), 0);
  const save = () => {
    if (Math.abs(total - 100) > 0.001) { setMessage(`Must total 100%. Current: ${total.toFixed(2)}%.`); return; }
    updateTrip(trip.id, { ...trip, allocationRules: { allocationMode: 'preset_percentage', percentages: Object.fromEntries(activeMembers.filter((member) => (Number(percentages[member.id]) || 0) > 0).map((member) => [member.id, Number(percentages[member.id])])) } });
    setMessage('Saved. Quick Entry can now use “按设定比例”.');
  };
  const addPerson = () => {
    if (!name.trim()) return;
    const member: Member = { id: makeId('person'), name: name.trim() };
    update(trip.id, 'members', null, member);
    setName(''); setEditorOpen(false); setMessage('Person added. Set the percentage and save below.');
  };
  const visible = trip.members.filter((member) => showArchived || member.archived !== true);
  return <div className="master-data-group master-data-people">
    <div className="master-data-group-head"><div><span className="master-data-kicker">PEOPLE & ALLOCATION</span><strong className="master-data-section-title">Persons &amp; Split</strong></div><button type="button" className="master-data-add" onClick={() => setEditorOpen(true)}><Plus size={14} /> Add person</button></div>
    {editorOpen && <div className="master-data-editor"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Person name" onKeyDown={(e) => { if (e.key === 'Enter') addPerson(); if (e.key === 'Escape') { setEditorOpen(false); setName(''); } }} /><button type="button" onClick={addPerson}>Add</button><button type="button" className="ghost" onClick={() => { setEditorOpen(false); setName(''); }}>Cancel</button></div>}
    <p className="master-data-preset-hint">Add the people for this trip, then set their default sharing percentages here. The total must be 100%.</p>
    <div className="master-data-preset-list">
      {visible.map((member) => <div key={member.id} className={`master-data-person-preset ${member.archived ? 'archived' : ''}`}><div className="master-data-person-name"><strong>{member.name}</strong>{member.archived && <em>Archived</em>}</div>{!member.archived && <><div className="master-data-person-percent"><input aria-label={`${member.name} percentage`} type="number" min="0" max="100" step="0.01" inputMode="decimal" value={percentages[member.id] ?? 0} onChange={(event) => setPercentages((current) => ({ ...current, [member.id]: event.target.value === '' ? 0 : Number(event.target.value) }))} />%</div><div className="master-data-person-actions"><button type="button" aria-label={`Edit ${member.name}`} onClick={() => { const next = window.prompt('Person name', member.name)?.trim(); if (next && next !== member.name) update(trip.id, 'members', member.id, { ...member, name: next }); }}><Pencil size={14} /></button><button type="button" aria-label={`Archive ${member.name}`} onClick={() => { if (window.confirm(`Archive ${member.name}? Historical ledger references will be preserved.`)) archive(member.id); }}><Archive size={14} /></button></div></>}</div>)}
    </div>
    {trip.members.some(isArchived) && <button type="button" className="master-data-archived-toggle" onClick={() => setShowArchived((v) => !v)}>{showArchived ? 'Hide archived' : `Show archived (${trip.members.filter(isArchived).length})`}</button>}
    <div className="master-data-preset-footer"><span className={Math.abs(total - 100) < 0.001 ? 'master-data-preset-total is-valid' : 'master-data-preset-total'}>{total.toFixed(2)}%</span><button type="button" onClick={save}>Save split</button></div>
    {message && <p className="master-data-preset-message">{message}</p>}
  </div>;
};

const TripPanel: React.FC<{ trip: Trip; open: boolean; onToggle: () => void }> = ({ trip, open, onToggle }) => {
  const update = useVelaStore((state) => state.updateMasterData); const archive = useVelaStore((state) => state.archiveMasterData);
  return <section className={`master-data-trip-panel ${open ? 'is-open' : ''}`}>
    <button type="button" className="master-data-trip-toggle" onClick={onToggle} aria-expanded={open}>
      <span><span className="master-data-kicker">{trip.status.toUpperCase()}</span><strong>{trip.title}</strong></span><ChevronDown size={18} />
    </button>
    {open && <div className="master-data-trip-content">
      <PeopleAndAllocation trip={trip} update={update} archive={(id) => archive(trip.id, 'members', id)} />
      <section className="master-data-card master-data-subcard"><div className="master-data-card-head"><div><span className="master-data-kicker">MASTER DATA</span><h2>Categories &amp; Accounts</h2></div></div>{CONFIGS.map((config) => <MasterDataSection key={config.type} tripId={trip.id} config={config} items={trip[config.type]} update={update} archive={(id) => archive(trip.id, config.type, id)} />)}</section>
    </div>}
  </section>;
};

export const MasterData: React.FC = () => {
  const trips = useVelaStore((state) => state.trips); const currentTrip = useVelaStore((state) => state.getCurrentTrip());
  const defaultId = currentTrip?.id ?? trips[0]?.id ?? '';
  const [openTripId, setOpenTripId] = useState(defaultId);
  useEffect(() => { if (currentTrip && !trips.some((item) => item.id === openTripId)) setOpenTripId(currentTrip.id); }, [currentTrip, trips, openTripId]);
  const orderedTrips = useMemo(() => [...trips].sort((a, b) => {
    if (a.id === currentTrip?.id) return -1; if (b.id === currentTrip?.id) return 1;
    const statusRank = (status: string) => status === 'traveling' ? 0 : status === 'planning' ? 1 : 2;
    return statusRank(a.status) - statusRank(b.status) || b.updatedAt - a.updatedAt;
  }), [trips, currentTrip]);
  if (!trips.length) return <section className="master-data-empty-panel"><h2>Master Data</h2><p>Create a trip first. Persons, Categories and Accounts belong to each trip.</p></section>;
  return <div className="master-data"><div className="master-data-list-header"><span className="master-data-kicker">TRIP SETUP</span><h2>Trips</h2><p>People and their default split are configured together for each trip.</p></div>{orderedTrips.map((trip) => <TripPanel key={trip.id} trip={trip} open={openTripId === trip.id} onToggle={() => setOpenTripId((current) => current === trip.id ? '' : trip.id)} />)}</div>;
};
export default MasterData;
