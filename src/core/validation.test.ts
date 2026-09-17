import { describe, expect, it } from 'vitest';
import { DomainValidator } from './validation';
import type { Trip } from './domain';

const trip = (id: string, status: Trip['status']): Trip => ({
  id,
  title: id,
  destination: '',
  startDate: 0,
  endDate: 1,
  status,
  localCurrency: 'CNY',
  members: [],
  accounts: [],
  categories: [],
  ledger: [],
  createdAt: 0,
  updatedAt: 0,
});

describe('trip lifecycle', () => {
  it('allows planning → traveling', () => {
    expect(() => DomainValidator.validateTripStatus([trip('a', 'planning')], 'a', 'traveling', 'planning')).not.toThrow();
  });

  it('allows traveling → achieve', () => {
    expect(() => DomainValidator.validateTripStatus([trip('a', 'traveling')], 'a', 'achieve', 'traveling')).not.toThrow();
  });

  it('rejects planning → achieve so the lifecycle remains sequential', () => {
    expect(() => DomainValidator.validateTripStatus([trip('a', 'planning')], 'a', 'achieve', 'planning')).toThrow(/Cannot transition from planning to achieve/);
  });

  it('rejects starting a second traveling trip', () => {
    expect(() => DomainValidator.validateTripStatus([trip('active', 'traveling'), trip('next', 'planning')], 'next', 'traveling', 'planning')).toThrow(/Only one traveling trip allowed/);
  });

  it('rejects reopening an achieved trip', () => {
    expect(() => DomainValidator.validateTripStatus([trip('a', 'achieve')], 'a', 'traveling', 'achieve')).toThrow(/Cannot transition from achieve to traveling/);
  });
});
