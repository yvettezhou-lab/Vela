import { useRef, useState, type ChangeEvent } from 'react';
import { DomainValidator } from '../../core/validation';
import { getDefaultCategories } from '../../core/defaults';
import { useVelaStore } from '../../store/useVelaStore';
import type { Account, Member, Trip } from '../../core/domain';
import './dataManagement.css';

const EXPORT_VERSION = 1;

type ExportPayload = {
  format: 'vela-data-export';
  version: number;
  exportedAt: string;
  state: { trips: Trip[]; commonMembers: Member[]; commonAccounts: Account[] };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeTrip = (trip: Trip): Trip => ({
  ...trip,
  categories: trip.categories.length > 0 ? trip.categories : getDefaultCategories(),
  accounts: trip.accounts.length > 0 ? trip.accounts : [
    { id: 'default-account-cash', name: 'Cash' },
    { id: 'default-account-credit-card', name: 'Credit Card' },
  ],
  members: trip.members.length > 0 ? trip.members : [{ id: 'default-member-me', name: 'Me' }],
});

const parseImport = (raw: unknown): Trip[] => {
  if (!isRecord(raw) || raw.format !== 'vela-data-export' || raw.version !== EXPORT_VERSION) {
    throw new Error('This file is not a compatible Vela data export.');
  }
  const state = raw.state;
  if (!isRecord(state) || !Array.isArray(state.trips)) {
    throw new Error('The export is missing the Vela trip state.');
  }

  const validated: Trip[] = [];
  for (const candidate of state.trips) {
    const trip = DomainValidator.validateEntireTrip(candidate, validated);
    validated.push(normalizeTrip(trip));
  }
  return validated;
};

export const DataManagement = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const trips = useVelaStore((state) => state.trips);
  const commonMembers = useVelaStore((state) => state.commonMembers);
  const commonAccounts = useVelaStore((state) => state.commonAccounts);

  const exportData = () => {
    const payload: ExportPayload = {
      format: 'vela-data-export',
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      state: { trips, commonMembers, commonAccounts },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `vela-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setStatus(`Exported ${trips.length} ${trips.length === 1 ? 'journey' : 'journeys'}.`);
  };

  const importData = async (file: File) => {
    setBusy(true);
    setStatus('');
    try {
      const text = await file.text();
      const parsed = parseImport(JSON.parse(text));
      const confirmed = window.confirm(
        `Import ${parsed.length} ${parsed.length === 1 ? 'journey' : 'journeys'} and replace the current local data? This cannot be undone.`,
      );
      if (!confirmed) return;
      const importedState = (JSON.parse(text) as { state?: { commonMembers?: Member[]; commonAccounts?: Account[] } }).state;
      useVelaStore.setState({
        trips: parsed,
        commonMembers: importedState?.commonMembers?.length ? importedState.commonMembers : [{ id: 'common-member-me', name: 'Me' }],
        commonAccounts: importedState?.commonAccounts?.length ? importedState.commonAccounts : [{ id: 'common-account-cash', name: 'Cash' }, { id: 'common-account-credit-card', name: 'Credit Card' }],
      });
      setStatus(`Imported ${parsed.length} ${parsed.length === 1 ? 'journey' : 'journeys'}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Import failed. The current data was not changed.');
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void importData(file);
  };

  return (
    <section className="data-management" aria-labelledby="data-management-title">
      <div className="data-management-heading">
        <div><span>DATA SOVEREIGNTY</span><h2 id="data-management-title">Data Management</h2></div>
        <small>Local-first backup</small>
      </div>
      <p className="data-management-copy">Export a complete JSON backup of your Vela data, or restore a compatible backup on this device.</p>
      <div className="data-management-actions">
        <button type="button" onClick={exportData} disabled={busy}>Export JSON</button>
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy}>Import JSON</button>
        <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={onFileChange} hidden />
      </div>
      <small className="data-management-count">Current local data: {trips.length} {trips.length === 1 ? 'journey' : 'journeys'}</small>
      {status && <p className="data-management-status" role="status">{status}</p>}
    </section>
  );
};

export default DataManagement;
