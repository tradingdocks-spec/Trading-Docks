import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';

import {
  TDBadge,
  TDButton,
  TDCard,
  TDIconButton,
  TDLoadingState,
  TDNavigationHeader,
  TDSegmentedControl,
  TDStatusIndicator,
  TDText,
} from '@/components/design-system';
import { color, radius, space } from '@/design';
import { getMobileReleaseLinks, MOBILE_CANONICAL_SITE_URL } from '@/services/mobile-release-config';
import { getMembershipPlan, type MembershipTier } from '@/services/membership-catalog';
import {
  buildRevenueCatBackendSyncContract,
  configureRevenueCatForUser,
  getRevenueCatPublicConfig,
  loadRevenueCatCatalog,
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
  revenueCatBackendSyncMessage,
  revenueCatCtaLabel,
  revenueCatPurchaseIntent,
  revenueCatUserMessage,
  summarizeRevenueCatCurrentMembership,
  summarizeRevenueCatSelection,
  type RevenueCatCatalogPlan,
  type RevenueCatCustomerSnapshot,
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

const planPositioning: Record<RevenueCatPurchasePlan, string> = {
  collector: 'Collection management and advanced collector tools',
  seller: 'Inventory, buying, selling, and seller operations',
  store: 'Full store operations and business management',
};

export default function Plans() {
  const { session } = useAuth();
  const { accountType } = useAccount();
  const links = getMobileReleaseLinks();
  const sessionUserId = session?.user.id ?? null;
  const [selectedTier, setSelectedTier] = useState<RevenueCatPurchasePlan>('collector');
  const [cycle, setCycle] = useState<RevenueCatPurchaseCycle>('yearly');
  const [catalog, setCatalog] = useState<RevenueCatCatalogPlan[]>([]);
  const [status, setStatus] = useState<RevenueCatStatus>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [providerSnapshot, setProviderSnapshot] = useState<RevenueCatCustomerSnapshot | null>(null);
  const [pendingProviderTier, setPendingProviderTier] = useState<MembershipTier | null>(null);
  const currentPlan = getMembershipPlan(accountType);
  const selectedPlan = getMembershipPlan(selectedTier);
  const currentMembership = summarizeRevenueCatCurrentMembership({
    canonicalTier: currentPlan.id,
    providerSnapshot,
  });
  const selected = summarizeRevenueCatSelection({ catalog, tier: selectedTier, cycle });
  const configured = getRevenueCatPublicConfig().configured;
  const nativePurchasesAvailable = Platform.OS === 'ios' || Platform.OS === 'android';
  const intent = revenueCatPurchaseIntent({
    currentTier: currentPlan.id,
    selectedTier,
    billingSource: currentMembership.billingSource,
  });
  const ctaLabel = revenueCatCtaLabel({
    currentTier: currentPlan.id,
    selectedTier,
    billingSource: currentMembership.billingSource,
    status,
  });
  const purchaseDisabled = !sessionUserId
    || status === 'loading'
    || status === 'purchasing'
    || status === 'restoring'
    || status === 'syncing_backend'
    || (intent === 'current' && currentMembership.billingSource !== 'web')
    || (status !== 'backend_pending' && intent !== 'manage' && !selected.package);

  const refreshCatalog = useCallback(async () => {
    if (!sessionUserId) {
      setStatus('not_configured');
      setMessage('Sign in to load mobile subscription options.');
      setCatalog([]);
      setProviderSnapshot(null);
      return;
    }
    if (!configured || !nativePurchasesAvailable) {
      setStatus(configured ? 'unavailable' : 'not_configured');
      setMessage(configured ? 'Mobile subscriptions are available in native iOS and Android builds.' : 'Mobile subscriptions are not configured for this build.');
      setCatalog([]);
      setProviderSnapshot(null);
      return;
    }
    setStatus('loading');
    setMessage(null);
    const identity = await configureRevenueCatForUser(sessionUserId);
    if (!identity.ok) {
      setStatus(identity.status === 'not_configured' ? 'not_configured' : identity.status === 'unavailable' ? 'unavailable' : 'failed');
      setMessage(revenueCatUserMessage(identity, 'restore'));
      return;
    }
    setProviderSnapshot(identity.snapshot);
    try {
      setCatalog(await loadRevenueCatCatalog());
      setStatus('ready');
    } catch {
      setStatus('failed');
      setMessage('Store products could not be loaded. Check your connection and try again.');
    }
  }, [configured, nativePurchasesAvailable, sessionUserId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshCatalog();
  }, [refreshCatalog]);

  useEffect(() => {
    if (!pendingProviderTier || pendingProviderTier === 'free') return;
    const syncMessage = revenueCatBackendSyncMessage({
      providerTier: pendingProviderTier,
      canonicalTier: currentPlan.id,
      action: 'purchase',
    });
    if (syncMessage === 'Membership updated') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus('synced');
      setMessage(syncMessage);
      setPendingProviderTier(null);
    }
  }, [currentPlan.id, pendingProviderTier]);

  const cycleOptions = useMemo(() => [
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
  ], []);

  const purchase = async () => {
    if (!sessionUserId) return;
    if (intent === 'manage') {
      await openUrl(providerSnapshot?.managementUrl ?? `${MOBILE_CANONICAL_SITE_URL}/dashboard/settings`);
      return;
    }
    if (intent === 'current') {
      await openUrl(`${MOBILE_CANONICAL_SITE_URL}/dashboard/settings`);
      return;
    }
    if (!selected.package) return;
    setStatus('purchasing');
    setMessage(null);
    const result = await purchaseRevenueCatPackage(selected.package.identifier);
    const visibleMessage = revenueCatUserMessage(result, 'purchase');
    if (!result.ok) {
      setStatus('ready');
      setMessage(visibleMessage);
      return;
    }
    const contract = buildRevenueCatBackendSyncContract(sessionUserId, result.snapshot);
    setProviderSnapshot(result.snapshot);
    const syncMessage = revenueCatBackendSyncMessage({
      providerTier: contract.providerTier,
      canonicalTier: currentPlan.id,
      action: 'purchase',
    });
    setPendingProviderTier(contract.providerTier === 'free' ? null : contract.providerTier);
    setStatus(syncMessage === 'Membership updated' ? 'synced' : 'backend_pending');
    setMessage(syncMessage);
  };

  const restore = async () => {
    if (!sessionUserId) return;
    setStatus('restoring');
    setMessage(null);
    const result = await restoreRevenueCatPurchases();
    const visibleMessage = revenueCatUserMessage(result, 'restore');
    if (!result.ok) {
      setStatus('ready');
      setMessage(visibleMessage);
      return;
    }
    const contract = buildRevenueCatBackendSyncContract(sessionUserId, result.snapshot);
    setProviderSnapshot(result.snapshot);
    const syncMessage = revenueCatBackendSyncMessage({
      providerTier: contract.providerTier,
      canonicalTier: currentPlan.id,
      action: 'restore',
    });
    setPendingProviderTier(contract.providerTier === 'free' ? null : contract.providerTier);
    setStatus(syncMessage === 'Membership updated' ? 'synced' : 'backend_pending');
    setMessage(syncMessage);
  };

  const refreshAfterPending = async () => {
    setStatus('syncing_backend');
    setMessage(pendingProviderTier ? revenueCatBackendSyncMessage({
      providerTier: pendingProviderTier,
      canonicalTier: currentPlan.id,
      action: 'purchase',
    }) : 'Refreshing membership status...');
    await refreshCatalog();
    if (pendingProviderTier) {
      setStatus('backend_pending');
      setMessage(revenueCatBackendSyncMessage({
        providerTier: pendingProviderTier,
        canonicalTier: currentPlan.id,
        action: 'purchase',
      }));
    }
  };

  const statusTone = status === 'failed' || status === 'not_configured' || status === 'unavailable'
    ? 'warning'
    : status === 'synced'
      ? 'success'
      : 'info';

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <TDNavigationHeader
          eyebrow="Membership"
          title="Plans"
          subtitle="Choose the membership that fits your Trading Docks workflow."
          leftAction={<TDIconButton label="Back" iconName="chevron-back" onPress={() => router.back()} />}
          rightAction={<TDBadge tone={currentPlan.id === 'free' ? 'neutral' : 'success'}>{currentPlan.name}</TDBadge>}
        />

        <TDCard variant="floating" style={s.currentCard} accessibilityLabel={`Current plan ${currentPlan.name}. Billing source ${currentMembership.billingSourceLabel}.`}>
          <View style={s.currentTopRow}>
            <View style={s.flex}>
              <TDText variant="caption" tone="muted">Current Plan</TDText>
              <TDText variant="heading">{currentPlan.name}</TDText>
            </View>
            <TDBadge tone={currentPlan.id === 'free' ? 'neutral' : 'success'}>{currentMembership.statusLabel}</TDBadge>
          </View>
          <View style={s.currentFacts}>
            <Fact label="Billing source" value={currentMembership.billingSourceLabel} />
            {currentMembership.billingSource === 'web' ? <Fact label="Mobile action" value="Manage on web" /> : null}
          </View>
          {currentMembership.billingSource === 'web' ? (
            <TDButton label="Manage on web" variant="ghost" iconName="open-outline" onPress={() => void openUrl(`${MOBILE_CANONICAL_SITE_URL}/dashboard/settings`)} />
          ) : null}
          {message ? <TDStatusIndicator label={message} tone={statusTone} /> : null}
        </TDCard>

        <View style={s.selectorBlock}>
          <TDText variant="label" tone="muted">Tier</TDText>
          <View style={s.tierSelector} accessibilityRole="tablist">
            {paidPlans.map((tier) => {
              const plan = getMembershipPlan(tier);
              const isSelected = selectedTier === tier;
              return (
                <Pressable
                  key={tier}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isSelected, disabled: status === 'purchasing' || status === 'restoring' }}
                  accessibilityLabel={`${plan.name}. ${planPositioning[tier]}`}
                  disabled={status === 'purchasing' || status === 'restoring'}
                  onPress={() => setSelectedTier(tier)}
                  style={({ pressed }) => [s.tierOption, isSelected && s.tierOptionSelected, pressed && s.pressed]}
                >
                  <Ionicons name={planIcons[tier]} size={18} color={isSelected ? color.primaryBright : color.textMuted} />
                  <TDText variant="small" tone={isSelected ? 'primary' : 'secondary'} numberOfLines={1}>{plan.name}</TDText>
                  <TDText variant="caption" tone="muted" numberOfLines={2} style={s.tierCopy}>{planPositioning[tier]}</TDText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <TDSegmentedControl
          label="Billing"
          options={cycleOptions}
          value={cycle}
          onChange={(value) => setCycle(value as RevenueCatPurchaseCycle)}
          disabled={status === 'purchasing' || status === 'restoring'}
        />

        <TDCard style={s.valueCard}>
          <View style={s.valueHeader}>
            <View style={s.flex}>
              <TDText variant="title">{selectedPlan.name}</TDText>
              <TDText variant="small" tone="muted">{planPositioning[selectedTier]}</TDText>
            </View>
            {selected.savingsLabel && cycle === 'yearly' ? <TDBadge tone="success">{selected.savingsLabel}</TDBadge> : null}
          </View>

          <View style={s.pricePanel} accessibilityRole="text" accessibilityLabel={`${selected.priceLabel}, ${selected.periodLabel}`}>
            <TDText variant="heading">{selected.priceLabel}</TDText>
            <TDText variant="caption" tone="muted">{selected.periodLabel}</TDText>
          </View>

          <View style={s.featureList}>
            {selectedPlan.headlineFeatures.slice(0, 3).map((feature) => (
              <View key={feature} style={s.featureRow}>
                <Ionicons name="checkmark-circle-outline" size={16} color={color.success} />
                <TDText variant="caption" tone="secondary" style={s.featureText}>{feature}</TDText>
              </View>
            ))}
          </View>

          {selected.missingReason === 'package_missing' && status === 'ready' ? (
            <TDStatusIndicator label="This subscription is not available from the store right now." tone="warning" />
          ) : null}
          {selected.missingReason === 'localized_price_missing' && status === 'ready' ? (
            <TDStatusIndicator label="StoreKit did not return a localized price for this subscription." tone="warning" />
          ) : null}
        </TDCard>

        {status === 'loading' ? <TDLoadingState title="Loading StoreKit prices" message="Checking the current mobile offering." /> : null}

        <View style={s.actions}>
          <TDButton
            label={ctaLabel}
            loading={status === 'purchasing' || status === 'syncing_backend'}
            disabled={purchaseDisabled}
            iconName={intent === 'manage' || intent === 'current' ? 'open-outline' : 'card-outline'}
            onPress={status === 'backend_pending' ? refreshAfterPending : purchase}
            accessibilityLabel={`${ctaLabel} for ${selectedPlan.name}`}
          />
          <TDButton
            label="Restore Purchases"
            variant="ghost"
            loading={status === 'restoring'}
            disabled={!session || status === 'purchasing' || status === 'restoring' || status === 'syncing_backend'}
            iconName="refresh-outline"
            onPress={restore}
          />
        </View>

        <TDCard variant="outlined" style={s.legalCard}>
          <TDText variant="caption" tone="muted" style={s.finePrint}>
            Trading Docks backend membership remains the authority for app access. Stripe subscriptions continue to sync through that canonical backend state. Apple purchases must be reconciled before protected access updates.
          </TDText>
          <TDText variant="caption" tone="muted" style={s.finePrint}>
            Subscription renews automatically unless cancelled. StoreKit manages upgrades, downgrades, renewals, and cancellation. Store employee capacity remains configurable.
          </TDText>
          <View style={s.legalLinks}>
            <LegalLink label="Terms" url={links.terms.url} />
            <LegalLink label="Privacy" url={links.privacy.url} />
          </View>
        </TDCard>
      </ScrollView>
    </SafeAreaView>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.fact}>
      <TDText variant="caption" tone="muted">{label}</TDText>
      <TDText variant="small">{value}</TDText>
    </View>
  );
}

