import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { brand as B } from '@/constants/brand';
import { PLAN_DEFINITIONS } from '@/constants/plans';
import { AccountType, useAccount } from '@/providers/account';

const icons: Record<AccountType, keyof typeof Ionicons.glyphMap> = {
  free: 'sparkles-outline',
  collector: 'diamond-outline',
  seller: 'storefront-outline',
  store: 'business-outline',
};

export default function Onboarding() {
  const { setAccountType } = useAccount();

  const choose = async (type: AccountType) => {
    await setAccountType(type);
    router.push(type === 'free' ? '/auth' : '/plans');
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Ionicons name="chevron-back" size={21} color={B.text} />
        </Pressable>

        <Text style={s.kicker}>CHOOSE HOW YOU USE TRADING DOCKS</Text>
        <Text style={s.title}>A workspace that grows with your collection or business.</Text>
        <Text style={s.sub}>Start free and move up whenever you need deeper insights, selling tools, or store workflows.</Text>

        <View style={s.stack}>
          {PLAN_DEFINITIONS.map((plan) => (
            <Pressable
              key={plan.type}
              onPress={() => choose(plan.type)}
              style={({ pressed }) => [
                s.card,
                plan.type === 'collector' && s.featuredCard,
                pressed && s.pressed,
              ]}
            >
              <View style={s.cardTop}>
                <View style={[s.icon, plan.type === 'collector' && s.iconFeatured]}>
                  <Ionicons name={icons[plan.type]} size={22} color={plan.type === 'collector' ? '#fff' : B.cyan} />
                </View>
                <View style={s.planCopy}>
                  <View style={s.nameRow}>
                    <Text style={s.planName}>{plan.name}</Text>
                    {plan.badge ? <Text style={s.badge}>{plan.badge}</Text> : null}
                  </View>
                  <Text style={s.audience}>{plan.audience}</Text>
                </View>
                <View style={s.priceWrap}>
                  <Text style={s.price}>{plan.type === 'free' ? '$0' : `$${plan.monthly.toFixed(2)}`}</Text>
                  {plan.type !== 'free' ? <Text style={s.period}>/month</Text> : <Text style={s.period}>forever</Text>}
                </View>
              </View>

              <View style={s.featureRow}>
                {plan.headlineFeatures.map((feature) => (
                  <View key={feature} style={s.feature}>
                    <Ionicons name="checkmark-circle" size={16} color={B.green} />
                    <Text style={s.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              {plan.type !== 'free' ? (
                <Text style={s.annualLine}>
                  Or ${plan.yearly.toFixed(2)}/year · about 2 months free
                </Text>
              ) : (
                <Text style={s.annualLine}>No credit card required</Text>
              )}

              <View style={[s.cta, plan.type === 'free' && s.ctaSecondary]}>
                <Text style={[s.ctaText, plan.type === 'free' && s.ctaSecondaryText]}>
                  {plan.type === 'free' ? 'Start Free' : `Choose ${plan.name}`}
                </Text>
                <Ionicons name="arrow-forward" size={18} color={plan.type === 'free' ? B.text : '#fff'} />
              </View>
            </Pressable>
          ))}
        </View>

        <Text style={s.finePrint}>Subscriptions can be changed or cancelled from your account. Paid access will stay synchronized between mobile and the Trading Docks web workspace.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: B.bg },
  content: { padding: 22, paddingTop: 24, paddingBottom: 54 },
  back: { width: 44, height: 44, borderRadius: 15, backgroundColor: B.surface, borderWidth: 1, borderColor: B.line, alignItems: 'center', justifyContent: 'center' },
  kicker: { color: B.cyan, fontSize: 10, fontWeight: '900', letterSpacing: 1.8, marginTop: 28 },
  title: { color: B.text, fontSize: 35, lineHeight: 39, fontWeight: '900', letterSpacing: -1.25, marginTop: 12 },
  sub: { color: B.muted, fontSize: 14, lineHeight: 21, marginTop: 12 },
  stack: { gap: 14, marginTop: 24 },
  card: { backgroundColor: B.surface, borderRadius: 26, padding: 18, borderWidth: 1, borderColor: B.line },
  featuredCard: { borderColor: B.cyan, shadowColor: B.cyan, shadowOpacity: 0.15, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.94 },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  icon: { width: 46, height: 46, borderRadius: 15, backgroundColor: B.blue + '20', alignItems: 'center', justifyContent: 'center' },
  iconFeatured: { backgroundColor: B.blue },
  planCopy: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  planName: { color: B.text, fontSize: 20, fontWeight: '900' },
  badge: { color: B.bg, backgroundColor: B.cyan, fontSize: 8, fontWeight: '900', letterSpacing: 0.8, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  audience: { color: B.muted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  priceWrap: { alignItems: 'flex-end' },
  price: { color: B.text, fontWeight: '900', fontSize: 14 },
  period: { color: B.muted, fontSize: 9, fontWeight: '700', marginTop: 2 },
  featureRow: { gap: 8, marginTop: 17 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { color: B.text, fontSize: 12, fontWeight: '700' },
  annualLine: { color: B.cyan, fontSize: 11, fontWeight: '800', marginTop: 14 },
  cta: { height: 50, borderRadius: 16, backgroundColor: B.blue, marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ctaSecondary: { backgroundColor: B.surface2, borderWidth: 1, borderColor: B.line },
  ctaText: { color: '#fff', fontWeight: '900' },
  ctaSecondaryText: { color: B.text },
  finePrint: { color: B.muted, fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 22, paddingHorizontal: 10 },
});
