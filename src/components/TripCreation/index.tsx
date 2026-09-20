import React, { FormEvent, useMemo, useState, useEffect } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import { AllocationRule, Destination, TravelSegment, Trip } from '../../core/domain';
import { useVelaStore } from '../../store/useVelaStore';
import { deleteTripCover, isIndexedDbCoverKey, putTripCover } from '../../core/coverImageStore';
import { useTripCover } from '../../hooks/useTripCover';
import { buildAutoTripTitle } from '../../utils/tripTitle';
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
  startDateManuallySet: boolean;
};

const CURRENCIES = ['CNY', 'MYR', 'SGD', 'THB', 'IDR', 'PHP', 'JPY', 'KRW', 'USD', 'EUR', 'GBP', 'AUD', 'HKD'];
const COUNTRY_CURRENCIES: Record<string, string> = {
  af: 'AFN', al: 'ALL', dz: 'DZD', ar: 'ARS', au: 'AUD', at: 'EUR', be: 'EUR', br: 'BRL',
  kh: 'KHR', ca: 'CAD', cn: 'CNY', hr: 'EUR', cz: 'CZK', dk: 'DKK', eg: 'EGP', fi: 'EUR',
  fr: 'EUR', de: 'EUR', gr: 'EUR', hk: 'HKD', hu: 'HUF', is: 'ISK', in: 'INR', id: 'IDR',
  ie: 'EUR', il: 'ILS', it: 'EUR', jp: 'JPY', jo: 'JOD', kz: 'KZT', la: 'LAK', my: 'MYR',
  mv: 'MVR', mx: 'MXN', mn: 'MNT', ma: 'MAD', mm: 'MMK', np: 'NPR', nl: 'EUR', nz: 'NZD',
  no: 'NOK', ph: 'PHP', pl: 'PLN', pt: 'EUR', ru: 'RUB', sa: 'SAR', sg: 'SGD', za: 'ZAR',
  kr: 'KRW', es: 'EUR', lk: 'LKR', se: 'SEK', ch: 'CHF', tw: 'TWD', th: 'THB', tr: 'TRY',
  ae: 'AED', gb: 'GBP', us: 'USD', vn: 'VND',
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
const countryCurrency = (country: string) => {
  const value = country.trim().toLowerCase();
  const match = COUNTRIES.find(([en, zh, code]) =>
    en.toLowerCase() === value || zh.toLowerCase() === value || code.toLowerCase() === value
  );
  return match ? COUNTRY_CURRENCIES[match[2].toLowerCase()] ?? '' : '';
};
const parseDateValue = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
};
const formatTripDate = (value: string) => {
  const date = parseDateValue(value);
  return date ? `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日` : 'Select date';
};
const monthCells = (month: Date) => {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = first.getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, i) => {
    const day = i - offset + 1;
    return day >= 1 && day <= days ? new Date(month.getFullYear(), month.getMonth(), day) : null;
  });
};
const CompactTripDatePicker: React.FC<{ value: string; onChange: (value: string) => void; label: string }> = ({ value, onChange, label }) => {
  const selected = parseDateValue(value);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => {
    const base = selected ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const today = toDateInput(Date.now());
  const select = (date: Date) => { onChange(toDateInput(date.getTime())); setOpen(false); };
  return <div className="trip-date-picker">
    <span>{label}</span>
    <button type="button" className={`trip-date-trigger${open ? ' is-open' : ''}`} onClick={() => { const base = parseDateValue(value) ?? new Date(); setMonth(new Date(base.getFullYear(), base.getMonth(), 1)); setOpen(true); }} aria-expanded={open}>
      <CalendarDays size={14} />
      <strong>{formatTripDate(value)}</strong>
      <span className="trip-date-action">{open ? 'Done' : 'Change'}</span>
    </button>
    {open && <div className="trip-date-popover">
      <div className="trip-date-month">
        <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft size={18}/></button>
        <strong>{month.getFullYear()}年{month.getMonth() + 1}月</strong>
        <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight size={18}/></button>
      </div>
      <div className="trip-date-week">{['日','一','二','三','四','五','六'].map(d => <span key={d}>{d}</span>)}</div>
      <div className="trip-date-grid">{monthCells(month).map((date, i) => {
        if (!date) return <span key={`empty-${i}`} />;
        const v = toDateInput(date.getTime());
        const isSelected = v === value;
        const isToday = v === today;
        return <button type="button" key={v} className={isSelected ? 'selected' : isToday ? 'today' : ''} onClick={() => select(date)}>{date.getDate()}</button>;
      })}</div>
    </div>}
  </div>;
};
const makeDraftSegment = (segment?: TravelSegment): DraftSegment => ({
  id: segment?.id ?? crypto.randomUUID(),
  startDate: segment ? toDateInput(segment.startDate) : '',
  endDate: segment ? toDateInput(segment.endDate) : '',
  destinations: segment?.destinations?.length ? segment.destinations.map((destination) => ({ ...destination })) : [{ country: '', region: '', city: '' }],
  primaryCurrency: segment?.primaryCurrency ?? 'CNY',
  currencyManuallySet: Boolean(segment),
  // Existing segments are treated as intentional; newly linked segments can follow the previous end date.
  startDateManuallySet: Boolean(segment),
});

export const TripCreation: React.FC<Props> = ({ onClose, onCreated, onUpdated, trip }) => {
  const commonMembers = useVelaStore((state) => state.commonMembers);
  const commonAccounts = useVelaStore((state) => state.commonAccounts);
  const editing = Boolean(trip);
  const [title, setTitle] = useState(trip?.title ?? '');
  const [step, setStep] = useState(1);
  const [titleEdited, setTitleEdited] = useState(Boolean(trip?.titleEdited));
  const [segments, setSegments] = useState<DraftSegment[]>(() => trip?.segments.map(makeDraftSegment) ?? [makeDraftSegment()]);

  const generatedTitle = useMemo(() => {
    const draftTrip = {
      id: trip?.id ?? '__draft__',
      title: '',
      titleEdited: false,
      segments: segments.map((segment) => ({
        id: segment.id,
        startDate: toTimestamp(segment.startDate),
        endDate: toTimestamp(segment.endDate),
        destinations: segment.destinations.map((destination) => ({ ...destination })),
        primaryCurrency: segment.primaryCurrency,
      })),
      status: trip?.status ?? 'planning',
      members: [],
      accounts: [],
      categories: [],
      ledger: [],
      createdAt: trip?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    } as Trip;
    return buildAutoTripTitle(draftTrip, useVelaStore.getState().trips);
  }, [segments, trip?.id, trip?.status, trip?.createdAt]);
  useEffect(() => {
    if (!titleEdited && generatedTitle) setTitle(generatedTitle);
  }, [generatedTitle, titleEdited]);
  const [error, setError] = useState('');
  const [members, setMembers] = useState(() => trip?.members.map((member) => ({ ...member })) ?? commonMembers.filter((member) => member.archived !== true).map((member) => ({ ...member })) ?? []);
  const [accounts, setAccounts] = useState(() => trip?.accounts.map((account) => ({ ...account })) ?? commonAccounts.filter((account) => account.archived !== true).map((account) => ({ ...account })) ?? []);
  const [categories, setCategories] = useState(() => trip?.categories.map((category) => ({ ...category })) ?? []);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [allocationRules, setAllocationRules] = useState<AllocationRule | undefined>(() => trip?.allocationRules?.percentages ? { allocationMode: 'preset_percentage', percentages: { ...trip.allocationRules.percentages } } : undefined);
  const [presetPercentages, setPresetPercentages] = useState<Record<string, number>>(() => {
    if (trip?.allocationRules?.percentages) return { ...trip.allocationRules.percentages };
    const initialMembers = trip?.members?.length ? trip.members : commonMembers.filter((member) => member.archived !== true);
    const activeIds = initialMembers.map((member) => member.id);
    if (!activeIds.length) return {};
    const base = Math.floor((100 / activeIds.length) * 100) / 100;
    const percentages = Object.fromEntries(activeIds.map((id, index) => [id, index === activeIds.length - 1 ? Number((100 - base * (activeIds.length - 1)).toFixed(2)) : base]));
    return percentages;
  });
  const persistedCover = useTripCover(trip?.coverImage);
  const [newMemberName, setNewMemberName] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const availableSourceTrips = useVelaStore((state) => state.trips).filter((source) => source.status === 'achieve' && source.id !== trip?.id).sort((a, b) => b.updatedAt - a.updatedAt);

  const buildEqualPreset = (memberIds: string[]) => {
    if (!memberIds.length) return {};
    const base = Math.floor((100 / memberIds.length) * 100) / 100;
    return Object.fromEntries(memberIds.map((id, index) => [
      id,
      index === memberIds.length - 1 ? Number((100 - base * (memberIds.length - 1)).toFixed(2)) : base,
    ]));
  };
  const isEqualPreset = (memberIds: string[], percentages: Record<string, number>) => {
    if (!memberIds.length) return true;
    const expected = buildEqualPreset(memberIds);
    return memberIds.every((id) => Math.abs((Number(percentages[id]) || 0) - (expected[id] || 0)) < 0.001);
  };

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
    if (source.allocationRules?.percentages) {
      const percentages = Object.fromEntries(Object.entries(source.allocationRules.percentages ?? {}).map(([memberId, percentage]) => [memberIdMap.get(memberId) ?? '', percentage]).filter(([memberId]) => Boolean(memberId)));
      setAllocationRules({ allocationMode: 'preset_percentage', percentages });
      setPresetPercentages(percentages);
    } else {
      const customEntry = [...source.ledger].reverse().find((entry) => entry.allocationMode === 'custom_percentage');
      if (customEntry) {
        const percentages = Object.fromEntries(customEntry.allocations.map((allocation) => [memberIdMap.get(allocation.memberId) ?? '', allocation.percentage ?? 0]).filter(([memberId]) => Boolean(memberId)));
        setAllocationRules({ allocationMode: 'preset_percentage', percentages });
        setPresetPercentages(percentages);
      } else {
        setAllocationRules(undefined);
        const activeIds = clonedMembers.map((member) => member.id);
        const base = activeIds.length ? Math.floor((100 / activeIds.length) * 100) / 100 : 0;
        const percentages = Object.fromEntries(activeIds.map((id, index) => [id, index === activeIds.length - 1 ? Number((100 - base * (activeIds.length - 1)).toFixed(2)) : base]));
        setPresetPercentages(percentages);
      }
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

  const updateSegment = (index: number, patch: Partial<DraftSegment>) => setSegments((current) => {
    const next = current.map((segment, i) => i === index ? { ...segment, ...patch } : segment);
    if (Object.prototype.hasOwnProperty.call(patch, 'endDate')) {
      for (let i = index + 1; i < next.length; i++) {
        if (next[i].startDateManuallySet) break;
        next[i] = { ...next[i], startDate: next[i - 1].endDate };
      }
    }
    return next;
  });
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
  const updateCountry = (segmentIndex: number, country: string) => {
    setSegments((current) => current.map((segment, i) => {
      if (i !== segmentIndex) return segment;
      const destinations = segment.destinations.map((destination) => ({ ...destination, country }));
      const suggestedCurrency = countryCurrency(country);
      return { ...segment, destinations, ...(suggestedCurrency && !segment.currencyManuallySet ? { primaryCurrency: suggestedCurrency } : {}) };
    }));
  };
  const addDestination = (segmentIndex: number) => setSegments((current) => current.map((segment, i) => i === segmentIndex ? { ...segment, destinations: [...segment.destinations, { country: segment.destinations[0]?.country ?? '', region: '', city: '' }] } : segment));
  const removeDestination = (segmentIndex: number, destinationIndex: number) => setSegments((current) => current.map((segment, i) => {
    if (i !== segmentIndex || segment.destinations.length <= 1) return segment;
    return { ...segment, destinations: segment.destinations.filter((_, j) => j !== destinationIndex) };
  }));
  const addSegment = () => setSegments((current) => {
    const previous = current[current.length - 1];
    const next = makeDraftSegment();
    if (previous?.endDate) next.startDate = previous.endDate;
    next.startDateManuallySet = false;
    return [...current, next];
  });
  const removeSegment = (index: number) => setSegments((current) => {
    if (current.length <= 1) return current;
    const next = current.filter((_, i) => i !== index);
    // If a linked segment becomes the first segment, keep its existing start.
    // Otherwise preserve the deliberate "previous end → next start" chain.
    for (let i = Math.max(1, index); i < next.length; i++) {
      if (!next[i].startDateManuallySet) next[i] = { ...next[i], startDate: next[i - 1].endDate };
      else break;
    }
    return next;
  });

  const goToRules = () => {
    setError('');
    if (!segments.length) return setError('Please add at least one segment.');
    for (let i = 0; i < segments.length; i++) {
      const draft = segments[i];
      const start = toTimestamp(draft.startDate), end = toTimestamp(draft.endDate);
      if (!Number.isFinite(start) || !Number.isFinite(end)) return setError(`Please choose both dates for Segment ${i + 1}.`);
      if (end < start) return setError(`End date cannot be before start date in Segment ${i + 1}.`);
      if (draft.destinations.some((destination) => !destination.country.trim() && !destination.city.trim())) return setError(`Please complete the destination in Segment ${i + 1}.`);
      const segmentCountries = [...new Set(draft.destinations.map((destination) => destination.country.trim().toLowerCase()).filter(Boolean))];
      if (segmentCountries.length > 1) return setError(`Segment ${i + 1} can contain destinations in one country only. Add a new segment for the next country.`);
      if (!draft.primaryCurrency.trim()) return setError(`Please choose a primary currency for Segment ${i + 1}.`);
    }
    if (overlapPairs.length) return setError(`Segment ${overlapPairs[0][0] + 1} overlaps Segment ${overlapPairs[0][1] + 1}. Adjust the date ranges before saving.`);
    setStep(2);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const cleanTitle = title.trim() || generatedTitle;
    if (!cleanTitle) return setError('Add enough trip details to generate a title.');
    if (!segments.length) return setError('Please add at least one segment.');
    if (overlapPairs.length) return setError(`Segment ${overlapPairs[0][0] + 1} overlaps Segment ${overlapPairs[0][1] + 1}. Adjust the date ranges before saving.`);

    const normalizedSegments: TravelSegment[] = [];
    for (let i = 0; i < segments.length; i++) {
      const draft = segments[i];
      const start = toTimestamp(draft.startDate), end = toTimestamp(draft.endDate);
      if (!Number.isFinite(start) || !Number.isFinite(end)) return setError(`Please choose both dates for Segment ${i + 1}.`);
      if (end < start) return setError(`End date cannot be before start date in Segment ${i + 1}.`);
      const destinations = draft.destinations.map((destination) => ({ country: destination.country.trim(), region: destination.region?.trim() || undefined, city: destination.city.trim() }));
      if (destinations.some((destination) => !destination.country && !destination.city)) return setError(`Please complete the destination in Segment ${i + 1}.`);
      const segmentCountries = [...new Set(destinations.map((destination) => destination.country.toLowerCase()).filter(Boolean))];
      if (segmentCountries.length > 1) return setError(`Segment ${i + 1} can contain destinations in one country only. Add a new segment for the next country.`);
      if (!draft.primaryCurrency.trim()) return setError(`Please choose a primary currency for Segment ${i + 1}.`);
      normalizedSegments.push({ id: draft.id, startDate: start, endDate: end, destinations, primaryCurrency: draft.primaryCurrency.trim().toUpperCase() });
    }

    const activeMemberIds = new Set(members.filter((member) => member.archived !== true).map((member) => member.id));
    const normalizedPreset = Object.fromEntries(Object.entries(presetPercentages).filter(([memberId, percentage]) => activeMemberIds.has(memberId) && Number.isFinite(Number(percentage)) && Number(percentage) > 0).map(([memberId, percentage]) => [memberId, Number(percentage)]));
    const presetTotal = Object.values(normalizedPreset).reduce((sum, percentage) => sum + percentage, 0);
    if (Object.keys(normalizedPreset).length > 0 && Math.abs(presetTotal - 100) > 0.001) return setError('Preset allocation percentages must total 100%. Current: ' + presetTotal.toFixed(2) + '%.');
    const normalizedAllocationRules = Object.keys(normalizedPreset).length ? { allocationMode: 'preset_percentage' as const, percentages: normalizedPreset } : undefined;
    const now = Date.now();
    let storedCoverKey: string | undefined;
    try {
      setIsSaving(true);
      if (coverFile) storedCoverKey = await putTripCover(coverFile);
      const payload: Trip = {
        id: trip?.id ?? crypto.randomUUID(), title: cleanTitle, titleEdited, segments: normalizedSegments, status: trip?.status ?? 'planning', allocationRules: normalizedAllocationRules,
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
      {editing && <label><span>TRIP TITLE</span><input autoFocus value={title} onChange={(e) => { setTitleEdited(true); setTitle(e.target.value); }} placeholder={generatedTitle || 'Trip title'} /><small className="trip-title-hint">{titleEdited ? 'Custom title' : 'Auto-generated from dates & main destination'}</small></label>}
      {(step === 1 || editing) && <>
        {!editing && availableSourceTrips.length > 0 && <label className="trip-clone-settings"><span>PAST JOURNEY</span><div className="trip-select-wrap"><select defaultValue="" onChange={(e) => { const source = availableSourceTrips.find((item) => item.id === e.target.value); if (source) cloneSettingsFrom(source); }}><option value="">Optional · clone people & rules…</option>{availableSourceTrips.map((source) => <option key={source.id} value={source.id}>{source.title}</option>)}</select><ChevronDown size={14} /></div></label>}

        <div className="trip-segments">
        <div className="trip-segments-heading"><span>TRAVEL SEGMENTS</span><small>{segments.length} {segments.length === 1 ? 'segment' : 'segments'}</small></div>
        {segments.map((segment, segmentIndex) => {
          const overlaps = overlapPairs.some(([a, b]) => a === segmentIndex || b === segmentIndex);
          return <div className={`trip-segment ${overlaps ? 'is-overlapping' : ''}`} key={segment.id}>
            <div className="trip-segment-head"><strong>SEGMENT {segmentIndex + 1}</strong>{segments.length > 1 && <button type="button" className="trip-icon-button" onClick={() => removeSegment(segmentIndex)} aria-label={`Remove segment ${segmentIndex + 1}`}><Trash2 size={14} /></button>}</div>
            <div className={`trip-creation-dates${segmentIndex > 0 && !segment.startDateManuallySet ? ' is-linked' : ''}`}>
              <div className="trip-linked-start">
                <CompactTripDatePicker label={segmentIndex > 0 && !segment.startDateManuallySet ? 'START · FOLLOWS PREVIOUS END' : 'START'} value={segment.startDate} onChange={(value) => updateSegment(segmentIndex, { startDate: value, startDateManuallySet: true })} />
                {segmentIndex > 0 && !segment.startDateManuallySet && <span>Linked to Segment {segmentIndex} end</span>}
                {segmentIndex > 0 && segment.startDateManuallySet && <button type="button" onClick={() => updateSegment(segmentIndex, { startDate: segments[segmentIndex - 1].endDate, startDateManuallySet: false })}>Use previous end</button>}
              </div>
              <CompactTripDatePicker label="END" value={segment.endDate} onChange={(value) => updateSegment(segmentIndex, { endDate: value })} />
            </div>
            {overlaps && <p className="trip-segment-inline-error" role="alert">This date range overlaps another segment. Segments must not overlap.</p>}
            <div className="trip-destination-section">
              <div className="trip-segment-country">
                <span className="trip-field-label">COUNTRY</span>
                <div className="trip-country-autocomplete"><input aria-label={"Segment " + (segmentIndex + 1) + " country"} value={segment.destinations[0]?.country ?? ""} onChange={(e) => updateCountry(segmentIndex, e.target.value)} placeholder="Country" list={"vela-country-" + segment.id} /><datalist id={"vela-country-" + segment.id}>{countryMatches(segment.destinations[0]?.country ?? "").map(([en, zh, code]) => <option key={code || en} value={en}>{zh}{code ? " · " + code : ""}</option>)}</datalist></div>
                <small>One country per segment</small>
              </div>
              <span className="trip-field-label">DESTINATIONS</span>
              {segment.destinations.map((destination, destinationIndex) => <div className={`trip-destination-row${segment.destinations.length > 1 ? ' has-remove' : ''}`} key={destinationIndex}>
                <input aria-label={"Segment " + (segmentIndex + 1) + " destination " + (destinationIndex + 1)} value={destination.city} onChange={(e) => updateDestination(segmentIndex, destinationIndex, { city: e.target.value })} placeholder="City / place" />
                {destinationIndex < segment.destinations.length - 1 ? <button type="button" className="trip-icon-button trip-destination-remove" onClick={() => removeDestination(segmentIndex, destinationIndex)} aria-label="Remove destination"><X size={13} /></button> : null}
              </div>)}
              <button type="button" className="trip-add-city" onClick={() => addDestination(segmentIndex)}><Plus size={14} /> Add destination</button>
            </div>
            <label><span>PRIMARY CURRENCY</span><div className="trip-select-wrap"><select value={segment.primaryCurrency} onChange={(e) => updateSegment(segmentIndex, { primaryCurrency: e.target.value, currencyManuallySet: true })}>{CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select><ChevronDown size={14} /></div></label>
          </div>;
        })}
        <button type="button" className="trip-add-segment" onClick={addSegment}>+ Add segment</button>
      </div>

      <div className="trip-cover-field trip-cover-field-compact">
        <span className="trip-field-label">COVER</span>
        <div className="trip-cover-compact-row">
          <label className="trip-cover-compact-action">{coverFile || persistedCover ? 'Change cover' : 'Add cover'}<input type="file" accept="image/*" onChange={(e) => selectCover(e.target.files?.[0])} /></label>
          {(coverFile || persistedCover) && <button type="button" className="trip-cover-clear" onClick={clearSelectedCover}>Remove</button>}
        </div>
      </div>

      {!editing && <button type="button" className="trip-creation-submit trip-next-button" onClick={goToRules}>Next <ChevronDown size={15} /></button>}
      </>}
      {(editing || step === 2) && <>
        <section className="trip-allocation-rules">
        <span className="trip-field-label">PEOPLE &amp; ALLOCATION</span>
        <small className="trip-allocation-hint">设置这次 Trip 的参与人员和默认分摊比例。Quick Entry 可直接选择“按设定比例”。</small>
        <div className="trip-member-add-row"><input value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} placeholder="Add person to this trip" onKeyDown={(e) => { if (e.key === 'Enter') { const name = newMemberName.trim(); if (name && !members.some((member) => !member.archived && member.name.toLowerCase() === name.toLowerCase())) {
              const id = crypto.randomUUID();
              const activeIds = members.filter((member) => member.archived !== true).map((member) => member.id);
              const shouldRebalance = isEqualPreset(activeIds, presetPercentages);
              setMembers((current) => [...current, { id, name }]);
              setPresetPercentages((current) => shouldRebalance ? buildEqualPreset([...activeIds, id]) : ({ ...current, [id]: 0 }));
              setNewMemberName('');
            } } }} /><button type="button" onClick={() => { const name = newMemberName.trim(); if (!name || members.some((member) => !member.archived && member.name.toLowerCase() === name.toLowerCase())) return; const id = crypto.randomUUID();
              const activeIds = members.filter((member) => member.archived !== true).map((member) => member.id);
              const shouldRebalance = isEqualPreset(activeIds, presetPercentages);
              setMembers((current) => [...current, { id, name }]);
              setPresetPercentages((current) => shouldRebalance ? buildEqualPreset([...activeIds, id]) : ({ ...current, [id]: 0 }));
              setNewMemberName('');
            }}>+ Add</button></div>
        <div className="trip-allocation-list">
          {members.filter((member) => member.archived !== true).map((member) => (
            <label key={member.id} className="trip-allocation-row">
              <strong>{member.name}</strong>
              <span><input type="number" min="0" max="100" step="0.01" value={presetPercentages[member.id] ?? ""} onChange={(e) => setPresetPercentages((current) => ({ ...current, [member.id]: e.target.value === "" ? 0 : Number(e.target.value) }))} aria-label={member.name + " preset percentage"} /> %</span>
            </label>
          ))}
        </div>
        <div className="trip-allocation-total">Total {Object.values(presetPercentages).reduce((sum, value) => sum + (Number(value) || 0), 0).toFixed(2)}%</div>
        </section>
        <section className="trip-account-rules">
          <span className="trip-field-label">ACCOUNTS</span>
          <small className="trip-allocation-hint">记录这次旅行实际会用到的支付账户。默认账户已提前准备好。</small>
          <div className="trip-member-add-row">
            <input
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              placeholder="Add account to this trip"
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                const name = newAccountName.trim();
                if (!name || accounts.some((account) => !account.archived && account.name.toLowerCase() === name.toLowerCase())) return;
                setAccounts((current) => [...current, { id: crypto.randomUUID(), name }]);
                setNewAccountName('');
              }}
            />
            <button type="button" onClick={() => {
              const name = newAccountName.trim();
              if (!name || accounts.some((account) => !account.archived && account.name.toLowerCase() === name.toLowerCase())) return;
              setAccounts((current) => [...current, { id: crypto.randomUUID(), name }]);
              setNewAccountName('');
            }}>+ Add</button>
          </div>
          <div className="trip-account-list">
            {accounts.filter((account) => account.archived !== true).map((account) => (
              <div className="trip-account-row" key={account.id}>
                <strong>{account.name}</strong>
                {accounts.filter((item) => item.archived !== true).length > 1 && (
                  <button type="button" className="trip-icon-button" onClick={() => setAccounts((current) => current.map((item) => item.id === account.id ? { ...item, archived: true } : item))} aria-label={"Remove " + account.name}>
                    <X size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      </>}
      {!editing && step === 2 && <div className="trip-creation-step-actions"><button type="button" className="trip-secondary-action" onClick={() => { setError(''); setStep(1); }}>Back</button><button className="trip-creation-submit" type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : 'Create Journey'} <ChevronDown size={15} /></button></div>}
      {editing && <button className="trip-creation-submit" type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : 'Save Journey'} <ChevronDown size={15} /></button>}
      {error && <p className="trip-creation-error" role="alert">{error}</p>}
    </form>
  </div>;
};
