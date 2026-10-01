import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useVelaStore } from '../../store/useVelaStore';
import './masterData.css';

export const MasterData: React.FC = () => {
  const members = useVelaStore((state) => state.commonMembers);
  const categories = useVelaStore((state) => state.commonCategories);
  const accounts = useVelaStore((state) => state.commonAccounts);
  const addCategory = useVelaStore((state) => state.addCommonCategory);
  const renameCategory = useVelaStore((state) => state.renameCommonCategory);
  const deleteCategory = useVelaStore((state) => state.deleteCommonCategory);
  const reorderCategory = useVelaStore((state) => state.reorderCommonCategory);
  const addMember = useVelaStore((state) => state.addCommonMember);
  const renameMember = useVelaStore((state) => state.renameCommonMember);
  const deleteMember = useVelaStore((state) => state.deleteCommonMember);
  const addMemberListItem = useVelaStore((state) => state.addCommonMemberListItem);
  const deleteMemberListItem = useVelaStore((state) => state.deleteCommonMemberListItem);
  const addAccount = useVelaStore((state) => state.addCommonAccount);
  const renameAccount = useVelaStore((state) => state.renameCommonAccount);
  const deleteAccount = useVelaStore((state) => state.deleteCommonAccount);
  const [categoryName, setCategoryName] = useState('');
  const [memberName, setMemberName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [adding, setAdding] = useState<'category' | 'member' | 'account' | null>(null);
  const [error, setError] = useState('');
  const [personalListMemberId, setPersonalListMemberId] = useState<string | null>(null);
  const [personalItem, setPersonalItem] = useState('');
  const [openGroup, setOpenGroup] = useState<'member' | 'account' | null>(null);

  const edit = (kind: 'category' | 'member' | 'account', id: string, current: string) => {
    const next = window.prompt(kind === 'category' ? 'Category name' : kind === 'member' ? 'Common person name' : 'Account name', current)?.trim();
    if (!next || next === current) return;
    try { kind === 'category' ? renameCategory(id, next) : kind === 'member' ? renameMember(id, next) : renameAccount(id, next); setError(''); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to save.'); }
  };

  const add = (kind: 'category' | 'member' | 'account') => {
    const value = (kind === 'category' ? categoryName : kind === 'member' ? memberName : accountName).trim();
    if (!value) return;
    try {
      kind === 'category' ? addCategory(value) : kind === 'member' ? addMember(value) : addAccount(value);
      if (kind === 'category') setCategoryName(''); else if (kind === 'member') setMemberName(''); else setAccountName('');
      setAdding(null);
      setError('');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to add.'); }
  };

  const startAdd = (kind: 'category' | 'member' | 'account') => {
    setAdding(kind);
    setError('');
  };

  const cancelAdd = () => {
    setAdding(null);
    setMemberName('');
    setAccountName('');
    setCategoryName('');
  };

  const archive = (kind: 'category' | 'member' | 'account', id: string, name: string) => {
    if (!window.confirm(`Delete ${name}? Existing trips keep their own copy.`)) return;
    try {
      kind === 'category' ? deleteCategory(id) : kind === 'member' ? deleteMember(id) : deleteAccount(id);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to delete.');
    }
  };

  const list = (kind: 'category' | 'member' | 'account') => {
    const items = kind === 'category' ? categories : kind === 'member' ? members : accounts;
    return items.filter((item) => !item.archived).map((item) => (
      <React.Fragment key={item.id}>
        <div className="master-data-row">
          <strong>{item.name}</strong>
          <div className="master-data-actions">
            {kind === 'member' && <button type="button" onClick={() => { setPersonalListMemberId(personalListMemberId === item.id ? null : item.id); setPersonalItem(''); }}>List</button>}
            {kind === 'category' && <div className="master-data-reorder">
              <button type="button" aria-label={`Move ${item.name} up`} disabled={items.filter((entry) => !entry.archived).findIndex((entry) => entry.id === item.id) === 0} onClick={() => reorderCategory(item.id, 'up')}><ChevronUp size={14} /></button>
              <button type="button" aria-label={`Move ${item.name} down`} disabled={items.filter((entry) => !entry.archived).findIndex((entry) => entry.id === item.id) === items.filter((entry) => !entry.archived).length - 1} onClick={() => reorderCategory(item.id, 'down')}><ChevronDown size={14} /></button>
            </div>}
            <button type="button" aria-label={`Edit ${item.name}`} onClick={() => edit(kind, item.id, item.name)}><Pencil size={14} /></button>
            <button type="button" aria-label={`Delete ${item.name}`} onClick={() => archive(kind, item.id, item.name)}><Trash2 size={14} /></button>
          </div>
        </div>
        {kind === 'member' && personalListMemberId === item.id && (
          <div className="master-data-personal-list">
            <div className="master-data-personal-title">Personal travel list</div>
            <div className="master-data-personal-items">
              {(item.personalListItems ?? []).map((entry) => (
                <div className="master-data-personal-item" key={entry}>
                  <span>{entry}</span>
                  <button type="button" aria-label={`Delete ${entry}`} onClick={() => deleteMemberListItem(item.id, entry)}><X size={13} /></button>
                </div>
              ))}
            </div>
            <div className="master-data-editor">
              <input value={personalItem} onChange={(e) => setPersonalItem(e.target.value)} placeholder="Add personal item" onKeyDown={(e) => { if (e.key === 'Enter' && personalItem.trim()) { addMemberListItem(item.id, personalItem); setPersonalItem(''); } }} />
              <button type="button" onClick={() => { if (!personalItem.trim()) return; addMemberListItem(item.id, personalItem); setPersonalItem(''); }}>Add</button>
            </div>
            <small>Trips that include {item.name} will automatically get this list.</small>
          </div>
        )}
      </React.Fragment>
    ));
  };

  const editor = (kind: 'category' | 'member' | 'account') => {
    if (adding !== kind) return null;
    const value = kind === 'category' ? categoryName : kind === 'member' ? memberName : accountName;
    const setValue = kind === 'category' ? setCategoryName : kind === 'member' ? setMemberName : setAccountName;
    return (
      <div className="master-data-editor">
        <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder={kind === 'category' ? 'Category name' : kind === 'member' ? 'Person name' : 'Account name'} onKeyDown={(e) => { if (e.key === 'Enter') add(kind); if (e.key === 'Escape') cancelAdd(); }} />
        <button type="button" onClick={() => add(kind)}>Add</button>
        <button type="button" className="ghost" aria-label="Cancel" onClick={cancelAdd}><X size={14} /></button>
      </div>
    );
  };

  return <div className="master-data">
    <p className="master-data-global-hint">These are Vela-wide defaults. A Trip copies the people and accounts it needs; changing them here does not alter existing trips.</p>
    {error && <p className="master-data-preset-message">{error}</p>}

    <section className={`master-data-group ${openGroup === 'member' ? 'open' : ''}`}>
      <button type="button" className="master-data-group-toggle" aria-expanded={openGroup === 'member'} onClick={() => { setOpenGroup(openGroup === 'member' ? null : 'member'); setAdding(null); setPersonalListMemberId(null); }}>
        <span><span className="master-data-kicker">COMMON PEOPLE</span><strong className="master-data-section-title">People</strong></span>
        <span className="master-data-group-chevron" aria-hidden="true">⌄</span>
      </button>
      {openGroup === 'member' && <>
        <div className="master-data-group-head master-data-group-actions">
          <span />
          <button type="button" className="master-data-add" onClick={() => startAdd('member')}><Plus size={14} /> Add</button>
        </div>
        {editor('member')}
        <div className="master-data-list">{list('member')}</div>
      </>}
    </section>

    <section className={`master-data-group ${openGroup === 'category' ? 'open' : ''}`}>
      <button type="button" className="master-data-group-toggle" aria-expanded={openGroup === 'category'} onClick={() => { setOpenGroup(openGroup === 'category' ? null : 'category'); setAdding(null); }}>
        <span><span className="master-data-kicker">COMMON CATEGORIES</span><strong className="master-data-section-title">Categories</strong></span>
        <span className="master-data-group-chevron" aria-hidden="true">⌄</span>
      </button>
      {openGroup === 'category' && <>
        <div className="master-data-group-head master-data-group-actions">
          <span />
          <button type="button" className="master-data-add" onClick={() => startAdd('category')}><Plus size={14} /> Add</button>
        </div>
        {editor('category')}
        <div className="master-data-list">{list('category')}</div>
      </>}
    </section>

    <section className={`master-data-group ${openGroup === 'account' ? 'open' : ''}`}>
      <button type="button" className="master-data-group-toggle" aria-expanded={openGroup === 'account'} onClick={() => { setOpenGroup(openGroup === 'account' ? null : 'account'); setAdding(null); }}>
        <span><span className="master-data-kicker">COMMON ACCOUNTS</span><strong className="master-data-section-title">Accounts</strong></span>
        <span className="master-data-group-chevron" aria-hidden="true">⌄</span>
      </button>
      {openGroup === 'account' && <>
        <div className="master-data-group-head master-data-group-actions">
          <span />
          <button type="button" className="master-data-add" onClick={() => startAdd('account')}><Plus size={14} /> Add</button>
        </div>
        {editor('account')}
        <div className="master-data-list">{list('account')}</div>
      </>}
    </section>
  </div>;
};
export default MasterData;
