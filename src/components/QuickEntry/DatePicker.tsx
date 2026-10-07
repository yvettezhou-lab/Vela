import React, { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { toDateValue } from '../../utils/date';

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  required?: boolean;
  pickerId: string;
  openPickerId: string | null;
  onOpenPicker: (pickerId: string | null) => void;
  openMonthValue?: string;
  minDate?: string;
  maxDate?: string;
}

const parseDateValue = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
};

const formatPickerDate = (value: string) => {
  const date = parseDateValue(value);
  return date ? `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Select date';
};

const getMonthCells = (month: Date) => {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return Array.from({ length: Math.ceil((startOffset + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - startOffset + 1;
    return day >= 1 && day <= daysInMonth ? new Date(month.getFullYear(), month.getMonth(), day) : null;
  });
};

export const DatePicker: React.FC<DatePickerProps> = ({ value, onChange, label, required, pickerId, openPickerId, onOpenPicker, openMonthValue, minDate, maxDate }) => {
  const selectedDate = parseDateValue(value);
  const open = openPickerId === pickerId;
  const [viewMonth, setViewMonth] = useState(() => {
    const base = selectedDate ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const monthCells = getMonthCells(viewMonth);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!pickerRef.current?.contains(target)) onOpenPicker(null);
    };
    document.addEventListener('pointerdown', handleOutsidePointerDown);
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown);
  }, [open, onOpenPicker]);
  useEffect(() => {
    if (!open) return;
    const base = parseDateValue(value) ?? parseDateValue(openMonthValue ?? '') ?? parseDateValue(minDate ?? '') ?? new Date();
    setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1));
  }, [open, value, openMonthValue, minDate]);

  const today = toDateValue(new Date());
  const selectedValue = selectedDate ? toDateValue(selectedDate) : '';

  const openPicker = () => {
    if (open) {
      onOpenPicker(null);
      return;
    }
    const base = parseDateValue(value) ?? parseDateValue(openMonthValue ?? '') ?? new Date();
    setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    onOpenPicker(pickerId);
  };

  const chooseDate = (date: Date) => {
    onChange(toDateValue(date));
    onOpenPicker(null);
  };

  return (
    <div
      ref={pickerRef}
      className={[
        'trip-date-picker',
        'quick-entry-date-picker',
        label === 'Return' || label === 'Usage End'
          ? 'quick-entry-date-picker-end'
          : '',
        label === 'Usage Start' || label === 'Usage End'
          ? 'quick-entry-date-picker-above'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span>{label}</span>
      <button type="button" className={`trip-date-trigger${open ? ' is-open' : ''}`} onClick={openPicker} aria-expanded={open} aria-haspopup="dialog">
        <Calendar size={15} />
        <strong>{formatPickerDate(value)}</strong>
        <span className="trip-date-action">{open ? 'Done' : 'Change'}</span>
      </button>

      {open && (
        <div className="trip-date-popover" role="dialog" aria-label={`${label} calendar`}>
          <div className="trip-date-month">
      <button
        type="button"
        className={`trip-date-trigger${open ? ' is-open' : ''}`}
        onClick={openPicker}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
            <strong>{viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</strong>
            <button
              type="button"
              onClick={() =>
                setViewMonth(
                  new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1),
                )
              }
              aria-label="Previous month"
            >
              <ChevronLeft size={18} />
            </button>
          </div>
          <div className="trip-date-week">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="trip-date-grid">
            {monthCells.map((date, index) => {
              if (!date) return <span key={`empty-${index}`} className="trip-date-empty" />;
              const dateValue = toDateValue(date);
              const selected = dateValue === selectedValue;
              const isToday = dateValue === today;
              const outOfRange = (minDate && dateValue < minDate) || (maxDate && dateValue > maxDate);
              return (
                <button
                  key={dateValue}
                  type="button"
                  onClick={() => !outOfRange && chooseDate(date)}
                  disabled={Boolean(outOfRange)}
                  aria-label={dateValue}
                  aria-pressed={selected}
                  className={[
                    'trip-date-day',
                    selected ? 'selected' : isToday ? 'today' : '',
                    outOfRange ? 'disabled' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
          {required && !value && <p className="pt-1 text-center text-xs text-[#9a8f80]">Select a date</p>}
        </div>
      )}
    </div>
  );
};

