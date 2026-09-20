import React, { useState } from 'react';
import { Archive, Pencil, Plus } from 'lucide-react';
import { useVelaStore } from '../../store/useVelaStore';
import './masterData.css';

export const MasterData: React.FC = () => {
  const members = useVelaStore((state) => state.commonMembers);
  const accounts = useVelaStore((state) => state.commonAccounts);
  const addMember = useVelaStore((state) => state.addCommonMember);
  const renameMember = useVelaStore((state) => state.renameCommonMember);
  const archiveMember = useVelaStore((state) => state.archiveCommonMember);
  const addAccount = useVelaStore((state) => state.addCommonAccount);
  const renameAccount = useVelaStore((state) => state.renameCommonAccount);
  const archiveAccount = useVelaStore((state) => state.archiveCommonAccount);
  const [memberName, setMemberName] = useState(''); const [accountName, setAccountName] = useState(''); const [error, setError] = useState('');

  const edit = (kind: 'member' | 'account', id: string, current: string) => {
    const next = window.prompt(kind === 'member' ? 'Common person name' : 'Account name', current)?.trim();
    if (!next || next === current) return;
    try { kind === 'member' ? renameMember(id, next) : renameAccount(id, next); setError(''); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to save.'); }
  };
  const add = (kind: 'member' | 'account') => {
    const value = (kind === 'member' ? memberName : accountName).trim(); if (!value) return;
    try { kind === 'member' ? addMember(value) : addAccount(value); if (kind === 'member') setMemberName(''); else setAccountName(''); setError(''); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to add.'); }
  };
  const archive = (kind: 'member' | 'account', id: string, name: string) => {
    if (!window.confirm(`Archive ${name}? Existing trips keep their own copy.`)) return;
    kind === 'member' ? archiveMember(id) : archiveAccount(id);
  };
  const list = (kind: 'member' | 'account') => {
    const items = kind === 'member' ? members : accounts;
    return items.filter((item) => !item.archived).map((item) => <div className="master-data-row" key={item.id}><strong>{item.name}</strong><div className="master-data-actions"><button type="button" aria-label={`Edit ${item.name}`} onClick={() => edit(kind, item.id, item.name)}><Pencil size={14} /></button><button type="button" aria-label={`Archive ${item.name}`} onClick={() => archive(kind, item.id, item.name)}><Archive size={14} /></button></div></div>);
  };

  return <div className="master-data">
    <p className="master-data-global-hint">These are Vela-wide defaults. A Trip copies the people and accounts it needs; changing them here does not alter existing trips.</p>
    {error && <p className="master-data-preset-message">{error}</p>}
    <section className="master-data-group">
      <div className="master-data-group-head"><div><span className="master-data-kicker">COMMON PEOPLE</span><strong className="master-data-section-title">常用人员</strong></div></div>
      <div className="master-data-editor"><input value={memberName} onChange={(e) => setMemberName(e.target.value)} placeholder="Person name" onKeyDown={(e) => { if (e.key === 'Enter') add('member'); }} /><button type="button" onClick={() => add('member')}><Plus size={14}/> Add</button></div>
      <div className="master-data-list">{list('member')}</div>
    </section>
    <section className="master-data-group">
      <div className="master-data-group-head"><div><span className="master-data-kicker">COMMON ACCOUNTS</span><strong className="master-data-section-title">账户</strong></div></div>
      <div className="master-data-editor"><input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Account name" onKeyDown={(e) => { if (e.key === 'Enter') add('account'); }} /><button type="button" onClick={() => add('account')}><Plus size={14}/> Add</button></div>
      <div className="master-data-list">{list('account')}</div>
    </section>
  </div>;
};
export default MasterData;