function LegalLink({ label, url }: { label: string; url: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => void openUrl(url)}
      style={({ pressed }) => [s.legalLink, pressed && s.pressed]}
    >
      <TDText variant="caption" tone="info">{label}</TDText>
      <Ionicons name="open-outline" size={13} color={color.info} />
    </Pressable>
  );
}

async function openUrl(url: string) {
  await Linking.openURL(url);
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.canvas },
  content: { gap: space.lg, padding: space.lg, paddingTop: space.xl, paddingBottom: space.xxl },
  currentCard: { gap: space.md },
  currentTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  currentFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  fact: { flexGrow: 1, minWidth: 128, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, backgroundColor: color.canvasRaised, padding: space.sm, gap: 2 },
  flex: { flex: 1, minWidth: 0 },
  selectorBlock: { gap: space.xs },
  tierSelector: { flexDirection: 'row', gap: space.xs },
  tierOption: { flex: 1, minHeight: 104, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center', gap: 4, padding: space.sm },
  tierOptionSelected: { borderColor: color.primaryBright, backgroundColor: color.primary + '20' },
  tierCopy: { textAlign: 'center' },
  pressed: { opacity: 0.82 },
  valueCard: { gap: space.md },
  valueHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  pricePanel: { minHeight: 76, borderRadius: radius.md, borderWidth: 1, borderColor: color.primaryBright + '44', backgroundColor: color.primary + '16', alignItems: 'center', justifyContent: 'center', gap: 2 },
  featureList: { gap: space.xs },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs },
  featureText: { flex: 1, minWidth: 0 },
  actions: { gap: space.sm },
  legalCard: { gap: space.sm },
  finePrint: { textAlign: 'center' },
  legalLinks: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.lg },
  legalLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: space.sm },
});
