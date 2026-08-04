import type { AccountType } from '@/providers/account';

export type BillingCycle = 'monthly' | 'yearly';

export type PlanDefinition = {
  type: AccountType;
  name: string;
  audience: string;
  monthly: number;
  yearly: number;
  badge?: string;
  accent: 'blue' | 'cyan' | 'amber' | 'green';
  headlineFeatures: string[];
  allFeatures: string[];
};

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    type: 'free',
    name: 'Free',
    audience: 'Start organizing your collection',
    monthly: 0,
    yearly: 0,
    accent: 'blue',
    headlineFeatures: ['500 cards', '5 decks', 'Card scanner access'],
    allFeatures: [
      'Store up to 500 cards',
      'Create up to 5 decks',
      'Card scanner access',
      'Basic card search and pricing',
      'Collection and deck builder access',
    ],
  },
  {
    type: 'collector',
    name: 'Collector',
    audience: 'Understand and organize your collection',
    monthly: 4.99,
    yearly: 49.99,
    badge: 'MOST POPULAR',
    accent: 'cyan',
    headlineFeatures: ['Unlimited collection', 'Financial insights', 'Storage locations'],
    allFeatures: [
      'Everything in Free',
      'Unlimited collection tracking',
      'Unlimited decks',
      'Collection value and price history',
      'Financial insights and market signals',
      'Storage-location tracking',
      'Trade binder and wishlist',
    ],
  },
  {
    type: 'seller',
    name: 'Seller',
    audience: 'Buy smarter and sell with confidence',
    monthly: 14.99,
    yearly: 149.99,
    accent: 'green',
    headlineFeatures: ['Full Deal Desk', 'Card-show tools', 'Web workspace'],
    allFeatures: [
      'Everything in Collector',
      'Full Deal Desk access',
      'Trade and purchase calculator',
      'Custom buying percentages',
      'Card-show sessions and budgets',
      'Sealed-product evaluator',
      'Saved buying profiles',
      'Trading Docks web workspace',
    ],
  },
  {
    type: 'store',
    name: 'Store',
    audience: 'Operate your store from one connected platform',
    monthly: 49.99,
    yearly: 499.99,
    accent: 'amber',
    headlineFeatures: ['Store Deal Desk', 'Employee access', 'Shared workflows'],
    allFeatures: [
      'Everything in Seller',
      'Store-level Deal Desk',
      'Employee accounts',
      'Shared buying profiles',
      'Staff permissions and approvals',
      'Customer-facing trade summaries',
      'Shared inventory access',
      'Trading Docks web workspace',
    ],
  },
];

export const getPlan = (type: AccountType) =>
  PLAN_DEFINITIONS.find((plan) => plan.type === type) ?? PLAN_DEFINITIONS[0];

export const formatPlanPrice = (plan: PlanDefinition, cycle: BillingCycle) => {
  if (plan.type === 'free') return '$0';
  return cycle === 'monthly' ? `$${plan.monthly.toFixed(2)}` : `$${plan.yearly.toFixed(2)}`;
};

export const annualSavings = (plan: PlanDefinition) =>
  Math.max(0, plan.monthly * 12 - plan.yearly);
