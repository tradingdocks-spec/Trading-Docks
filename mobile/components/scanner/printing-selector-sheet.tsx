import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { TDBadge, TDButton, TDErrorState, TDLoadingState, TDSheet, TDText } from '@/components/design-system';
import { color, radius, space } from '@/design';
import { displayFinish, type CardFinish } from '@/services/collector-workspace';
import { defaultFinishForPrinting, supportedVisibleFinishes } from '@/services/exact-printing-recognition';
import { lookupScannerPrintings } from '@/services/scanner-printing-lookup';
import { selectScryfallScannerPrice } from '@/services/scanner-price-enrichment';
import type { ScannerCardCandidate } from '@/services/scanner-foundation';

type PrintingFilter = 'all' | 'nonfoil' | 'foil' | 'special';

export function PrintingSelectorSheet({
  visible,
  currentCandidate,
  currentFinish,
  onClose,
  onSelect,
}: {
  visible: boolean;
  currentCandidate: ScannerCardCandidate | null;
  currentFinish: CardFinish | string;
  onClose: () => void;
  onSelect: (candidate: ScannerCardCandidate, finish: CardFinish, message: string | null) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printings, setPrintings] = useState<ScannerCardCandidate[]>([]);
  const [filter, setFilter] = useState<PrintingFilter>('all');
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    setPrintings([]);
    if (!visible || !currentCandidate?.oracleId) {
      setLoading(Boolean(visible && currentCandidate));
      setError(null);
      return undefined;
    }
    setLoading(true);
    setError(null);
    void lookupScannerPrintings({ oracleId: currentCandidate.oracleId })
      .then((result) => {
        if (requestId !== requestIdRef.current) return;
        if (!result.ok) {
          setError(result.reason);
          setPrintings([]);
          return;
        }
        setPrintings(sortPrintings(result.candidates, currentCandidate));
      })
      .catch((lookupError) => {
        if (requestId === requestIdRef.current) setError(lookupError instanceof Error ? lookupError.message : 'Printings could not be loaded.');
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });
    return () => {
      requestIdRef.current += 1;
    };
  }, [currentCandidate, visible]);

  const visiblePrintings = useMemo(() => printings.filter((candidate) => printingMatchesFilter(candidate, filter)), [filter, printings]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.scrim}>
        <TDSheet title="Other printings" onClose={onClose} style={s.sheet}>
          <View style={s.filterRow}>
            {(['all', 'nonfoil', 'foil', 'special'] as const).map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected: filter === option }}
                accessibilityLabel={`Filter printings by ${option}`}
                onPress={() => setFilter(option)}
                style={[s.filterChip, filter === option && s.filterChipActive]}
              >
                <TDText variant="caption" tone={filter === option ? 'primary' : 'muted'}>{filterLabel(option)}</TDText>
              </Pressable>
            ))}
          </View>
          {loading ? <TDLoadingState title="Loading printings" message={currentCandidate?.oracleId ? 'Checking Scryfall for exact printings.' : 'Resolving printing information.'} /> : null}
          {error ? <TDErrorState title="Printings unavailable" message={error} action={<TDButton label="Close" variant="secondary" onPress={onClose} />} /> : null}
          {!loading && !error ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.list}>
              {visiblePrintings.map((candidate) => {
                const supported = supportedVisibleFinishes(candidate);
                const selected = candidate.id === currentCandidate?.id;
                const defaultFinish = defaultFinishForPrinting(candidate, currentFinish);
                const price = selectScryfallScannerPrice(candidate, defaultFinish.finish);
                return (
                  <Pressable
                    key={candidate.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Select ${candidate.name} ${candidate.setCode ?? 'set unavailable'} collector number ${candidate.collectorNumber ?? 'unavailable'}`}
                    onPress={() => onSelect(candidate, defaultFinish.finish, defaultFinish.fallbackMessage)}
                    style={({ pressed }) => [s.printingRow, selected && s.printingRowSelected, pressed && s.pressed]}
                  >
                    {candidate.imageUrl ? <Image source={{ uri: candidate.imageUrl }} style={s.image} contentFit="cover" /> : <View style={s.imageMissing}><Ionicons name="image-outline" size={20} color={color.textMuted} /></View>}
                    <View style={s.copy}>
                      <View style={s.titleRow}>
                        <TDText variant="small" numberOfLines={2} style={s.name}>{candidate.name}</TDText>
                        {selected ? <TDBadge tone="success">Current</TDBadge> : null}
                      </View>
                      <TDText variant="caption" tone="muted" numberOfLines={1}>{candidate.setCode ?? 'SET'} #{candidate.collectorNumber ?? '?'} {releaseYear(candidate)}</TDText>
                      <TDText variant="caption" tone="muted" numberOfLines={1}>{supported.map(displayFinish).join(' / ') || 'Finish unavailable'}</TDText>
                      <View style={s.badgeRow}>
                        {(candidate.specialPrintingLabels ?? []).slice(0, 3).map((label) => <TDBadge key={label} tone="info">{label}</TDBadge>)}
                        <TDText variant="caption" tone={price === null ? 'muted' : 'success'}>{price === null ? 'Price unavailable' : `$${price.toFixed(2)}`}</TDText>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
        </TDSheet>
      </View>
    </Modal>
  );
}

function sortPrintings(printings: ScannerCardCandidate[], current: ScannerCardCandidate) {
  return [...printings].sort((a, b) => {
    if (a.id === current.id) return -1;
    if (b.id === current.id) return 1;
    const aExact = a.setCode === current.setCode && a.collectorNumber === current.collectorNumber ? 1 : 0;
    const bExact = b.setCode === current.setCode && b.collectorNumber === current.collectorNumber ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;
    return (b.scryfallMetadata?.releasedAt ?? '').localeCompare(a.scryfallMetadata?.releasedAt ?? '');
  });
}

function printingMatchesFilter(candidate: ScannerCardCandidate, filter: PrintingFilter) {
  if (filter === 'nonfoil') return candidate.finishes.includes('normal');
  if (filter === 'foil') return candidate.finishes.includes('foil') || candidate.finishes.includes('etched');
  if (filter === 'special') return (candidate.specialPrintingLabels?.length ?? 0) > 0;
  return true;
}

function filterLabel(filter: PrintingFilter) {
  if (filter === 'nonfoil') return 'Nonfoil';
  if (filter === 'foil') return 'Foil';
  if (filter === 'special') return 'Special';
  return 'All';
}

function releaseYear(candidate: ScannerCardCandidate) {
  return candidate.scryfallMetadata?.releasedAt ? `- ${candidate.scryfallMetadata.releasedAt.slice(0, 4)}` : '';
}

const s = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000080' },
  sheet: { maxHeight: '88%', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  filterChip: { minHeight: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface },
  filterChipActive: { borderColor: color.primaryBright, backgroundColor: color.primaryBright + '20' },
  list: { gap: space.sm, paddingBottom: space.lg },
  printingRow: { minHeight: 118, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, padding: space.sm, flexDirection: 'row', gap: space.sm, backgroundColor: color.canvasRaised },
  printingRowSelected: { borderColor: color.success },
  pressed: { opacity: 0.85 },
  image: { width: 58, height: 82, borderRadius: radius.sm, backgroundColor: color.surface },
  imageMissing: { width: 58, height: 82, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs },
  name: { flex: 1, minWidth: 0 },
  badgeRow: { minHeight: 24, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs },
});
