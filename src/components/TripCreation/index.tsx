import React, { FormEvent, useState } from 'react';
import { CalendarDays, ChevronDown, X } from 'lucide-react';
import { Trip } from '../../core/domain';
import { useVelaStore } from '../../store/useVelaStore';
import './styles.css';

type Props = { onClose: () => void; onCreated: () => void };

const toTimestamp = (value: string) => {
  const timestamp = new Date(`${value}T12:00:00`).getTime();
  return Number.isFinite(timestamp) ? timestamp : NaN;
};

export const TripCreation: React.FC<Props> = ({ onClose, onCreated }) => {
  const [title, setTitle] = useState('');
  const [localCurrency, setLocalCurrency] = useState('CNY');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const cleanTitle = title.trim();
    const cleanCurrency = localCurrency.trim().toUpperCase();
    const start = toTimestamp(startDate);
    const end = toTimestamp(endDate);
    if (!cleanTitle) return setError('Please enter a trip title.');
    if (!cleanCurrency) return setError('Please enter a base currency.');
    if (!Number.isFinite(start) || !Number.isFinite(end)) return setError('Please choose both dates.');
    if (end < start) return setError('End date cannot be before start date.');

    const now = Date.now();
    const newTrip: Trip = {
      id: crypto.randomUUID(),
      title: cleanTitle,
      destination: '',
      startDate: start,
      endDate: end,
      status: 'planning',
      localCurrency: cleanCurrency,
      members: [{ id: crypto.randomUUID(), name: 'Me' }],
      accounts: [],
      categories: [],
      ledger: [],
      createdAt: now,
      updatedAt: now,
    };

    try {
      useVelaStore.getState().addTrip(newTrip);
      onCreated();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Unable to create this journey.');
    }
  };

  return <div className="trip-creation-modal" role="dialog" aria-modal="true" aria-labelledby="trip-creation-title">
    <div className="trip-creation-head">
      <div><span>VELA · NEW JOURNEY</span><h2 id="trip-creation-title">Set your course.</h2></div>
      <button type="button" onClick={onClose} aria-label="Close"><X size={19} /></button>
    </div>
    <form onSubmit={submit}>
      <label><span>TRIP TITLE</span><input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Penang" /></label>
      <label><span>BASE CURRENCY</span><input value={localCurrency} onChange={(e) => setLocalCurrency(e.target.value)} placeholder="CNY" maxLength={8} /></label>
      <div className="trip-creation-dates">
        <label><span>START DATE</span><div><CalendarDays size={15} /><input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); e.currentTarget.blur(); }} /></div></label>
        <label><span>END DATE</span><div><CalendarDays size={15} /><input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); e.currentTarget.blur(); }} /></div></label>
      </div>
      <div className="trip-creation-member"><span>DEFAULT MEMBER</span><strong>Me</strong><small>Added automatically</small></div>
      {error && <p className="trip-creation-error" role="alert">{error}</p>}
      <button className="trip-creation-submit" type="submit">Create Journey <ChevronDown size={15} /></button>
    </form>
  </div>;
};
