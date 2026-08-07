import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';

import { TDBadge, TDButton, TDCard, TDIconButton, TDListRow, TDLoadingState, TDNavigationHeader, TDSegmentedControl, TDStatusIndicator, TDText } from '@/components/design-system';
import { color, radius, space } from '@/design';
import { getMembershipPlan, type MembershipTier } from '@/services/membership-catalog';
import {
  buildRevenueCatBackendSyncContract,
  configureRevenueCatForUser,
  getRevenueCatPublicConfig,
  loadRevenueCatCatalog,
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
  type RevenueCatCatalogPlan,
  type RevenueCatPurchaseCycle,
  type RevenueCatPurchasePlan,
  type RevenueCatStatus,
} from '@/services/revenuecat';
import { useAccount } from '@/providers/account';
import { useAuth } from '@/providers/auth';

const paidPlans: RevenueCatPurchasePlan[] = ['collector', 'seller', 'store'];
const planIcons: Record<RevenueCatPurchasePlan, keyof typeof Ionicons.glyphMap> = {
  collector: 'diamond-outline',
  seller: 'storefront-outline',
  store: 'business-outline',
};

export default function Plans() {
  const { session } = useAuth();
  const { accountType } = useAccount();
  const [selectedTier, setSelectedTier] = useState<RevenueCatPurchasePlan>('collector');
  const [cycle, setCycle] = useState<RevenueCatPurchaseCycle>('yearly');
  const [catalog, setCatalog] = useState<RevenueCatCatalogPlan[]>([]);
  const [status, setStatus] = useState<RevenueCatStatus>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const currentPlan = getMembershipPlan(accountType);
  const selectedPlan = getMembershipPlan(selectedTier);
  const selectedPackage = catalog.find((plan) => plan.tier === selectedTier)?.packages[cycle] ?? null;
  const configured = getRevenueCatPublicConfig().configured;
  const nativePurchasesAvailable = Platform.OS === 'ios' || Platform.OS === 'android';

  const refreshCatalog = useCallback(async () => {
    if (!session?.user.id) {
      setStatus('not_configured');
      setMessage('Sign in to load mobile subscription options.');
      setCatalog([]);
      return;
    }
    if (!configured || !nativePurchasesAvailable) {
      setStatus(configured ? 'unavailable' : 'not_configured');
      setMessage(configured ? 'Mobile subscriptions are available in native iOS and Android builds.' : 'Mobile subscriptions are not configured for this build.');
      setCatalog([]);
      return;
    }
    setStatus('loading');
    setMessage(null);
    const identity = await configureRevenueCatForUser(session.user.id);
    if (!identity.ok && identity.status !== 'cancelled') {
      setStatus(identity.status === 'not_configured' ? 'not_configured' : 'failed');
      setMessage(identity.message);
      return;
    }
    try {
      setCatalog(await loadRevenueCatCatalog());
      setStatus('ready');
    } catch (error) {
      setStatus('failed');
      setMessage(error instanceof Error ? error.message : 'Store products could not be loaded.');
    }
  }, [configured, nativePurchasesAvailable, session?.user.id]);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  const cycleOptions = useMemo(() => [
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
  ], []);

  const purchase = async () => {
    if (!selectedPackage || !session?.user.id) return;
    setStatus('purchasing');
    setMessage(null);
    const result = await purchaseRevenueCatPackage(selectedPackage.identifier);
    if (!result.ok) {
      setStatus('ready');
      if (result.status !== 'cancelled') setMessage(result.message);
      return;
    }
    const contract = buildRevenueCatBackendSyncContract(session.user.id, result.snapshot);
    setStatus('synced');
    setMessage(syncCopy(contract.providerTier));
    Alert.alert('Purchase confirmed', syncCopy(contract.providerTier));
  };

  const restore = async () => {
    if (!session?.user.id) return;
    setStatus('restoring');
    setMessage(null);
    const result = await restoreRevenueCatPurchases();
    if (!result.ok) {
      setStatus('ready');
      if (result.status !== 'cancelled') setMessage(result.message);
      return;
    }
    const contract = buildRevenueCatBackendSyncContract(session.user.id, result.snapshot);
    setStatus('synced');
    setMessage(contract.providerTier === 'free'
      ? 'No active mobile subscription was found for this Apple account.'
      : syncCopy(contract.providerTier));
  };

  const ctaLabel = currentPlan.id === selectedTier ? `Manage ${selectedPlan.name}` : `Subscribe to ${selectedPlan.name}`;
  const ctaDisabled = !selectedPackage || status === 'purchasing' || status === 'restoring' || !session;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <TDNavigationHeader
          eyebrow="Membership"
          title="Plans"
          subtitle="Mobile purchases use RevenueCat and StoreKit. Trading Docks backend membership remains the authority for feature access."
          leftAction={<TDIconButton label="Back" iconName="chevron-back" onPress={() => router.back()} />}
          rightAction={<TDBadge tone={currentPlan.id === 'free' ? 'neutral' : 'success'}>{currentPlan.name}</TDBadge>}
        />

        <TDCard variant="floating" style={s.currentCard}>
          <TDText variant="caption" tone="muted">Current Membership</TDText>
          <View style={s.currentRow}>
            <View style={s.flex}>
              <TDText variant="heading">{currentPlan.name}</TDText>
              <TDText variant="small" tone="muted">Resolved from Trading Docks canonical membership state.</TDText>
            </View>
            <TDBadge tone={status === 'synced' ? 'info' : 'neutral'}>{statusLabel(status)}</TDBadge>
          </View>
          {message ? <TDStatusIndicator label={message} tone={status === 'failed' ? 'warning' : 'info'} /> : null}
        </TDCard>

        <View style={s.planTabs}>
          {paidPlans.map((tier) => {
            const plan = getMembershipPlan(tier);
            const selected = selectedTier === tier;
            return (
              <Pressable
                key={tier}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Select ${plan.name} membership`}
                onPress={() => setSelectedTier(tier)}
                style={({ pressed }) => [s.planTab, selected && s.planTabSelected, pressed && s.pressed]}
              >
                <Ionicons name={planIcons[tier]} size={18} color={selected ? color.primaryBright : color.textMuted} />
                <TDText variant="small" tone={selected ? 'primary' : 'muted'}>{plan.name}</TDText>
              </Pressable>
            );
          })}
        </View>

        <TDSegmentedControl label="Billing cycle" options={cycleOptions} value={cycle} onChange={(value) => setCycle(value as RevenueCatPurchaseCycle)} disabled={status === 'purchasing' || status === 'restoring'} />

        <TDCard style={s.valueCard}>
          <View style={s.valueHeader}>
            <View style={s.flex}>
              <TDText variant="title">{selectedPlan.name}</TDText>
              <TDText variant="small" tone="muted">{selectedPlan.headlineFeatures.join(' / ')}</TDText>
            </View>
            <View style={s.priceBlock}>
              <TDText variant="heading">{selectedPackage?.localizedPrice ?? 'Unavailable'}</TDText>
              <TDText variant="caption" tone="muted">{cycle}</TDText>
            </View>
          </View>
          <View style={s.features}>
            {selectedPlan.features.slice(0, 6).map((feature) => (
              <View key={feature} style={s.featureRow}>
                <Ionicons name="checkmark-circle-outline" size={16} color={color.success} />
                <TDText variant="caption" tone="secondary" style={s.featureText}>{feature}</TDText>
              </View>
            ))}
          </View>
          {!selectedPackage && status === 'ready' ? <TDStatusIndicator label="This package is missing from the current RevenueCat offering." tone="warning" /> : null}
        </TDCard>

        {status === 'loading' ? <TDLoadingState title="Loading StoreKit prices" message="Checking the current RevenueCat offering." /> : null}

        <View style={s.actions}>
          <TDButton label={ctaLabel} loading={status === 'purchasing'} disabled={ctaDisabled} iconName="card-outline" onPress={purchase} />
          <TDButton label="Restore Purchases" variant="secondary" loading={status === 'restoring'} disabled={!session || status === 'purchasing' || status === 'restoring'} iconName="refresh-outline" onPress={restore} />
        </View>

        <View style={s.section}>
          <TDListRow title="Web and Headquarters billing" description="Stripe subscriptions continue to sync through the canonical backend membership model." iconName="desktop-outline" />
          <TDListRow title="Mobile store purchases" description="Apple purchases must be reconciled by secure RevenueCat webhook before they unlock protected access everywhere." iconName="phone-portrait-outline" />
        </View>

        <TDText variant="caption" tone="muted" style={s.finePrint}>
          Free is not a purchasable store product. Store employee capacity remains configurable until product ownership finalizes seat packaging. Do not submit subscriptions for review until RevenueCat webhooks and Sandbox purchase/restore QA pass.
        </TDText>
      </ScrollView>
    </SafeAreaView>
  );
}

function statusLabel(status: RevenueCatStatus) {
  if (status === 'not_configured') return 'Setup required';
  if (status === 'unavailable') return 'Native only';
  if (status === 'purchasing') return 'Purchasing';
  if (status === 'restoring') return 'Restoring';
  if (status === 'synced') return 'Provider confirmed';
  if (status === 'failed') return 'Needs attention';
  if (status === 'loading') return 'Loading';
  return 'Ready';
}

function syncCopy(tier: MembershipTier) {
  if (tier === 'free') return 'Purchase provider returned no paid entitlement. Trading Docks access was not changed.';
  return `${getMembershipPlan(tier).name} was confirmed by the store. Trading Docks access updates after secure backend reconciliation.`;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.canvas },
  content: { gap: space.lg, padding: space.lg, paddingTop: space.xl, paddingBottom: space.xxl },
  currentCard: { gap: space.sm },
  currentRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, minWidth: 0 },
  planTabs: { minHeight: 54, flexDirection: 'row', gap: space.xs },
  planTab: { flex: 1, minHeight: 54, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, alignItems: 'center', justifyContent: 'center', gap: 3, backgroundColor: color.surface },
  planTabSelected: { borderColor: color.primaryBright, backgroundColor: color.primaryBright + '18' },
  pressed: { opacity: 0.82 },
  valueCard: { gap: space.md },
  valueHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  priceBlock: { minWidth: 104, alignItems: 'flex-end', gap: 2 },
  features: { gap: space.xs },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs },
  featureText: { flex: 1, minWidth: 0 },
  actions: { gap: space.sm },
  section: { gap: space.xs },
  finePrint: { textAlign: 'center' },
});
