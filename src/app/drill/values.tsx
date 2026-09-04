import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '../../components/common/AppScreen';
import { ProgressionHeader } from '../../components/progression/ProgressionHeader';
import { DojoButton } from '../../components/dojo/DojoButton';
import { StreakFlame } from '../../components/dojo/StreakFlame';
import { TipToast } from '../../components/dojo/TipToast';
import { PlayingCard } from '../../components/game/PlayingCard';
import { buildValuesDrill, scoreDrill } from '../../engine/dojo';
import { hiLoValue } from '../../engine/cards/card';
import { useDojoStore } from '../../stores/dojoStore';
import { colors, fontSizes, fontWeights, layout, radii, spacing } from '../../theme';

export default function ValuesDrillScreen() {
  const router = useRouter();
  const recordDrillResult = useDojoStore((state) => state.recordDrillResult);
  const touchPractice = useDojoStore((state) => state.touchPractice);

  const cards = useMemo(() => buildValuesDrill(20), []);
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [tip, setTip] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    touchPractice();
  }, [touchPractice]);

  const current = cards[index];

  function answer(value: -1 | 0 | 1) {
    if (finished || !current) return;
    const isCorrect = hiLoValue(current.card.rank) === value;
    if (isCorrect) {
      setCorrect((c) => c + 1);
      setStreak((s) => {
        const next = s + 1;
        setBestStreak((b) => Math.max(b, next));
        return next;
      });
    } else {
      setStreak(0);
      setTip(
        `${current.card.rank} is ${hiLoValue(current.card.rank) > 0 ? '+1' : hiLoValue(current.card.rank) < 0 ? '−1' : '0'}. Keep going!`,
      );
    }

    if (index >= cards.length - 1) {
      const result = scoreDrill(correct + (isCorrect ? 1 : 0), cards.length, 8);
      recordDrillResult('values', result);
      setFinished(true);
    } else {
      setIndex((i) => i + 1);
    }
  }

  function reset() {
    setIndex(0);
    setCorrect(0);
    setStreak(0);
    setBestStreak(0);
    setTip(null);
    setFinished(false);
  }

  return (
    <AppScreen header={<ProgressionHeader />} scroll={false}>
      <View style={styles.root}>
        <Text style={styles.title}>Value Flash</Text>
        <Text style={styles.subtitle}>Tap the Hi-Lo value for each card.</Text>

        <View style={styles.statsRow}>
          <Text style={styles.counter}>
            {index + (finished ? 0 : 1)} / {cards.length}
          </Text>
          <StreakFlame streak={streak} />
          <Text style={styles.accuracy}>Best streak: {bestStreak}</Text>
        </View>

        {finished ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Drill Complete</Text>
            <Text style={styles.resultBody}>
              {correct} / {cards.length} correct ({Math.round((correct / cards.length) * 100)}%)
            </Text>
            <DojoButton label="Drill Again" onPress={reset} />
            <DojoButton label="Back to Drills" variant="secondary" onPress={() => router.replace('/drill')} />
          </View>
        ) : (
          <>
            <View style={styles.cardArea}>
              <PlayingCard
                card={current!.card}
                skin="regular"
                width={layout.maxContentWidth * 0.45}
                underglow={false}
                speed={1}
              />
            </View>

            <View style={styles.pad}>
              <DojoButton label="−1" variant="secondary" onPress={() => answer(-1)} />
              <DojoButton label="0" variant="secondary" onPress={() => answer(0)} />
              <DojoButton label="+1" variant="secondary" onPress={() => answer(1)} />
            </View>
          </>
        )}

        {tip ? <TipToast message={tip} variant="warning" onDismiss={() => setTip(null)} /> : null}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingVertical: spacing.xl,
    gap: spacing.lg,
    alignItems: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.title,
    fontWeight: fontWeights.heavy,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: spacing.md,
  },
  counter: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.bold,
    fontVariant: ['tabular-nums'],
  },
  accuracy: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.bold,
  },
  cardArea: {
    flex: 1,
    justifyContent: 'center',
  },
  pad: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  resultCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
    width: '100%',
  },
  resultTitle: {
    color: colors.gold,
    fontSize: fontSizes.title,
    fontWeight: fontWeights.heavy,
  },
  resultBody: {
    color: colors.textSecondary,
    fontSize: fontSizes.subtitle,
  },
});
