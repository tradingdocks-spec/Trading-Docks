import {
  MEMBERSHIP_PLANS,
  annualSavings as catalogAnnualSavings,
  normalizeAccountType,
  type AccountType,
} from '@/services/membership-catalog';

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

const audienceByPlan: Record<AccountType, string> = {
  free: 'Start organizing your collection',
  collector: 'Understand and organize your collection',
  seller: 'Buy smarter and sell with confidence',
  store: 'Operate your store from one connected platform',
};

const accentByPlan: Record<AccountType, PlanDefinition['accent']> = {
  free: 'blue',
  collector: 'cyan',
  seller: 'green',
  store: 'amber',
};

export const PLAN_DEFINITIONS: PlanDefinition[] = ([
  'free',
  'collector',
  'seller',
  'store',
] as const).map((type) => {
  const plan = MEMBERSHIP_PLANS[type];
  return {
    type,
    name: plan.name,
    audience: audienceByPlan[type],
    monthly: plan.monthlyPrice,
    yearly: plan.annualPrice,
    badge: type === 'collector' ? 'MOST POPULAR' : undefined,
    accent: accentByPlan[type],
    headlineFeatures: plan.headlineFeatures,
    allFeatures: plan.features,
  };
});

export const getPlan = (type: AccountType) =>
  PLAN_DEFINITIONS.find((plan) => plan.type === normalizeAccountType(type)) ?? PLAN_DEFINITIONS[0];

export const formatPlanPrice = (plan: PlanDefinition, cycle: BillingCycle) => {
  if (plan.type === 'free') return '$0';
  return cycle === 'monthly' ? `$${plan.monthly.toFixed(2)}` : `$${plan.yearly.toFixed(2)}`;
};

export const annualSavings = (plan: PlanDefinition) =>
  catalogAnnualSavings(plan.type);
