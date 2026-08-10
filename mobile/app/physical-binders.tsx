import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  TDBadge,
  TDButton,
  TDCard,
  TDEmptyState,
  TDErrorState,
  TDIconButton,
  TDListRow,
  TDLoadingState,
  TDMetric,
  TDNavigationHeader,
  TDScreen,
  TDStatusIndicator,
  TDText,
} from '@/components/design-system';
import { color, radius, space } from '@/design';
import { getMobileScrollBottomInset } from '@/services/navigation-contract';
import { createMobileBinderShare, loadMobilePhysicalBinders, revokeMobileBinderShare, type MobilePhysicalBinderState } from '@/services/physical-binder-data';
import { binderShareStatusLabel, buildBinderSpread, type PhysicalBinderSummary } from '@/services/physical-binder';

export default function PhysicalBindersScreen() {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<MobilePhysicalBinderState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);

  const reload = () => {
    setLoading(true);
    void loadMobilePhysicalBinders()
      .then((result) => {
        setState(result);
        setSelectedId((current) => current ?? result.activeBinder?.id ?? null);
        setError(null);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Binders could not be loaded.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    void Promise.resolve().then(reload);
  }, []);

  const selected = useMemo(
    () => state?.binders.find((binder) => binder.id === selectedId || binder.locationId === selectedId) ?? state?.activeBinder ?? null,
    [selectedId, state],
  );
  const spread = useMemo(
    () => selected && state ? buildBinderSpread(selected, page, state.placements.filter((placement) => placement.card.storageLocation?.id === selected.locationId)) : null,
    [page, selected, state],
  );

  const createShare = async () => {
    if (!selected || shareBusy) return;
    setShareBusy(true);
    const result = await createMobileBinderShare({ binderId: selected.locationId, scope: 'binder', visibility: 'unlisted' });
    setShareBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await Share.share({ message: result.url, url: result.url });
    reload();
  };

  const revokeShare = () => {
    if (!selected?.shareLink || shareBusy) return;
    Alert.alert('Disable share link?', 'The public binder link will stop working.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disable',
        style: 'destructive',
        onPress: () => {
          setShareBusy(true);
          void revokeMobileBinderShare(selected.shareLink!.token)
            .then((result) => {
              if (!result.ok) setError(result.error);
              reload();
            })
            .finally(() => setShareBusy(false));
        },
      },
    ]);
  };

  if (loading) return <TDScreen style={s.screen}><TDLoadingState title="Loading binders" message="Opening physical pages." /></TDScreen>;
  if (!state) return <TDScreen style={s.screen}><TDErrorState title="Binders unavailable" message={error ?? 'Physical binders could not be loaded.'} action={<TDButton label="Retry" onPress={reload} />} /></TDScreen>;

  return (
    <TDScreen style={s.screen}>
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: getMobileScrollBottomInset(insets.bottom) }]} showsVerticalScrollIndicator={false}>
        <TDNavigationHeader
          eyebrow="Physical Binder"
          title="Binder dock"
          subtitle="Open pages, see pockets, and share a read-only public binder."
          leftAction={<TDIconButton label="Back" iconName="chevron-back" onPress={() => router.back()} />}
          rightAction={state.stale ? <TDBadge tone="warning">Stale</TDBadge> : undefined}
        />

        {error ? <TDStatusIndicator tone="warning" label={error} /> : null}

        {state.binders.length ? (
          <View style={s.binderList}>
            {state.binders.map((binder) => (
              <BinderCover key={binder.id} binder={binder} selected={selected?.id === binder.id} onPress={() => { setSelectedId(binder.id); setPage(1); }} />
            ))}
          </View>
        ) : (
          <TDEmptyState title="No physical binders yet" message="Create a binder storage location, then assign cards with page and slot metadata." action={<TDButton label="Open storage" onPress={() => router.push('/storage-locations' as never)} />} />
        )}

        {selected && spread ? (
          <TDCard style={s.detail}>
            <View style={s.detailTop}>
              <View style={s.flex}>
                <TDText variant="heading">{selected.name}</TDText>
                <TDText variant="small" tone="muted">{selected.description || 'Physical card placement'}</TDText>
              </View>
              <TDBadge tone={selected.isTradeBinder ? 'success' : 'info'}>{selected.isTradeBinder ? 'Tradeable' : 'Collection'}</TDBadge>
            </View>
            <View style={s.metrics}>
              <TDMetric label="Cards" value={String(selected.cardCount)} compact />
              <TDMetric label="Pockets" value={`${selected.occupiedPockets}/${selected.pageCount * selected.rows * selected.columns}`} compact tone="info" />
              <TDMetric label="Share" value={binderShareStatusLabel(selected.shareLink)} compact tone={selected.shareLink ? 'success' : 'neutral'} />
            </View>
            <View style={s.pageControls}>
              <TDButton label="Prev" variant="secondary" disabled={page <= 1} onPress={() => setPage((current) => Math.max(1, current - 2))} />
              <TDText variant="caption" tone="muted">{spread.pageDepthLabel}</TDText>
              <TDButton label="Next" variant="secondary" disabled={page + 1 >= selected.pageCount} onPress={() => setPage((current) => Math.min(selected.pageCount, current + 2))} />
            </View>
            <View style={s.spread}>
              {[spread.left, spread.right].map((binderPage) => (
                <View key={`${binderPage.side}-${binderPage.page}`} style={s.page}>
                  <TDText variant="caption" tone="muted">Page {binderPage.page}</TDText>
                  <View style={s.pocketGrid}>
                    {binderPage.pockets.map((pocket) => (
                      <View key={`${binderPage.page}-${pocket.slot}`} style={s.pocket}>
                        {pocket.placement?.card.printing.imageUrl ? (
                          <Image
                            source={{ uri: pocket.placement.card.printing.imageUrl }}
                            style={s.pocketImage}
                            contentFit="cover"
                            alt={`${pocket.placement.card.cardName} in pocket ${pocket.slot}`}
                            accessibilityLabel={`${pocket.placement.card.cardName} in pocket ${pocket.slot}`}
                          />
                        ) : (
                          <View style={s.emptyPocket}><TDText variant="caption" tone="muted">{pocket.slot}</TDText></View>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
            <View style={s.shareActions}>
              <TDButton label={selected.shareLink ? 'Share link' : 'Create share link'} loading={shareBusy} onPress={createShare} />
              {selected.shareLink ? <TDButton label="Disable link" variant="danger" loading={shareBusy} onPress={revokeShare} /> : null}
            </View>
            <TDListRow title="Add or move cards" description="Use card detail or Storage map to assign binder page and slot." iconName="albums-outline" onPress={() => router.push('/storage-locations' as never)} />
          </TDCard>
        ) : null}
      </ScrollView>
    </TDScreen>
  );
}

function BinderCover({ binder, selected, onPress }: { binder: PhysicalBinderSummary; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`Open ${binder.name}. ${binder.cardCount} cards.`} onPress={onPress} style={[s.cover, selected && s.coverSelected, { backgroundColor: binder.coverColor }]}>
      <View style={[s.coverAccent, { backgroundColor: binder.accentColor }]} />
      <View style={s.coverCopy}>
        <TDText variant="title" numberOfLines={2}>{binder.name}</TDText>
        <TDText variant="caption" tone="muted">{binder.cardCount} cards - {binder.occupiedPockets} pockets</TDText>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  screen: { paddingTop: 56 },
  content: { gap: space.md },
  binderList: { flexDirection: 'row', gap: space.sm },
  cover: { width: 126, aspectRatio: 0.74, borderRadius: radius.lg, padding: space.sm, overflow: 'hidden', justifyContent: 'flex-end', borderWidth: 1, borderColor: color.border },
  coverSelected: { borderColor: color.primaryBright },
  coverAccent: { position: 'absolute', right: -30, top: -20, width: 86, height: 86, borderRadius: 86, opacity: 0.28 },
  coverCopy: { gap: space.xs },
  detail: { gap: space.md },
  detailTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  flex: { flex: 1, minWidth: 0 },
  metrics: { flexDirection: 'row', gap: space.sm },
  pageControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  spread: { flexDirection: 'row', gap: space.sm },
  page: { flex: 1, gap: space.xs, padding: space.xs, borderRadius: radius.md, backgroundColor: color.canvasRaised },
  pocketGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  pocket: { width: '31%', aspectRatio: 0.72, borderRadius: radius.xs, overflow: 'hidden', backgroundColor: color.surface },
  pocketImage: { width: '100%', height: '100%' },
  emptyPocket: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: color.border },
  shareActions: { flexDirection: 'row', gap: space.sm },
});
