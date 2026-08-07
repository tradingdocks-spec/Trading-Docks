import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';

import { TDBadge, TDButton, TDCard, TDIconButton, TDListRow, TDMetric, TDNavigationHeader, TDSegmentedControl, TDStatusIndicator, TDText } from '@/components/design-system';
import { space } from '@/design';
import { annualSavings, BillingCycle, formatPlanPrice, getPlan, PLAN_DEFINITIONS } from '@/constants/plans';
import { AccountType, useAccount } from '@/providers/account';

const icons: Record<AccountType, keyof typeof Ionicons.glyphMap> = {
  free: 'sparkles-outline',
  collector: 'diamond-outline',
  seller: 'storefront-outline',
  store: 'business-outline',
};

export default function Plans() {
  const { accountType, setAccountType } = useAccount();
  const [cycle, setCycle] = useState<BillingCycle>('yearly');
  const [expanded, setExpanded] = useState<AccountType | null>(accountType);
  const selectedPlan = useMemo(() => getPlan(accountType), [accountType]);

  const choosePlan = async (type: AccountType) => {
    await setAccountType(type);
    setExpanded(type);
  };

  const continueWithPlan = () => {
    if (selectedPlan.type === 'free') {
      router.push('/auth');
      return;
    }
    Alert.alert(
      `${selectedPlan.name} selected`,
      `${cycle === 'yearly' ? formatPlanPrice(selectedPlan, 'yearly') + ' per year' : formatPlanPrice(selectedPlan, 'monthly') + ' per month'} is not available for purchase in this mobile build. Create an account now and review upgrade options later.`,
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Create account', onPress: () => router.push('/auth') },
      ],
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <TDNavigationHeader
          eyebrow="Membership"
          title="Choose your plan"
          subtitle="Pricing and entitlements come from the canonical Trading Docks membership catalog."
          leftAction={<TDIconButton label="Back" iconName="chevron-back" onPress={() => router.back()} />}
          rightAction={<TDBadge tone="info">{selectedPlan.name}</TDBadge>}
        />

        <TDCard variant="floating" style={s.hero}>
          <View style={s.summary}>
            <TDMetric label="Current" value={selectedPlan.name} tone="info" compact />
            <TDMetric label="Price" value={formatPlanPrice(selectedPlan, cycle)} compact />
          </View>
          <TDSegmentedControl
            label="Billing cycle"
            options={[
              { value: 'monthly', label: 'Monthly' },
              { value: 'yearly', label: 'Yearly' },
            ]}
            value={cycle}
            onChange={setCycle}
          />
          <TDStatusIndicator label={selectedPlan.type === 'free' ? 'No payment method required' : 'Mobile purchase flow pending release approval'} tone={selectedPlan.type === 'free' ? 'success' : 'warning'} />
        </TDCard>

        <View style={s.planStack}>
          {PLAN_DEFINITIONS.map((plan) => {
            const selected = accountType === plan.type;
            const open = expanded === plan.type;
            const savings = annualSavings(plan);
            return (
              <View key={plan.type} style={s.planGroup}>
                <TDListRow
                  title={plan.name}
                  eyebrow={selected ? 'Current plan' : plan.type === 'free' ? 'Free' : 'Upgrade path'}
                  description={`${formatPlanPrice(plan, cycle)} ${plan.type === 'free' ? 'forever' : cycle === 'monthly' ? 'per month' : 'per year'} - ${plan.audience}`}
                  iconName={icons[plan.type]}
                  selected={selected}
                  onPress={() => choosePlan(plan.type)}
                  right={<TDBadge tone={selected ? 'success' : 'neutral'}>{selected ? 'Current' : 'Select'}</TDBadge>}
                />
                <View style={s.featureList}>
                  {plan.headlineFeatures.slice(0, 4).map((feature) => (
                    <TDText key={feature} variant="caption" tone="muted">- {feature}</TDText>
                  ))}
                  {plan.type !== 'free' && cycle === 'yearly' ? <TDText variant="caption" tone="success">Save ${savings.toFixed(2)} every year.</TDText> : null}
                  <TDButton label={open ? 'Hide full details' : 'See plan details'} variant="ghost" size="sm" onPress={() => setExpanded(open ? null : plan.type)} />
                  {open ? (
                    <View style={s.expanded}>
                      {plan.allFeatures.map((feature) => <TDText key={feature} variant="caption" tone="secondary">- {feature}</TDText>)}
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>

        <TDButton label={selectedPlan.type === 'free' ? 'Start Free' : `Continue with ${selectedPlan.name}`} iconName="arrow-forward" onPress={continueWithPlan} />
        <TDText variant="caption" tone="muted" style={s.finePrint}>
          Store employee capacity remains configurable until product ownership finalizes seat packaging. Paid mobile upgrades are not processed in this build.
        </TDText>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  content: { gap: space.lg, padding: space.lg, paddingTop: space.xl, paddingBottom: space.xxl },
  hero: { gap: space.md },
  summary: { flexDirection: 'row', gap: space.sm },
  planStack: { gap: space.md },
  planGroup: { gap: space.xs },
  featureList: { gap: space.xs, paddingLeft: space.sm },
  expanded: { gap: space.xs, paddingTop: space.xs },
  finePrint: { textAlign: 'center' },
});
