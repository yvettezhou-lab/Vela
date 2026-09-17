import React, { useMemo, useState } from 'react';
import { Archive, Pencil, Plus, RotateCcw } from 'lucide-react';
import { Account, Category, Member } from '../../core/domain';
import { MasterDataItem, MasterDataType, useVelaStore } from '../../store/useVelaStore';
import './masterData.css';

const makeId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

type Config = { type: MasterDataType; label: string; singular: string };
const CONFIGS: Config[] = [
  { type: 'members', label: 'Persons', singular: 'Person' },
  { type: 'categories', label: 'Categories', singular: 'Category' },
  { type: 'accounts', label: 'Accounts', singular: 'Account' },
];

const isArchived = (item: MasterDataItem) => item.archived === true;

const MasterDataSection: React.FC<{ tripId: string; config: Config; items: MasterDataItem[]; update: VelaStateUpdate; archive: (id: string) => void }> = ({ tripId, config, items, update, archive }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [categoryType, setCategoryType] = useState('expense');
  const [showArchived, setShowArchived] = useState(false);
  const visible = useMemo(() => items.filter((item) => showArchived || !isArchived(item)), [items, showArchived]);

  const beginCreate = () => { setEditingId(null); setName(''); setCategoryType('expense'); };
  const beginEdit = (item: MasterDataItem) => { setEditingId(item.id); setName(item.name); setCategoryType('type' in item ? item.type : 'expense'); };
  const save = () => {
    if (!name.trim()) return;
    const base = config.type === 'categories' ? { id: editingId ?? makeId('category'), name, type: categoryType } : config.type === 'accounts' ? { id: editingId ?? makeId('account'), name } : { id: editingId ?? makeId('person'), name };
    const original = items.find((item) => item.id === editingId);
    update(tripId, config.type, editingId, { ...base, ...(original?.archived ? { archived: true } : {}) } as MasterDataItem);
    setEditingId(null); setName('');
  };

  return <section className="master-data-card">
    <div className="master-data-card-head"><div><span className="master-data-kicker">MASTER DATA</span><h2>{config.label}</h2></div><button type="button" className="master-data-add" onClick={beginCreate}><Plus size={16} /> Add</button></div>
    {editingId !== null || name !== '' ? <div className="master-data-editor"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={`${config.singular} name`} onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setEditingId(null); setName(''); } }} />{config.type === 'categories' && <select value={categoryType} onChange={(e) => setCategoryType(e.target.value)}><option value="expense">Expense</option><option value="income">Income</option></select>}<button type="button" onClick={save}>Save</button><button type="button" className="ghost" onClick={() => { setEditingId(null); setName(''); }}>Cancel</button></div> : null}
    <div className="master-data-list">{visible.map((item) => <div key={item.id} className={`master-data-row ${isArchived(item) ? 'archived' : ''}`}><div><strong>{item.name}</strong>{config.type === 'categories' && <small>{(item as Category).type}</small>}{isArchived(item) && <em>Archived</em>}</div><div className="master-data-actions">{!isArchived(item) && <><button type="button" aria-label={`Edit ${item.name}`} onClick={() => beginEdit(item)}><Pencil size={15} /></button><button type="button" aria-label={`Archive ${item.name}`} onClick={() => { if (window.confirm(`Archive ${item.name}? Historical ledger references will be preserved.`)) archive(item.id); }}><Archive size={15} /></button></>}</div></div>)}{visible.length === 0 && <p className="master-data-empty">No {config.label.toLowerCase()} yet.</p>}</div>
    {items.some(isArchived) && <button type="button" className="master-data-archived-toggle" onClick={() => setShowArchived((v) => !v)}>{showArchived ? 'Hide archived' : `Show archived (${items.filter(isArchived).length})`}</button>}
  </section>;
};

type VelaStateUpdate = ReturnType<typeof useVelaStore.getState>['updateMasterData'];

export const MasterData: React.FC = () => {
  const trips = useVelaStore((state) => state.trips);
  const currentTrip = useVelaStore((state) => state.getCurrentTrip());
  const update = useVelaStore((state) => state.updateMasterData);
  const archive = useVelaStore((state) => state.archiveMasterData);
  const [tripId, setTripId] = useState(currentTrip?.id ?? trips[0]?.id ?? '');
  const trip = trips.find((item) => item.id === tripId) ?? currentTrip;

  if (!trip) return <section className="master-data-empty-panel"><h2>Master Data</h2><p>Create a trip first. Persons, Categories and Accounts belong to each trip so the ledger remains self-contained.</p></section>;
  return <div className="master-data"><div className="master-data-trip"><div><span className="master-data-kicker">TRIP CONTEXT</span><strong>{trip.title}</strong></div>{trips.length > 1 && <select value={trip.id} onChange={(e) => setTripId(e.target.value)}>{trips.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>}</div>{CONFIGS.map((config) => <MasterDataSection key={config.type} tripId={trip.id} config={config} items={trip[config.type]} update={update} archive={(id) => archive(trip.id, config.type, id)} />)}</div>;
};

export default MasterData;
