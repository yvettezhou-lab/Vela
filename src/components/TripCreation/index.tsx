import React, { FormEvent, useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, Plus, Trash2, X } from 'lucide-react';
import { Destination, TravelSegment, Trip } from '../../core/domain';
import { useVelaStore } from '../../store/useVelaStore';
import './styles.css';

type Props = { onClose: () => void; onCreated?: () => void; onUpdated?: () => void; trip?: Trip | null };

type DraftDestination = Destination;
type DraftSegment = {
  id: string;
  startDate: string;
  endDate: string;
  destinations: DraftDestination[];
  primaryCurrency: string;
  currencyManuallySet: boolean;
};

const CURRENCIES = ['CNY', 'MYR', 'SGD', 'THB', 'IDR', 'PHP', 'JPY', 'KRW', 'USD', 'EUR', 'GBP', 'AUD', 'HKD'];
const COUNTRY_CURRENCIES: Record<string, string> = {
  china: 'CNY', malaysia: 'MYR', singapore: 'SGD', thailand: 'THB', indonesia: 'IDR', philippines: 'PHP',
  japan: 'JPY', 'south korea': 'KRW', korea: 'KRW', 'united states': 'USD', usa: 'USD', 'united kingdom': 'GBP',
  australia: 'AUD', 'hong kong': 'HKD',
};

const toDateInput = (timestamp: number) => {
  const date = new Date(timestamp);
  return Number.isFinite(timestamp) ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : '';
};
const toTimestamp = (value: string) => {
  const timestamp = new Date(`${value}T12:00:00`).getTime();
  return Number.isFinite(timestamp) ? timestamp : NaN;
};
const countryCurrency = (country: string) => COUNTRY_CURRENCIES[country.trim().toLowerCase()] ?? '';
const makeDraftSegment = (segment?: TravelSegment): DraftSegment => ({
  id: segment?.id ?? crypto.randomUUID(),
  startDate: segment ? toDateInput(segment.startDate) : '',
  endDate: segment ? toDateInput(segment.endDate) : '',
  destinations: segment?.destinations?.length ? segment.destinations.map((destination) => ({ ...destination })) : [{ country: '', city: '' }],
  primaryCurrency: segment?.primaryCurrency ?? 'CNY',
  currencyManuallySet: Boolean(segment),
});

