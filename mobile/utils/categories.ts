export interface CategoryInfo {
  name: string;
  subcategories: string[];
  icon: string; // Icon identifier for display
  color: string; // Color code for UI cards
}

export const DEFAULT_EXPENSE_CATEGORIES: CategoryInfo[] = [
  {
    name: 'Food',
    subcategories: ['Tiffin', 'Restaurant', 'Grocery', 'Snacks', 'Tea/Coffee'],
    icon: 'coffee',
    color: '#f59e0b', // Amber
  },
  {
    name: 'Travel',
    subcategories: ['Petrol', 'Bus', 'Train', 'Auto', 'Cab', 'Parking'],
    icon: 'car',
    color: '#3b82f6', // Blue
  },
  {
    name: 'Shopping',
    subcategories: ['Clothes', 'Electronics', 'Household', 'Other'],
    icon: 'shopping-bag',
    color: '#ec4899', // Pink
  },
  {
    name: 'Bills',
    subcategories: ['Electricity', 'Water', 'Internet', 'Mobile', 'Other'],
    icon: 'file-text',
    color: '#06b6d4', // Cyan
  },
  {
    name: 'Education',
    subcategories: ['Fees', 'Books', 'Courses', 'Other'],
    icon: 'book',
    color: '#8b5cf6', // Purple
  },
  {
    name: 'Health',
    subcategories: ['Medicine', 'Doctor', 'Tests', 'Other'],
    icon: 'activity',
    color: '#ef4444', // Red
  },
  {
    name: 'Entertainment',
    subcategories: ['Movies', 'Games', 'Subscriptions', 'Other'],
    icon: 'film',
    color: '#f43f5e', // Rose
  },
  {
    name: 'Recharge',
    subcategories: ['Mobile', 'DTH', 'Other'],
    icon: 'smartphone',
    color: '#10b981', // Emerald
  },
  {
    name: 'Rent',
    subcategories: ['Room Rent', 'House Rent', 'Other'],
    icon: 'home',
    color: '#64748b', // Slate
  },
  {
    name: 'Personal',
    subcategories: ['Other'],
    icon: 'user',
    color: '#a855f7', // Purple-light
  },
  {
    name: 'Other',
    subcategories: ['General'],
    icon: 'grid',
    color: '#94a3b8', // Gray-blue
  },
];

export const DEFAULT_INCOME_CATEGORIES: string[] = [
  'Salary',
  'Freelance',
  'Business',
  'Pocket Money',
  'Gift',
  'Interest',
  'Other',
];
