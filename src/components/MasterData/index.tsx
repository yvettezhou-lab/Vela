import React, { useState } from 'react';
import { Archive, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useVelaStore } from '../../store/useVelaStore';
import './masterData.css';

export const MasterData: React.FC = () => {
  const members = useVelaStore((state) => state.commonMembers);
  const accounts = useVelaStore((state) => state.commonAccounts);
  const addMember = useVelaStore((state) => state.addCommonMember);
  const renameMember = useVelaStore((state) => state.renameCommonMember);
  const deleteMember = useVelaStore((state) => state.deleteCommonMember);
  const addAccount = useVelaStore((state) => state.addCommonAccount);
  const renameAccount = useVelaStore((state) => state.renameCommonAccount);
  const archiveAccount = useVelaStore((state) => state.archiveCommonAccount);
  const [memberName, setMemberName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [adding, setAdding] = useState<'member' | 'account' | null>(null);
  const [error, setError] = useState('');

  const edit = (kind: 'member' | 'account', id: string, current: string) => {
    const next = window.prompt(kind === 'member' ? 'Common person name' : 'Account name', current)?.trim();
    if (!next || next === current) return;
    try { kind === 'member' ? renameMember(id, next) : renameAccount(id, next); setError(''); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to save.'); }
  };

  const add = (kind: 'member' | 'account') => {
    const value = (kind === 'member' ? memberName : accountName).trim();
    if (!value) return;
    try {
      kind === 'member' ? addMember(value) : addAccount(value);
      if (kind === 'member') setMemberName(''); else setAccountName('');
      setAdding(null);
      setError('');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to add.'); }
  };

  const startAdd = (kind: 'member' | 'account') => {
    setAdding(kind);
    setError('');
  };

  const cancelAdd = () => {
    setAdding(null);
    setMemberName('');
    setAccountName('');
  };

  const archive = (kind: 'member' | 'account', id: string, name: string) => {
    if (kind === 'member') {
      if (!window.confirm(`Delete ${name}? Existing trips keep their own copy.`)) return;
      deleteMember(id);
      return;
    }
    if (!window.confirm(`Archive ${name}? Existing trips keep their own copy.`)) return;
    archiveAccount(id);
  };

  const list = (kind: 'member' | 'account') => {
    const items = kind === 'member' ? members : accounts;
    return items.filter((item) => !item.archived).map((item) => (
      <div className="master-data-row" key={item.id}>
        <strong>{item.name}</strong>
        <div className="master-data-actions">
          <button type="button" aria-label={`Edit ${item.name}`} onClick={() => edit(kind, item.id, item.name)}><Pencil size={14} /></button>
          <button type="button" aria-label={`${kind === 'member' ? 'Delete' : 'Archive'} ${item.name}`} onClick={() => archive(kind, item.id, item.name)}>{kind === 'member' ? <Trash2 size={14} /> : <Archive size={14} />}</button>
        </div>
      </div>
    ));
  };

  const editor = (kind: 'member' | 'account') => {
    if (adding !== kind) return null;
    const value = kind === 'member' ? memberName : accountName;
    const setValue = kind === 'member' ? setMemberName : setAccountName;
    return (
      <div className="master-data-editor">
        <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder={kind === 'member' ? 'Person name' : 'Account name'} onKeyDown={(e) => { if (e.key === 'Enter') add(kind); if (e.key === 'Escape') cancelAdd(); }} />
        <button type="button" onClick={() => add(kind)}>Add</button>
        <button type="button" className="ghost" aria-label="Cancel" onClick={cancelAdd}><X size={14} /></button>
      </div>
    );
  };

  return <div className="master-data">
    <p className="master-data-global-hint">These are Vela-wide defaults. A Trip copies the people and accounts it needs; changing them here does not alter existing trips.</p>
    {error && <p className="master-data-preset-message">{error}</p>}

    <section className="master-data-group">
      <div className="master-data-group-head">
        <div><span className="master-data-kicker">COMMON PEOPLE</span><strong className="master-data-section-title">People</strong></div>
        <button type="button" className="master-data-add" onClick={() => startAdd('member')}><Plus size={14} /> Add</button>
      </div>
      {editor('member')}
      <div className="master-data-list">{list('member')}</div>
    </section>

    <section className="master-data-group">
      <div className="master-data-group-head">
        <div><span className="master-data-kicker">COMMON ACCOUNTS</span><strong className="master-data-section-title">Accounts</strong></div>
        <button type="button" className="master-data-add" onClick={() => startAdd('account')}><Plus size={14} /> Add</button>
      </div>
      {editor('account')}
      <div className="master-data-list">{list('account')}</div>
    </section>
  </div>;
};
export default MasterData;
