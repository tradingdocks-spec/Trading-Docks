import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';

import { TDBadge, TDButton, TDIconButton, TDListRow, TDNavigationHeader, TDStatusIndicator, TDText } from '@/components/design-system';
import { space } from '@/design';
import { PLAN_DEFINITIONS } from '@/constants/plans';
import { AccountType, useAccount } from '@/providers/account';

const icons: Record<AccountType, keyof typeof Ionicons.glyphMap> = {
  free: 'sparkles-outline',
  collector: 'diamond-outline',
  seller: 'storefront-outline',
  store: 'business-outline',
};

export default function Onboarding() {
  const { accountType, setAccountType } = useAccount();

  const choose = async (type: AccountType) => {
    await setAccountType(type);
    router.push('/auth');
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <TDNavigationHeader
          eyebrow="Setup"
          title="Choose your workspace"
          subtitle="Pick how you use Trading Docks today. You can review paid plans later."
          leftAction={<TDIconButton label="Back" iconName="chevron-back" onPress={() => router.back()} />}
          rightAction={<TDBadge tone="info">Step 1 of 1</TDBadge>}
        />

        <View style={s.progress}>
          <TDStatusIndicator label="One decision, then sign in" tone="info" />
          <TDText variant="caption" tone="muted">You can change this later from Plans.</TDText>
        </View>

        <View style={s.stack}>
          {PLAN_DEFINITIONS.map((plan) => {
            const selected = accountType === plan.type;
            return (
              <TDListRow
                key={plan.type}
                title={plan.name}
                eyebrow={selected ? 'Selected' : plan.type === 'free' ? 'Free start' : 'Workspace intent'}
                description={`${plan.audience}. ${plan.headlineFeatures.slice(0, 2).join(', ')}.`}
                iconName={icons[plan.type]}
                selected={selected}
                onPress={() => choose(plan.type)}
                right={<TDBadge tone={selected ? 'success' : 'neutral'}>{plan.type === 'free' ? '$0' : `$${plan.monthly.toFixed(2)}`}</TDBadge>}
                accessibilityLabel={`${plan.name} account type${selected ? ', selected' : ''}`}
              />
            );
          })}
        </View>

        <View style={s.actions}>
          <TDButton label="Continue" iconName="arrow-forward" onPress={() => router.push('/auth')} />
          <TDButton label="Skip for now" variant="ghost" iconName="arrow-forward-outline" onPress={() => router.push('/auth')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  content: { gap: space.lg, padding: space.lg, paddingTop: space.xl, paddingBottom: space.xxl },
  progress: { gap: space.xs },
  stack: { gap: space.xs },
  actions: { gap: space.sm },
});