export const TripCreation: React.FC<Props> = ({ onClose, onCreated, onUpdated, trip }) => {
  const editing = Boolean(trip);
  const [title, setTitle] = useState(trip?.title ?? '');
  const [segments, setSegments] = useState<DraftSegment[]>(() => trip?.segments.map(makeDraftSegment) ?? [makeDraftSegment()]);
  const [error, setError] = useState('');

  const overlapPairs = useMemo(() => {
    const ranges = segments.map((segment, index) => ({ index, start: toTimestamp(segment.startDate), end: toTimestamp(segment.endDate) }))
      .filter((range) => Number.isFinite(range.start) && Number.isFinite(range.end) && range.start <= range.end);
    const pairs: [number, number][] = [];
    for (let i = 0; i < ranges.length; i++) for (let j = i + 1; j < ranges.length; j++)
      if (ranges[i].start < ranges[j].end && ranges[j].start < ranges[i].end) pairs.push([ranges[i].index, ranges[j].index]);
    return pairs;
  }, [segments]);

  const updateSegment = (index: number, patch: Partial<DraftSegment>) =>
    setSegments((current) => current.map((segment, i) => i === index ? { ...segment, ...patch } : segment));
  const updateDestination = (segmentIndex: number, destinationIndex: number, patch: Partial<DraftDestination>) =>
    setSegments((current) => current.map((segment, i) => i !== segmentIndex ? segment : {
      ...segment,
      destinations: segment.destinations.map((destination, j) => j === destinationIndex ? { ...destination, ...patch } : destination),
    }));
  const updateCountry = (segmentIndex: number, destinationIndex: number, country: string) => {
    setSegments((current) => current.map((segment, i) => {
      if (i !== segmentIndex) return segment;
      const destinations = segment.destinations.map((destination, j) => j === destinationIndex ? { ...destination, country } : destination);
      const firstCountry = destinations[0]?.country ?? '';
      const suggestedCurrency = countryCurrency(firstCountry);
      return { ...segment, destinations, ...(suggestedCurrency && !segment.currencyManuallySet ? { primaryCurrency: suggestedCurrency } : {}) };
    }));
  };
  const addDestination = (segmentIndex: number) => setSegments((current) => current.map((segment, i) => i === segmentIndex ? { ...segment, destinations: [...segment.destinations, { country: '', city: '' }] } : segment));
  const removeDestination = (segmentIndex: number, destinationIndex: number) => setSegments((current) => current.map((segment, i) => {
    if (i !== segmentIndex || segment.destinations.length <= 1) return segment;
    return { ...segment, destinations: segment.destinations.filter((_, j) => j !== destinationIndex) };
  }));
  const addSegment = () => setSegments((current) => [...current, makeDraftSegment()]);
  const removeSegment = (index: number) => setSegments((current) => current.length <= 1 ? current : current.filter((_, i) => i !== index));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const cleanTitle = title.trim();
    if (!cleanTitle) return setError('Please enter a trip title.');
    if (!segments.length) return setError('Please add at least one segment.');
    if (overlapPairs.length) return setError(`Segment ${overlapPairs[0][0] + 1} overlaps Segment ${overlapPairs[0][1] + 1}. Adjust the date ranges before saving.`);

    const normalizedSegments: TravelSegment[] = [];
    for (let i = 0; i < segments.length; i++) {
      const draft = segments[i];
      const start = toTimestamp(draft.startDate), end = toTimestamp(draft.endDate);
      if (!Number.isFinite(start) || !Number.isFinite(end)) return setError(`Please choose both dates for Segment ${i + 1}.`);
      if (end < start) return setError(`End date cannot be before start date in Segment ${i + 1}.`);
      const destinations = draft.destinations.map((destination) => ({ country: destination.country.trim(), city: destination.city.trim() }));
      if (destinations.some((destination) => !destination.country && !destination.city)) return setError(`Please complete the destination in Segment ${i + 1}.`);
      if (!draft.primaryCurrency.trim()) return setError(`Please choose a primary currency for Segment ${i + 1}.`);
      normalizedSegments.push({ id: draft.id, startDate: start, endDate: end, destinations, primaryCurrency: draft.primaryCurrency.trim().toUpperCase() });
    }

    const now = Date.now();
    const payload: Trip = {
      id: trip?.id ?? crypto.randomUUID(), title: cleanTitle, segments, status: trip?.status ?? 'planning',
      coverImage: trip?.coverImage, members: trip?.members ?? [{ id: crypto.randomUUID(), name: 'Me' }],
      accounts: trip?.accounts ?? [], categories: trip?.categories ?? [], ledger: trip?.ledger ?? [], createdAt: trip?.createdAt ?? now, updatedAt: now,
    };
    payload.segments = normalizedSegments;
    try {
      if (editing && trip) useVelaStore.getState().updateTrip(trip.id, payload);
      else useVelaStore.getState().addTrip(payload);
      editing ? onUpdated?.() : onCreated?.();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Unable to save this journey.');
    }
  };

  return <div className="trip-creation-modal" role="dialog" aria-modal="true" aria-labelledby="trip-creation-title">
    <div className="trip-creation-head">
      <div><span>VELA · {editing ? 'EDIT JOURNEY' : 'NEW JOURNEY'}</span><h2 id="trip-creation-title">{editing ? 'Refine your course.' : 'Set your course.'}</h2></div>
      <button type="button" onClick={onClose} aria-label="Close"><X size={19} /></button>
    </div>
    <form onSubmit={submit}>
      <label><span>TRIP TITLE</span><input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Penang" /></label>

      <div className="trip-segments">
        <div className="trip-segments-heading"><span>TRAVEL SEGMENTS</span><small>{segments.length} {segments.length === 1 ? 'segment' : 'segments'}</small></div>
        {segments.map((segment, segmentIndex) => {
          const overlaps = overlapPairs.some(([a, b]) => a === segmentIndex || b === segmentIndex);
          return <div className={`trip-segment ${overlaps ? 'is-overlapping' : ''}`} key={segment.id}>
            <div className="trip-segment-head"><strong>SEGMENT {segmentIndex + 1}</strong>{segments.length > 1 && <button type="button" className="trip-icon-button" onClick={() => removeSegment(segmentIndex)} aria-label={`Remove segment ${segmentIndex + 1}`}><Trash2 size={14} /></button>}</div>
            <div className="trip-creation-dates">
              <label><span>START</span><div><CalendarDays size={14} /><input type="date" value={segment.startDate} onChange={(e) => updateSegment(segmentIndex, { startDate: e.target.value })} /></div></label>
              <label><span>END</span><div><CalendarDays size={14} /><input type="date" value={segment.endDate} onChange={(e) => updateSegment(segmentIndex, { endDate: e.target.value })} /></div></label>
            </div>
            {overlaps && <p className="trip-segment-inline-error" role="alert">This date range overlaps another segment. Segments must not overlap.</p>}
            <div className="trip-destination-section">
              <span className="trip-field-label">DESTINATIONS</span>
              {segment.destinations.map((destination, destinationIndex) => <div className="trip-destination-row" key={destinationIndex}>
                <input aria-label={`Segment ${segmentIndex + 1} country ${destinationIndex + 1}`} value={destination.country} onChange={(e) => updateCountry(segmentIndex, destinationIndex, e.target.value)} placeholder="Country" />
                <input aria-label={`Segment ${segmentIndex + 1} city ${destinationIndex + 1}`} value={destination.city} onChange={(e) => updateDestination(segmentIndex, destinationIndex, { city: e.target.value })} placeholder="City" />
                {destinationIndex === segment.destinations.length - 1 ? <button type="button" className="trip-inline-add" onClick={() => addDestination(segmentIndex)} aria-label="Add destination"><Plus size={15} /></button> : <button type="button" className="trip-icon-button trip-destination-remove" onClick={() => removeDestination(segmentIndex, destinationIndex)} aria-label="Remove destination"><X size={13} /></button>}
              </div>)}
            </div>
            <label><span>PRIMARY CURRENCY</span><div className="trip-select-wrap"><select value={segment.primaryCurrency} onChange={(e) => updateSegment(segmentIndex, { primaryCurrency: e.target.value, currencyManuallySet: true })}>{CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select><ChevronDown size={14} /></div></label>
          </div>;
        })}
        <button type="button" className="trip-add-segment" onClick={addSegment}>+ Add segment</button>
      </div>

      <div className="trip-creation-member"><span>DEFAULT MEMBER</span><strong>Me</strong><small>Added automatically</small></div>
      {error && <p className="trip-creation-error" role="alert">{error}</p>}
      <button className="trip-creation-submit" type="submit">{editing ? 'Save Journey' : 'Create Journey'} <ChevronDown size={15} /></button>
    </form>
  </div>;
};
