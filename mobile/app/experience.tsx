import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { SafeAreaView, ScrollView, StyleSheet, Text, View, Pressable, Image } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

const colors = {
  bg: '#020A12',
  panel: '#071E31',
  panel2: '#0A2942',
  line: '#173C59',
  text: '#F5FAFF',
  muted: '#8BA3BA',
  blue: '#137CFF',
  cyan: '#26D9FF',
  mint: '#55E6B0',
};

const actions = [
  { icon: 'scan-outline', label: 'Scan cards', detail: 'Fast capture', color: colors.cyan },
  { icon: 'albums-outline', label: 'Collection', detail: '12,486 cards', color: colors.blue },
  { icon: 'pricetag-outline', label: 'Sell', detail: '3 opportunities', color: colors.mint },
];

export default function ExperienceScreen() {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(500)} style={styles.topbar}>
            <Pressable onPress={() => router.back()} style={styles.iconButton}>
              <Image source={require('../assets/images/trading-docks-mark.png')} style={styles.topMark} />
            </Pressable>
            <View style={styles.livePill}>
              <View style={styles.dot} />
              <Text style={styles.liveText}>COLLECTION LIVE</Text>
            </View>
            <View style={styles.avatar}><Text style={styles.avatarText}>JD</Text></View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(600)}>
            <Text style={styles.greeting}>Good afternoon, Jeremy</Text>
            <Text style={styles.title}>Your collection moved today.</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(180).duration(600)} style={styles.heroCard}>
            <Text style={styles.heroLabel}>TODAY'S COLLECTION MOVEMENT</Text>
            <View style={styles.heroValueRow}>
              <Text style={styles.heroValue}>+$216.34</Text>
              <View style={styles.upPill}>
                <Ionicons name="arrow-up" size={14} color={colors.mint} />
                <Text style={styles.upText}>0.9%</Text>
              </View>
            </View>
            <Text style={styles.heroSub}>7 cards created meaningful movement</Text>
            <View style={styles.heroGlow} />
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(260).duration(600)} style={styles.insightCard}>
            <View style={styles.insightIcon}>
              <Ionicons name="sparkles" size={18} color={colors.cyan} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.insightOverline}>DOCKLIGHT SIGNAL</Text>
              <Text style={styles.insightTitle}>Your strongest mover is approaching a 90-day high.</Text>
              <Text style={styles.insightBody}>Review the price signal before the market cools.</Text>
            </View>
            <Ionicons name="arrow-forward" size={20} color={colors.text} />
          </Animated.View>

          <Text style={styles.sectionTitle}>Move quickly</Text>
          <View style={styles.actionRow}>
            {actions.map((action, index) => (
              <Animated.View key={action.label} entering={FadeInUp.delay(340 + index * 80).duration(500)} style={styles.actionCard}>
                <View style={[styles.actionIcon, { borderColor: `${action.color}55` }]}>
                  <Ionicons name={action.icon as never} size={20} color={action.color} />
                </View>
                <Text style={styles.actionLabel}>{action.label}</Text>
                <Text style={styles.actionDetail}>{action.detail}</Text>
              </Animated.View>
            ))}
          </View>

          <Animated.View entering={FadeInUp.delay(620).duration(550)} style={styles.continueCard}>
            <View>
              <Text style={styles.continueOverline}>CONTINUE WHERE YOU LEFT OFF</Text>
              <Text style={styles.continueTitle}>Commander collection</Text>
              <Text style={styles.continueBody}>You are 7 cards away from your next milestone.</Text>
            </View>
            <Pressable
              onPress={() => Haptics.selectionAsync()}
              style={({ pressed }) => [styles.continueButton, pressed && { opacity: 0.75 }]}> 
              <Text style={styles.continueButtonText}>Open</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.text} />
            </Pressable>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  content: { padding: 22, paddingBottom: 42 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 42, height: 42, borderRadius: 15, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  topMark: { width: 40, height: 40, borderRadius: 14 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, borderWidth: 1, borderColor: '#1A604E', backgroundColor: '#0A342F', paddingHorizontal: 12, paddingVertical: 8 },
  dot: { width: 7, height: 7, borderRadius: 7, backgroundColor: colors.mint },
  liveText: { color: colors.mint, fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  avatar: { width: 42, height: 42, borderRadius: 15, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.text, fontWeight: '900', fontSize: 12 },
  greeting: { color: colors.muted, fontSize: 14, fontWeight: '700', marginTop: 32 },
  title: { color: colors.text, fontSize: 38, lineHeight: 41, fontWeight: '900', letterSpacing: -1.5, marginTop: 8 },
  heroCard: { marginTop: 24, borderRadius: 28, backgroundColor: '#0B3152', borderWidth: 1, borderColor: '#1C5F91', padding: 22, overflow: 'hidden' },
  heroLabel: { color: '#9DC7E8', fontSize: 10, fontWeight: '900', letterSpacing: 1.8 },
  heroValueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 },
  heroValue: { color: colors.text, fontSize: 43, fontWeight: '900', letterSpacing: -1.7 },
  upPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, backgroundColor: '#0B3A31', paddingHorizontal: 10, paddingVertical: 7 },
  upText: { color: colors.mint, fontWeight: '900' },
  heroSub: { color: '#9CB5CA', fontSize: 13, marginTop: 8 },
  heroGlow: { position: 'absolute', width: 220, height: 220, borderRadius: 220, backgroundColor: colors.blue, opacity: 0.16, right: -90, top: -110 },
  insightCard: { marginTop: 14, borderRadius: 22, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, padding: 17, flexDirection: 'row', alignItems: 'center', gap: 13 },
  insightIcon: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, borderColor: '#226178', backgroundColor: '#0B3445', alignItems: 'center', justifyContent: 'center' },
  insightOverline: { color: colors.cyan, fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  insightTitle: { color: colors.text, fontSize: 15, fontWeight: '800', lineHeight: 20, marginTop: 4 },
  insightBody: { color: colors.muted, fontSize: 12, marginTop: 4 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 26, marginBottom: 12 },
  actionRow: { flexDirection: 'row', gap: 9 },
  actionCard: { flex: 1, minHeight: 128, borderRadius: 20, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, padding: 14 },
  actionIcon: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { color: colors.text, fontSize: 13, fontWeight: '900', marginTop: 16 },
  actionDetail: { color: colors.muted, fontSize: 10, marginTop: 4 },
  continueCard: { marginTop: 16, borderRadius: 24, backgroundColor: colors.panel2, borderWidth: 1, borderColor: '#1B4868', padding: 20 },
  continueOverline: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  continueTitle: { color: colors.text, fontSize: 20, fontWeight: '900', marginTop: 8 },
  continueBody: { color: colors.muted, fontSize: 13, marginTop: 6 },
  continueButton: { marginTop: 18, height: 48, borderRadius: 16, backgroundColor: colors.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  continueButtonText: { color: colors.text, fontWeight: '900' },
});
