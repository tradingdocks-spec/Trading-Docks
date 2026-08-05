import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { brand as B } from '@/constants/brand';
import { useWorkSession } from '@/features/sessions/session-provider';
import {
  createDealDeskRenderState,
  currency,
  sessionNameForMode,
  sessionTypeForMode,
  type DealDeskMode,
} from '@/services/deal-desk';

const modes: [DealDeskMode, string, keyof typeof Ionicons.glyphMap][] = [
  ['buy', 'Buy cards', 'cash-outline'],
  ['trade', 'Trade', 'swap-horizontal-outline'],
  ['sealed', 'Sealed', 'cube-outline'],
  ['show', 'Show mode', 'ticket-outline'],
];

export default function DealDesk() {
  const { ready, activeSession, startSession, pauseSession, endSession } = useWorkSession();
  const [mode, setMode] = useState<DealDeskMode>('buy');
  const [market, setMarket] = useState('684.20');
  const [rate, setRate] = useState('65');
  const [budget, setBudget] = useState('3000');
  const [error, setError] = useState<string | null>(null);

  const state = useMemo(() => createDealDeskRenderState({
    ready,
    activeSession,
    mode,
    market,
    rate,
    budget,
    error,
  }), [activeSession, budget, error, market, mode, rate, ready]);

  const begin = async () => {
    const name = sessionNameForMode(mode);
    try {
      setError(null);
      await startSession(sessionTypeForMode(mode), name);
      Alert.alert('Session started', `${name} is saved on this device and can be resumed.`);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Deal Desk could not start the session.');
    }
  };

  if (state.status === 'loading') {
    return (
      <ScrollView style={s.page} contentContainerStyle={s.content}>
        <Text style={s.kicker}>DEAL DESK</Text>
        <Text style={s.title}>Loading Deal Desk.</Text>
        <Text style={s.sub}>Restoring the active buying, trade, or show session.</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>
      <Text style={s.kicker}>DEAL DESK</Text>
      <Text style={s.title}>Price the deal while the cards are in front of you.</Text>
      <Text style={s.sub}>Buying, trading, sealed evaluation, and event sessions in one fast workspace.</Text>

      {state.status === 'error' ? (
        <View style={s.error}>
          <Text style={s.errorTitle}>Deal Desk needs attention</Text>
          <Text style={s.meta}>{error}</Text>
        </View>
      ) : null}

      {activeSession ? (
        <View style={s.active}>
          <View style={s.activeDot} />
          <View style={s.flex}>
            <Text style={s.activeLabel}>ACTIVE SESSION</Text>
            <Text style={s.activeName}>{activeSession.name}</Text>
            <Text style={s.meta}>{activeSession.status === 'paused' ? 'Paused' : 'Saved offline and ready to resume'}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={activeSession.status === 'paused' ? 'Resume session' : 'Pause session'}
            onPress={activeSession.status === 'paused' ? () => startSession(activeSession.type, activeSession.name) : pauseSession}
            style={s.iconButton}
          >
            <Ionicons name={activeSession.status === 'paused' ? 'play' : 'pause'} size={20} color={B.cyan} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="End session" onPress={endSession} style={s.iconButton}>
            <Ionicons name="close" size={20} color={B.muted} />
          </Pressable>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.modeRow}>
        {modes.map(([key, label, icon]) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityState={{ selected: mode === key }}
            onPress={() => setMode(key)}
            style={[s.mode, mode === key && s.modeActive]}
          >
            <Ionicons name={icon} size={18} color={mode === key ? '#fff' : B.muted} />
            <Text style={[s.modeText, mode === key && s.modeTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {mode === 'buy' ? (
        <>
          <View style={s.hero}>
            <Text style={s.label}>CURRENT OFFER</Text>
            <Text style={s.value}>{state.offerLabel}</Text>
            <Text style={s.meta}>{state.missingPrice ? 'Enter market value to calculate an offer.' : `${rate}% of ${currency(Number(market || 0))} market value`}</Text>
            <View style={s.inputs}>
              <Field label="MARKET VALUE" value={market} setValue={setMarket} prefix="$" />
              <Field label="BUY RATE" value={rate} setValue={setRate} suffix="%" />
            </View>
          </View>
          <View style={s.summary}>
            <Summary label="Cards" value="38" />
            <Summary label="Average rate" value={`${rate}%`} />
            <Summary label="Budget left" value={`$${state.budgetRemaining.toFixed(0)}`} />
          </View>
          <Pressable accessibilityRole="button" onPress={begin} style={s.primary}>
            <Text style={s.primaryText}>Start scanning this purchase</Text>
            <Ionicons name="scan" size={20} color="#fff" />
          </Pressable>
        </>
      ) : null}
      {mode === 'trade' ? <Trade onStart={begin} /> : null}
      {mode === 'sealed' ? <Sealed onStart={begin} /> : null}
      {mode === 'show' ? <Show budget={budget} setBudget={setBudget} onStart={begin} /> : null}

      <Text style={s.section}>Saved buying profile</Text>
      <View style={s.profile}>
        <View>
          <Text style={s.profileTitle}>Card Show Standard</Text>
          <Text style={s.meta}>50% under $5 · 60% $5-$20 · 65% $20+</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={B.muted} />
      </View>
    </ScrollView>
  );
}

function Field({ label, value, setValue, prefix, suffix }: { label: string; value: string; setValue: (value: string) => void; prefix?: string; suffix?: string }) {
  return (
    <View style={s.flex}>
      <Text style={s.inputLabel}>{label}</Text>
      <View style={s.inputBox}>
        {prefix ? <Text style={s.affix}>{prefix}</Text> : null}
        <TextInput value={value} onChangeText={setValue} keyboardType="decimal-pad" style={s.input} />
        {suffix ? <Text style={s.affix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={s.summaryValue}>{value}</Text>
      <Text style={s.meta}>{label}</Text>
    </View>
  );
}

function Trade({ onStart }: { onStart: () => void }) {
  return (
    <View style={s.hero}>
      <Text style={s.label}>TRADE BALANCE</Text>
      <View style={s.tradeRow}>
        <View>
          <Text style={s.meta}>Your side</Text>
          <Text style={s.tradeValue}>$186.40</Text>
        </View>
        <Ionicons name="swap-horizontal" size={26} color={B.cyan} />
        <View style={s.alignEnd}>
          <Text style={s.meta}>Their side</Text>
          <Text style={s.tradeValue}>$178.25</Text>
        </View>
      </View>
      <View style={s.balance}>
        <Text style={s.balanceLabel}>Difference</Text>
        <Text style={s.balanceValue}>$8.15 in your favor</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onStart} style={s.primary}>
        <Text style={s.primaryText}>Build a new trade</Text>
        <Ionicons name="add" size={20} color="#fff" />
      </Pressable>
    </View>
  );
}

function Sealed({ onStart }: { onStart: () => void }) {
  return (
    <View style={s.hero}>
      <Text style={s.label}>SEALED PRODUCT EVALUATOR</Text>
      <Text style={s.product}>Commander Deck Sample</Text>
      <View style={s.sealedGrid}>
        <Summary label="Sealed price" value="$54.99" />
        <Summary label="Singles value" value="$82.40" />
        <Summary label="Net breakdown" value="$59.75" />
      </View>
      <View style={s.good}>
        <Ionicons name="analytics" size={21} color={B.green} />
        <View style={s.flex}>
          <Text style={s.goodTitle}>Marginal breakdown opportunity</Text>
          <Text style={s.meta}>About $4.76 before labor. Keeping sealed may be preferable.</Text>
        </View>
      </View>
      <Pressable accessibilityRole="button" onPress={onStart} style={s.primary}>
        <Text style={s.primaryText}>Scan a sealed product</Text>
        <Ionicons name="barcode-outline" size={20} color="#fff" />
      </Pressable>
    </View>
  );
}

function Show({ budget, setBudget, onStart }: { budget: string; setBudget: (value: string) => void; onStart: () => void }) {
  return (
    <View style={s.hero}>
      <Text style={s.label}>CARD-SHOW SESSION</Text>
      <Text style={s.product}>Phoenix Card Expo</Text>
      <Field label="BUYING BUDGET" value={budget} setValue={setBudget} prefix="$" />
      <View style={s.sealedGrid}>
        <Summary label="Spent" value="$1,422" />
        <Summary label="Market acquired" value="$2,184" />
        <Summary label="Average cost" value="65.1%" />
      </View>
      <Pressable accessibilityRole="button" onPress={onStart} style={s.primary}>
        <Text style={s.primaryText}>Open show session</Text>
        <Ionicons name="arrow-forward" size={20} color="#fff" />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: B.bg },
  content: { padding: 20, paddingTop: 58, paddingBottom: 130 },
  active: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: B.surface2, borderRadius: 20, padding: 14, marginTop: 16, borderWidth: 1, borderColor: B.green + '55' },
  activeDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: B.green },
  activeLabel: { color: B.green, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  activeName: { color: B.text, fontWeight: '900', fontSize: 14, marginTop: 3 },
  alignEnd: { alignItems: 'flex-end' },
  error: { backgroundColor: B.surface2, borderRadius: 18, padding: 14, marginTop: 16, borderWidth: 1, borderColor: B.danger + '55' },
  errorTitle: { color: B.danger, fontSize: 13, fontWeight: '900' },
  flex: { flex: 1 },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  kicker: { color: B.cyan, fontSize: 10, fontWeight: '900', letterSpacing: 1.7 },
  title: { color: B.text, fontSize: 34, lineHeight: 38, fontWeight: '900', letterSpacing: -1.1, marginTop: 10 },
  sub: { color: B.muted, fontSize: 13, lineHeight: 19, marginTop: 10 },
  modeRow: { gap: 9, paddingVertical: 20 },
  mode: { height: 43, borderRadius: 14, paddingHorizontal: 14, backgroundColor: B.surface, flexDirection: 'row', alignItems: 'center', gap: 7 },
  modeActive: { backgroundColor: B.blue },
  modeText: { color: B.muted, fontWeight: '800', fontSize: 12 },
  modeTextActive: { color: '#fff' },
  hero: { backgroundColor: B.surface, borderRadius: 28, padding: 20, borderWidth: 1, borderColor: B.line },
  label: { color: B.cyan, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  value: { color: B.text, fontSize: 48, fontWeight: '900', letterSpacing: -1.6, marginTop: 10 },
  meta: { color: B.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  inputs: { flexDirection: 'row', gap: 12, marginTop: 22 },
  inputLabel: { color: B.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginBottom: 7 },
  inputBox: { height: 52, borderRadius: 15, backgroundColor: B.bg2, borderWidth: 1, borderColor: B.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  input: { flex: 1, color: B.text, fontSize: 17, fontWeight: '900' },
  affix: { color: B.muted, fontWeight: '900' },
  summary: { flexDirection: 'row', justifyContent: 'space-between', padding: 18, backgroundColor: B.surface, borderRadius: 22, marginTop: 12 },
  summaryValue: { color: B.text, fontWeight: '900', fontSize: 17 },
  primary: { height: 56, borderRadius: 17, backgroundColor: B.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 14 },
  primaryText: { color: '#fff', fontWeight: '900' },
  section: { color: B.text, fontSize: 17, fontWeight: '900', marginTop: 24, marginBottom: 11 },
  profile: { backgroundColor: B.surface, borderRadius: 20, padding: 17, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  profileTitle: { color: B.text, fontWeight: '900', fontSize: 14 },
  tradeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 23 },
  tradeValue: { color: B.text, fontSize: 25, fontWeight: '900', marginTop: 5 },
  balance: { backgroundColor: B.green + '16', borderRadius: 16, padding: 14, marginTop: 18 },
  balanceLabel: { color: B.green, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  balanceValue: { color: B.text, fontSize: 16, fontWeight: '900', marginTop: 5 },
  product: { color: B.text, fontSize: 24, fontWeight: '900', marginTop: 10 },
  sealedGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 22, paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: B.line },
  good: { flexDirection: 'row', gap: 11, alignItems: 'center', backgroundColor: B.green + '12', borderRadius: 17, padding: 14, marginTop: 16 },
  goodTitle: { color: B.text, fontWeight: '900', fontSize: 13 },
});
