import { Account, Category } from './domain';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat_food', name: 'Food', type: 'expense' },
  { id: 'cat_transport', name: 'Transport', type: 'expense' },
  { id: 'cat_accommodation', name: 'Accommodation', type: 'expense' },
  { id: 'cat_activity', name: 'Activity', type: 'expense' },
  { id: 'cat_shopping', name: 'Shopping', type: 'expense' },
  { id: 'cat_other', name: 'Other', type: 'expense' },
  { id: 'cat_cash_exchange', name: 'Cash / Exchange', type: 'expense', excludeFromStats: true },
  { id: 'cat_income', name: 'Income', type: 'income' },
  { id: 'cat_refund', name: 'Refund', type: 'income' },
];

export const DEFAULT_TRIP_ACCOUNTS: Account[] = [
  { id: 'default-account-cash', name: 'Cash' },
  { id: 'default-account-credit-card', name: 'Credit Card' },
];

export const DEFAULT_COMMON_ACCOUNTS: Account[] = [
  { id: 'common-account-cash', name: 'Cash' },
  { id: 'common-account-credit-card', name: 'Credit Card' },
];

export const getDefaultCategories = (): Category[] =>
  DEFAULT_CATEGORIES.map((category) => ({ ...category }));

export const getDefaultTripAccounts = (): Account[] =>
  DEFAULT_TRIP_ACCOUNTS.map((account) => ({ ...account }));

export const getDefaultCommonAccounts = (): Account[] =>
  DEFAULT_COMMON_ACCOUNTS.map((account) => ({ ...account }));
