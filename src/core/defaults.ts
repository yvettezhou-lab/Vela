import { Category } from './domain';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat_food', name: 'Food', type: 'expense' },
  { id: 'cat_transport', name: 'Transport', type: 'expense' },
  { id: 'cat_accommodation', name: 'Accommodation', type: 'expense' },
  { id: 'cat_activity', name: 'Activity', type: 'expense' },
  { id: 'cat_shopping', name: 'Shopping', type: 'expense' },
  { id: 'cat_other', name: 'Other', type: 'expense' },
  { id: 'cat_cash_exchange', name: 'Cash / Exchange', type: 'expense', excludeFromStats: true },
];

export const getDefaultCategories = (): Category[] => DEFAULT_CATEGORIES.map((category) => ({ ...category }));
