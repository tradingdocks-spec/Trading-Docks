import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { TDButton, TDCard, TDEmptyState, TDErrorState, TDLoadingState, TDScreen, TDText, TDBadge } from '@/components/design-system';
import { color, radius, space } from '@/design';
import { supabase } from '@/lib/supabase';
import { useAccount } from '@/providers/account';
import {
  discardQueuedScannerAdd,
  listScannerQueuedAdds,
  retryQueuedScannerAdd,
  retryQueuedScannerAdds,
  type ScannerQueuedAdd,
} from '@/services/scanner-replay';

export default function ScannerRecovery() {
  const { accountType } = useAccount();
  const [userId, setUserId] = useState<string | null>(null);
  const [queue, setQueue] = useState<ScannerQueuedAdd[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!supabase) throw new Error('Scanner sync is unavailable while Supabase is not configured.');
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError || !data.user) throw new Error('Sign in again to review queued scans.');
      setUserId(data.user.id);
      setQueue(await listScannerQueuedAdds(data.user.id));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Queued scans are unavailable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const retryOne = async (operationId: string) => {
    if (!userId) return;
    setSyncing(operationId);
    await retryQueuedScannerAdd({ operationId, userId, membershipTier: accountType });
    setQueue(await listScannerQueuedAdds(userId));
    setSyncing(null);
  };

  const retryAll = async () => {
    if (!userId) return;
    setSyncing('all');
    await retryQueuedScannerAdds({ userId, membershipTier: accountType, trigger: 'manual_retry' });
    setQueue(await listScannerQueuedAdds(userId));
    setSyncing(null);
  };

  const discardOne = async (operationId: string) => {
    if (!userId) return;
    if (confirmDiscard !== operationId) {
      setConfirmDiscard(operationId);
      return;
    }
    await discardQueuedScannerAdd(operationId, userId, true);
    setQueue(await listScannerQueuedAdds(userId));
    setConfirmDiscard(null);
  };

  if (loading) return <TDScreen style={s.screen}><TDLoadingState title="Loading queued scans" message="Checking scanner sync state for this account." /></TDScreen>;

  return (
    <TDScreen style={s.screen}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to scanner" onPress={() => router.back()} style={s.backButton}>
            <Ionicons name="chevron-back" size={20} color={color.text} />
          </Pressable>
          <View style={s.flex}>
            <TDText variant="label" tone="info">Scanner sync</TDText>
            <TDText variant="display">Queued scans</TDText>
          </View>
        </View>

        {error ? <TDErrorState title="Scanner recovery unavailable" message={error} /> : null}
        {!queue.length && !error ? <TDEmptyState title="No queued scans" message="Offline or failed scanner adds for this account will appear here." /> : null}

        {queue.length ? (
          <TDCard style={s.actions}>
            <View style={s.flex}>
              <TDText variant="title">{queue.length} scan{queue.length === 1 ? '' : 's'} waiting</TDText>
              <TDText variant="small" tone="muted">Retry when the connection and session are healthy, or inspect entries that require action.</TDText>
            </View>
            <TDButton label="Retry all" loading={syncing === 'all'} onPress={retryAll} />
          </TDCard>
        ) : null}

        {queue.map((entry) => (
          <TDCard key={entry.operationId} style={s.entry}>
            <View style={s.entryHeader}>
              <View style={s.flex}>
                <TDText variant="title">{entry.confirmation.candidate.name}</TDText>
                <TDText variant="caption" tone="muted">
                  {entry.confirmation.candidate.setCode ?? 'Set unavailable'} #{entry.confirmation.candidate.collectorNumber ?? '?'} · Qty {entry.confirmation.quantity}
                </TDText>
              </View>
              <TDBadge tone={entry.syncState === 'action_required' ? 'warning' : entry.syncState === 'failed' ? 'danger' : 'info'}>
                {entry.syncState.replaceAll('_', ' ')}
              </TDBadge>
            </View>
            {entry.lastError ? <TDText variant="small" tone="warning">{entry.lastError}</TDText> : null}
            {expanded === entry.operationId ? (
              <View style={s.details}>
                <Detail label="Condition" value={entry.confirmation.condition} />
                <Detail label="Finish" value={entry.confirmation.finish} />
                <Detail label="Language" value={entry.confirmation.language ?? 'Unavailable'} />
                <Detail label="Storage" value={entry.confirmation.storageLocationId ?? 'Unassigned'} />
                <Detail label="Trade Binder" value={entry.confirmation.tradeStatus.replaceAll('_', ' ')} />
                <Detail label="Wishlist" value={entry.confirmation.addToWishlist ? 'Add exact target' : 'No wishlist change'} />
                <Detail label="Idempotency" value={entry.idempotencyKey} />
              </View>
            ) : null}
            <View style={s.entryActions}>
              <TDButton label={expanded === entry.operationId ? 'Hide details' : 'Inspect'} variant="secondary" onPress={() => setExpanded(expanded === entry.operationId ? null : entry.operationId)} />
              <TDButton label="Retry" variant="secondary" loading={syncing === entry.operationId} onPress={() => retryOne(entry.operationId)} />
              <TDButton label={confirmDiscard === entry.operationId ? 'Confirm discard' : 'Discard'} variant="secondary" onPress={() => discardOne(entry.operationId)} />
            </View>
          </TDCard>
        ))}
      </ScrollView>
    </TDScreen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.detailRow}>
      <TDText variant="caption" tone="muted">{label}</TDText>
      <TDText variant="caption">{value}</TDText>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { paddingTop: 56 },
  content: { gap: space.md, paddingBottom: 128 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  backButton: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: color.canvasRaised },
  flex: { flex: 1 },
  actions: { gap: space.md },
  entry: { gap: space.md },
  entryHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  entryActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  details: { gap: space.xs, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, padding: space.sm },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
});
