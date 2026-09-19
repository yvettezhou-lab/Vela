import React, { FormEvent, useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, Plus, Trash2, X } from 'lucide-react';
import { AllocationRule, Destination, TravelSegment, Trip } from '../../core/domain';
import { useVelaStore } from '../../store/useVelaStore';
import { deleteTripCover, isIndexedDbCoverKey, putTripCover } from '../../core/coverImageStore';
import { useTripCover } from '../../hooks/useTripCover';
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
const COUNTRIES = [
  ['Afghanistan','阿富汗','AF'], ['Albania','阿尔巴尼亚','AL'], ['Algeria','阿尔及利亚','DZ'], ['Argentina','阿根廷','AR'],
  ['Australia','澳大利亚','AU'], ['Austria','奥地利','AT'], ['Belgium','比利时','BE'], ['Brazil','巴西','BR'],
  ['Cambodia','柬埔寨','KH'], ['Canada','加拿大','CA'], ['China','中国','CN'], ['Croatia','克罗地亚','HR'],
  ['Czechia','捷克','CZ'], ['Denmark','丹麦','DK'], ['Egypt','埃及','EG'], ['Finland','芬兰','FI'],
  ['France','法国','FR'], ['Germany','德国','DE'], ['Greece','希腊','GR'], ['Hong Kong','中国香港','HK'],
  ['Hungary','匈牙利','HU'], ['Iceland','冰岛','IS'], ['India','印度','IN'], ['Indonesia','印度尼西亚','ID'],
  ['Ireland','爱尔兰','IE'], ['Israel','以色列','IL'], ['Italy','意大利','IT'], ['Japan','日本','JP'],
  ['Jordan','约旦','JO'], ['Kazakhstan','哈萨克斯坦','KZ'], ['Laos','老挝','LA'], ['Malaysia','马来西亚','MY'],
  ['Maldives','马尔代夫','MV'], ['Mexico','墨西哥','MX'], ['Mongolia','蒙古','MN'], ['Morocco','摩洛哥','MA'],
  ['Myanmar','缅甸','MM'], ['Nepal','尼泊尔','NP'], ['Netherlands','荷兰','NL'], ['New Zealand','新西兰','NZ'],
  ['Norway','挪威','NO'], ['Philippines','菲律宾','PH'], ['Poland','波兰','PL'], ['Portugal','葡萄牙','PT'],
  ['Russia','俄罗斯','RU'], ['Saudi Arabia','沙特阿拉伯','SA'], ['Singapore','新加坡','SG'], ['South Africa','南非','ZA'],
  ['South Korea','韩国','KR'], ['Spain','西班牙','ES'], ['Sri Lanka','斯里兰卡','LK'], ['Sweden','瑞典','SE'],
  ['Switzerland','瑞士','CH'], ['Taiwan','中国台湾','TW'], ['Thailand','泰国','TH'], ['Turkey','土耳其','TR'],
  ['United Arab Emirates','阿联酋','AE'], ['United Kingdom','英国','GB'], ['United States','美国','US'],
  ['Vietnam','越南','VN'], ['Other','其他','']
] as const;

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
  const [members, setMembers] = useState(() => trip?.members.map((member) => ({ ...member })) ?? []);
  const [accounts, setAccounts] = useState(() => trip?.accounts.map((account) => ({ ...account })) ?? []);
  const [categories, setCategories] = useState(() => trip?.categories.map((category) => ({ ...category })) ?? []);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [allocationRules, setAllocationRules] = useState<AllocationRule | undefined>(() => trip?.allocationRules ? { allocationMode: trip.allocationRules.allocationMode, percentages: trip.allocationRules.percentages ? { ...trip.allocationRules.percentages } : undefined } : undefined);
  const persistedCover = useTripCover(trip?.coverImage);
  const availableSourceTrips = useVelaStore((state) => state.trips).filter((source) => source.status === 'achieve' && source.id !== trip?.id).sort((a, b) => b.updatedAt - a.updatedAt);

  const overlapPairs = useMemo(() => {
    const ranges = segments.map((segment, index) => ({ index, start: toTimestamp(segment.startDate), end: toTimestamp(segment.endDate) }))
      .filter((range) => Number.isFinite(range.start) && Number.isFinite(range.end) && range.start <= range.end);
    const pairs: [number, number][] = [];
    for (let i = 0; i < ranges.length; i++) for (let j = i + 1; j < ranges.length; j++)
      if (ranges[i].start < ranges[j].end && ranges[j].start < ranges[i].end) pairs.push([ranges[i].index, ranges[j].index]);
    return pairs;
  }, [segments]);

  const cloneSettingsFrom = (source: Trip) => {
    const memberIdMap = new Map<string, string>();
    const clonedMembers = source.members.map((member) => { const id = crypto.randomUUID(); memberIdMap.set(member.id, id); return { ...member, id }; });
    setMembers(clonedMembers);
    setAccounts(source.accounts.map((account) => ({ ...account, id: crypto.randomUUID() })));
    setCategories(source.categories.map((category) => ({ ...category })));
    if (source.allocationRules) {
      const percentages = source.allocationRules.percentages ? Object.fromEntries(Object.entries(source.allocationRules.percentages).map(([memberId, percentage]) => [memberIdMap.get(memberId) ?? crypto.randomUUID(), percentage])) : undefined;
      setAllocationRules({ allocationMode: source.allocationRules.allocationMode, percentages });
    } else {
      const customEntry = [...source.ledger].reverse().find((entry) => entry.allocationMode === 'custom_percentage');
      if (customEntry) {
        setAllocationRules({ allocationMode: 'custom_percentage', percentages: Object.fromEntries(customEntry.allocations.map((allocation) => [memberIdMap.get(allocation.memberId) ?? '', allocation.percentage ?? 0]).filter(([memberId]) => Boolean(memberId))) });
      } else setAllocationRules(undefined);
    }
  };

  const selectCover = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Please choose an image file.');
    if (file.size > 8 * 1024 * 1024) return setError('Cover image must be 8 MB or smaller.');
    setError('');
    setCoverFile(file);
    setCoverPreview((current) => { if (current) URL.revokeObjectURL(current); return URL.createObjectURL(file); });
  };

  const clearSelectedCover = () => {
    setCoverFile(null);
    setCoverPreview((current) => { if (current) URL.revokeObjectURL(current); return null; });
  };

  const updateSegment = (index: number, patch: Partial<DraftSegment>) =>
    setSegments((current) => current.map((segment, i) => i === index ? { ...segment, ...patch } : segment));
  const countryMatches = (value: string) => {
    const q = value.trim().toLowerCase();
    if (!q) return COUNTRIES.slice(0, 12);
    return COUNTRIES.filter(([en, zh, code]) => en.toLowerCase().includes(q) || zh.includes(q) || code.toLowerCase() === q || code.toLowerCase().includes(q)).slice(0, 12);
  };

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

  const submit = async (event: FormEvent) => {
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
    let storedCoverKey: string | undefined;
    try {
      setIsSaving(true);
      if (coverFile) storedCoverKey = await putTripCover(coverFile);
      const payload: Trip = {
        id: trip?.id ?? crypto.randomUUID(), title: cleanTitle, segments: normalizedSegments, status: trip?.status ?? 'planning', allocationRules,
        coverImage: storedCoverKey ?? trip?.coverImage, members: editing ? members : (members.length ? members : [{ id: crypto.randomUUID(), name: 'Me' }]),
        accounts, categories, ledger: trip?.ledger ?? [], createdAt: trip?.createdAt ?? now, updatedAt: now,
      };
      if (editing && trip) {
        useVelaStore.getState().updateTrip(trip.id, payload);
        if (storedCoverKey && trip.coverImage && isIndexedDbCoverKey(trip.coverImage)) await deleteTripCover(trip.coverImage);
      } else useVelaStore.getState().addTrip(payload);
      clearSelectedCover();
      editing ? onUpdated?.() : onCreated?.();
    } catch (submissionError) {
      if (storedCoverKey) await deleteTripCover(storedCoverKey).catch(() => undefined);
      setError(submissionError instanceof Error ? submissionError.message : 'Unable to save this journey.');
    } finally { setIsSaving(false); }
  };

  return <div className="trip-creation-modal" role="dialog" aria-modal="true" aria-labelledby="trip-creation-title">
    <div className="trip-creation-head">
      <div><span>VELA · {editing ? 'EDIT JOURNEY' : 'NEW JOURNEY'}</span><h2 id="trip-creation-title">{editing ? 'Refine your course.' : 'Set your course.'}</h2></div>
      <button type="button" onClick={onClose} aria-label="Close"><X size={19} /></button>
    </div>
    <form onSubmit={submit}>
      <label><span>TRIP TITLE</span><input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Penang" /></label>
      {!editing && availableSourceTrips.length > 0 && <label className="trip-clone-settings"><span>SETTINGS</span><div className="trip-select-wrap"><select defaultValue="" onChange={(e) => { const source = availableSourceTrips.find((item) => item.id === e.target.value); if (source) cloneSettingsFrom(source); }}><option value="">Clone settings from a past journey…</option>{availableSourceTrips.map((source) => <option key={source.id} value={source.id}>{source.title}</option>)}</select><ChevronDown size={14} /></div><small>Copies people, categories, accounts and saved allocation rules. Historical data is never copied.</small></label>}

      <div className="trip-cover-field">
        <span className="trip-field-label">COVER IMAGE</span>
        <div className="trip-cover-picker">
          <div className="trip-cover-preview"><img src={coverPreview || persistedCover || '/896DCF5B-31E2-44AA-ADEB-1A9E019FC6FC.png'} alt="" /></div>
          <div className="trip-cover-actions"><label className="trip-cover-upload">Choose image<input type="file" accept="image/*" onChange={(e) => selectCover(e.target.files?.[0])} /></label>{coverPreview && <button type="button" className="trip-cover-clear" onClick={clearSelectedCover}>Remove selection</button>}<small>Stored locally in IndexedDB · max 8 MB</small></div>
        </div>
      </div>

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
                <div className="trip-country-autocomplete"><input aria-label={`Segment ${segmentIndex + 1} country ${destinationIndex + 1}`} value={destination.country} onChange={(e) => updateCountry(segmentIndex, destinationIndex, e.target.value)} placeholder="Country" list={`vela-country-${segment.id}-${destinationIndex}`} /><datalist id={`vela-country-${segment.id}-${destinationIndex}`}>{countryMatches(destination.country).map(([en, zh, code]) => <option key={code || en} value={en}>{zh}{code ? ` · ${code}` : ""}</option>)}</datalist></div>
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
      <button className="trip-creation-submit" type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : editing ? 'Save Journey' : 'Create Journey'} <ChevronDown size={15} /></button>
    </form>
  </div>;
};
