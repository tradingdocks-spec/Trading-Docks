import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  TDBadge,
  TDButton,
  TDCard,
  TDEmptyState,
  TDErrorState,
  TDIconButton,
  TDListRow,
  TDLoadingState,
  TDNavigationHeader,
  TDStatusIndicator,
  TDScreen,
  TDText,
} from '@/components/design-system';
import { space } from '@/design';
import { supabase } from '@/lib/supabase';
import { useAccount } from '@/providers/account';
import {
  discardQueuedScannerAdd,
  listScannerQueuedAdds,
  retryQueuedScannerAdd,
  retryQueuedScannerAdds,
  type ScannerQueuedAdd,
} from '@/services/scanner-replay';
import { releaseEmptyState, releaseLoadingState, releaseSyncCopy } from '@/services/mobile-release-ux';

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
      if (!supabase) throw new Error('Scanner sync is unavailable right now.');
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

  if (loading) {
    const copy = releaseLoadingState('scanner_session');
    return <TDScreen style={s.screen}><TDLoadingState title={copy.title} message={copy.message} /></TDScreen>;
  }

  return (
    <TDScreen style={s.screen}>
      <ScrollView contentContainerStyle={s.content}>
        <TDNavigationHeader
          eyebrow="Scanner sync"
          title="Queued scans"
          subtitle="Retry or review card adds saved for this signed-in account."
          leftAction={<TDIconButton label="Back to scanner" iconName="chevron-back" onPress={() => router.back()} />}
          rightAction={<TDStatusIndicator label={queue.length ? `${queue.length} pending` : 'Clear'} tone={queue.length ? 'warning' : 'success'} />}
        />

        {error ? <TDErrorState title="Scanner recovery unavailable" message={error} /> : null}
        {!queue.length && !error ? (
          <TDEmptyState
            title={releaseEmptyState('scanner_session').title}
            message="Offline or failed scanner adds for this account will appear here."
            action={<TDButton label="Open scanner" onPress={() => router.push('/(tabs)/scan' as never)} />}
          />
        ) : null}

        {queue.length ? (
          <TDCard style={s.actions}>
            <View style={s.flex}>
              <TDText variant="title">{queue.length} scan{queue.length === 1 ? '' : 's'} waiting</TDText>
              <TDText variant="small" tone="muted">Retry when the connection and session are healthy, or inspect entries that require action.</TDText>
            </View>
            <TDButton label="Retry all" loading={syncing === 'all'} onPress={retryAll} />
          </TDCard>
        ) : null}

        {queue.map((entry) => {
          const copy = scannerRecoveryCopy(entry);
          return (
            <View key={entry.operationId} style={s.entry}>
              <TDListRow
                title={entry.confirmation.candidate.name}
                eyebrow={copy.title}
                description={`${entry.confirmation.candidate.setCode ?? 'Set unavailable'} #${entry.confirmation.candidate.collectorNumber ?? '?'} - Qty ${entry.confirmation.quantity}`}
                iconName="scan-outline"
                right={<TDBadge tone={entry.syncState === 'action_required' ? 'warning' : entry.syncState === 'failed' ? 'danger' : 'info'}>{entry.syncState.replaceAll('_', ' ')}</TDBadge>}
              />
              <TDText variant="small" tone={entry.syncState === 'failed' ? 'warning' : 'muted'}>{copy.message}</TDText>
              {expanded === entry.operationId ? (
                <TDCard variant="outlined" style={s.details}>
                  <Detail label="Condition" value={entry.confirmation.condition} />
                  <Detail label="Finish" value={entry.confirmation.finish} />
                  <Detail label="Language" value={entry.confirmation.language ?? 'Unavailable'} />
                  <Detail label="Storage" value={entry.confirmation.storageLocationId ?? 'Unassigned'} />
                  <Detail label="Trade Binder" value={entry.confirmation.tradeStatus.replaceAll('_', ' ')} />
                  <Detail label="Wishlist" value={entry.confirmation.addToWishlist ? 'Add exact target' : 'No wishlist change'} />
                </TDCard>
              ) : null}
              <View style={s.entryActions}>
                <TDButton label={expanded === entry.operationId ? 'Hide details' : 'Inspect'} variant="secondary" onPress={() => setExpanded(expanded === entry.operationId ? null : entry.operationId)} />
                <TDButton label="Retry" variant="secondary" loading={syncing === entry.operationId} onPress={() => retryOne(entry.operationId)} />
                <TDButton label={confirmDiscard === entry.operationId ? 'Confirm discard' : 'Discard'} variant={confirmDiscard === entry.operationId ? 'danger' : 'secondary'} onPress={() => discardOne(entry.operationId)} />
              </View>
            </View>
          );
        })}
      </ScrollView>
    </TDScreen>
  );
}

function scannerRecoveryCopy(entry: ScannerQueuedAdd) {
  if (entry.syncState === 'action_required') {
    if (entry.errorCode === 'free_limit') return { title: 'Action required', message: 'This add exceeds the Free collection limit. Change plan or adjust quantity, then retry.' };
    if (entry.errorCode === 'unauthorized') return { title: 'Sign in required', message: 'Sign in to the same account before retrying this queued scan.' };
    if (entry.errorCode === 'invalid_quantity') return { title: 'Quantity needs review', message: 'Open details, confirm quantity, then retry from the scanner flow.' };
    if (entry.errorCode === 'invalid_printing') return { title: 'Printing needs review', message: 'Confirm the exact printing before this scan can be saved.' };
    return { title: 'Account needs review', message: 'This queued scan needs account or membership information before it can sync.' };
  }
  if (entry.syncState === 'failed') {
    const copy = releaseSyncCopy('sync_failed');
    return { title: copy.label, message: copy.message };
  }
  if (entry.syncState === 'syncing') {
    const copy = releaseSyncCopy('syncing');
    return { title: copy.label, message: copy.message };
  }
  const copy = releaseSyncCopy('pending_changes');
  return { title: copy.label, message: copy.message };
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
  flex: { flex: 1 },
  actions: { gap: space.md },
  entry: { gap: space.md },
  entryActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  details: { gap: space.xs },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
});
