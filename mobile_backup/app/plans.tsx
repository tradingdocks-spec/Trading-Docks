import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { brand as B } from '@/constants/brand';
import { annualSavings, BillingCycle, formatPlanPrice, getPlan, PLAN_DEFINITIONS } from '@/constants/plans';
import { AccountType, useAccount } from '@/providers/account';

const accentMap = { blue: B.blue, cyan: B.cyan, green: B.green, amber: B.amber } as const;

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
      `${cycle === 'yearly' ? formatPlanPrice(selectedPlan, 'yearly') + ' per year' : formatPlanPrice(selectedPlan, 'monthly') + ' per month'} will be connected to Apple App Store and Google Play billing through RevenueCat.`,
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Create account', onPress: () => router.push('/auth') },
      ],
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Ionicons name="chevron-back" size={22} color={B.text} />
        </Pressable>

        <Text style={s.kicker}>YOUR MEMBERSHIP</Text>
        <Text style={s.title}>Choose the workspace built for your next stage.</Text>
        <Text style={s.sub}>Every plan uses the same polished Trading Docks experience. The tools adapt to the way you collect, sell, or run a store.</Text>

        <View style={s.toggleWrap}>
          <Pressable onPress={() => setCycle('monthly')} style={[s.toggle, cycle === 'monthly' && s.toggleActive]}>
            <Text style={[s.toggleText, cycle === 'monthly' && s.toggleTextActive]}>Monthly</Text>
          </Pressable>
          <Pressable onPress={() => setCycle('yearly')} style={[s.toggle, cycle === 'yearly' && s.toggleActive]}>
            <Text style={[s.toggleText, cycle === 'yearly' && s.toggleTextActive]}>Yearly</Text>
            <Text style={s.savePill}>2 MONTHS FREE</Text>
          </Pressable>
        </View>

        <View style={s.planStack}>
          {PLAN_DEFINITIONS.map((plan) => {
            const selected = accountType === plan.type;
            const open = expanded === plan.type;
            const accent = accentMap[plan.accent];
            const savings = annualSavings(plan);
            return (
              <Pressable
                key={plan.type}
                onPress={() => choosePlan(plan.type)}
                style={({ pressed }) => [s.planCard, selected && { borderColor: accent }, pressed && s.pressed]}
              >
                <View style={s.planHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={s.nameRow}>
                      <Text style={s.planName}>{plan.name}</Text>
                      {plan.badge ? <Text style={[s.planBadge, { backgroundColor: accent }]}>{plan.badge}</Text> : null}
                    </View>
                    <Text style={s.audience}>{plan.audience}</Text>
                  </View>
                  <View style={[s.selector, selected && { borderColor: accent, backgroundColor: accent }]}>
                    {selected ? <Ionicons name="checkmark" size={15} color={B.bg} /> : null}
                  </View>
                </View>

                <View style={s.priceLine}>
                  <Text style={s.price}>{formatPlanPrice(plan, cycle)}</Text>
                  <Text style={s.period}>{plan.type === 'free' ? 'forever' : cycle === 'monthly' ? '/ month' : '/ year'}</Text>
                </View>

                {plan.type !== 'free' && cycle === 'yearly' ? (
                  <Text style={[s.savings, { color: accent }]}>Save ${savings.toFixed(2)} every year</Text>
                ) : plan.type === 'free' ? (
                  <Text style={s.savings}>No credit card required</Text>
                ) : (
                  <Text style={s.savings}>Cancel or change plans anytime</Text>
                )}

                <View style={s.headlineFeatures}>
                  {plan.headlineFeatures.map((feature) => (
                    <View key={feature} style={s.featureRow}>
                      <Ionicons name="checkmark-circle" size={18} color={B.green} />
                      <Text style={s.featureText}>{feature}</Text>
                    </View>
                  ))}
                </View>

                <Pressable onPress={() => setExpanded(open ? null : plan.type)} style={s.expandButton}>
                  <Text style={s.expandText}>{open ? 'Hide full plan details' : 'See everything included'}</Text>
                  <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={17} color={B.cyan} />
                </Pressable>

                {open ? (
                  <View style={s.expandedBox}>
                    {plan.allFeatures.map((feature) => (
                      <View key={feature} style={s.detailRow}>
                        <Ionicons name="checkmark" size={16} color={accent} />
                        <Text style={s.detailText}>{feature}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <View style={s.summaryCard}>
          <View style={s.summaryTop}>
            <View>
              <Text style={s.summaryLabel}>SELECTED PLAN</Text>
              <Text style={s.summaryName}>{selectedPlan.name}</Text>
            </View>
            <View style={s.summaryPriceWrap}>
              <Text style={s.summaryPrice}>{formatPlanPrice(selectedPlan, cycle)}</Text>
              <Text style={s.summaryPeriod}>{selectedPlan.type === 'free' ? 'forever' : cycle === 'monthly' ? 'monthly' : 'yearly'}</Text>
            </View>
          </View>
          <Pressable onPress={continueWithPlan} style={s.primary}>
            <Text style={s.primaryText}>{selectedPlan.type === 'free' ? 'Start Free' : `Continue with ${selectedPlan.name}`}</Text>
            <Ionicons name="arrow-forward" size={19} color="#fff" />
          </Pressable>
          <Text style={s.secureText}>
            {selectedPlan.type === 'free' ? 'No payment method required.' : 'Secure purchase through Apple App Store or Google Play. Access stays synchronized with your web account.'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: B.bg },
  content: { padding: 22, paddingTop: 24, paddingBottom: 48 },
  back: { width: 44, height: 44, borderRadius: 15, backgroundColor: B.surface, borderWidth: 1, borderColor: B.line, alignItems: 'center', justifyContent: 'center' },
  kicker: { color: B.cyan, fontSize: 10, fontWeight: '900', letterSpacing: 1.9, marginTop: 28 },
  title: { color: B.text, fontSize: 36, lineHeight: 40, fontWeight: '900', letterSpacing: -1.35, marginTop: 12 },
  sub: { color: B.muted, fontSize: 14, lineHeight: 21, marginTop: 12 },
  toggleWrap: { flexDirection: 'row', padding: 5, borderRadius: 18, backgroundColor: B.surface, borderWidth: 1, borderColor: B.line, marginTop: 24 },
  toggle: { flex: 1, minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  toggleActive: { backgroundColor: B.surface2 },
  toggleText: { color: B.muted, fontWeight: '900', fontSize: 13 },
  toggleTextActive: { color: B.text },
  savePill: { color: B.bg, backgroundColor: B.green, fontSize: 7, fontWeight: '900', letterSpacing: 0.6, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 999 },
  planStack: { gap: 13, marginTop: 17 },
  planCard: { backgroundColor: B.surface, borderRadius: 25, padding: 18, borderWidth: 1, borderColor: B.line },
  pressed: { transform: [{ scale: 0.989 }], opacity: 0.95 },
  planHeader: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  planName: { color: B.text, fontSize: 21, fontWeight: '900' },
  planBadge: { color: B.bg, fontSize: 8, fontWeight: '900', letterSpacing: 0.8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  audience: { color: B.muted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  selector: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: B.line, alignItems: 'center', justifyContent: 'center' },
  priceLine: { flexDirection: 'row', alignItems: 'flex-end', gap: 7, marginTop: 18 },
  price: { color: B.text, fontSize: 34, fontWeight: '900', letterSpacing: -1 },
  period: { color: B.muted, fontSize: 12, fontWeight: '700', marginBottom: 5 },
  savings: { color: B.muted, fontSize: 11, fontWeight: '800', marginTop: 3 },
  headlineFeatures: { gap: 9, marginTop: 17 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  featureText: { color: B.text, fontSize: 12, fontWeight: '700' },
  expandButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, marginTop: 4 },
  expandText: { color: B.cyan, fontSize: 11, fontWeight: '900' },
  expandedBox: { backgroundColor: B.surface2, borderRadius: 18, padding: 14, marginTop: 13, gap: 10 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  detailText: { color: B.text, fontSize: 11, lineHeight: 16, flex: 1 },
  summaryCard: { backgroundColor: B.surface2, borderRadius: 28, padding: 19, borderWidth: 1, borderColor: B.line, marginTop: 18 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLabel: { color: B.cyan, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  summaryName: { color: B.text, fontSize: 20, fontWeight: '900', marginTop: 4 },
  summaryPriceWrap: { alignItems: 'flex-end' },
  summaryPrice: { color: B.text, fontSize: 22, fontWeight: '900' },
  summaryPeriod: { color: B.muted, fontSize: 10, marginTop: 2 },
  primary: { height: 58, borderRadius: 18, backgroundColor: B.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 18 },
  primaryText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  secureText: { color: B.muted, fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 11, paddingHorizontal: 5 },
});
