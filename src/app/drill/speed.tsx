import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '../../components/common/AppScreen';
import { ProgressionHeader } from '../../components/progression/ProgressionHeader';
import { CountingKeyboard } from '../../components/dojo/CountingKeyboard';
import { DojoButton } from '../../components/dojo/DojoButton';
import { StreakFlame } from '../../components/dojo/StreakFlame';
import { TipToast } from '../../components/dojo/TipToast';
import { PlayingCard } from '../../components/game/PlayingCard';
import { dealSpeedDrill, scoreDrill } from '../../engine/dojo';
import { useDojoStore } from '../../stores/dojoStore';
import { colors, fontSizes, fontWeights, layout, radii, spacing } from '../../theme';

const FLASH_MS = 650;

export default function SpeedDrillScreen() {
  const router = useRouter();
  const recordDrillResult = useDojoStore((state) => state.recordDrillResult);
  const touchPractice = useDojoStore((state) => state.touchPractice);

  const drill = useMemo(() => dealSpeedDrill(1, 10), []);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'flashing' | 'question' | 'done'>('flashing');
  const [guess, setGuess] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [tip, setTip] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    touchPractice();
  }, [touchPractice]);

  useEffect(() => {
    if (phase !== 'flashing') return;
    const timer = setTimeout(() => {
      setIndex((current) => {
        const next = current + 1;
        if (next >= drill.cards.length) {
          setPhase('question');
          return current;
        }
        return next;
      });
    }, FLASH_MS);
    return () => clearTimeout(timer);
  }, [phase, tick, drill.cards.length]);

  function submit() {
    const isCorrect = guess === drill.finalCount;
    if (isCorrect) {
      setStreak((s) => {
        const next = s + 1;
        setBestStreak((b) => Math.max(b, next));
        return next;
      });
    } else {
      setStreak(0);
      setTip(`The running count was ${drill.finalCount > 0 ? `+${drill.finalCount}` : drill.finalCount}.`);
    }
    const result = scoreDrill(isCorrect ? 1 : 0, 1, 12);
    recordDrillResult('speed', result);
    setPhase('done');
  }

  function reset() {
    setIndex(0);
    setPhase('flashing');
    setGuess(0);
    setTip(null);
    setTick((t) => t + 1);
  }

  if (phase === 'done') {
    return (
      <AppScreen header={<ProgressionHeader />}>
        <View style={styles.done}>
          <Text style={styles.doneTitle}>Speed Drill Complete</Text>
          <Text style={styles.doneBody}>Best streak: {bestStreak}</Text>
          <DojoButton label="Again" onPress={reset} />
          <DojoButton label="Back to Drills" variant="secondary" onPress={() => router.replace('/drill')} />
        </View>
      </AppScreen>
    );
  }

  const currentCard = drill.cards[index];

  return (
    <AppScreen header={<ProgressionHeader />} scroll={false}>
      <View style={styles.root}>
        <Text style={styles.title}>Speed Count</Text>
        <Text style={styles.subtitle}>
          {phase === 'flashing' ? 'Watch the cards…' : 'What was the final running count?'}
        </Text>

        <View style={styles.statsRow}>
          <StreakFlame streak={streak} />
          <Text style={styles.counter}>
            {Math.min(index, drill.cards.length)} / {drill.cards.length}
          </Text>
        </View>

        <View style={styles.cardArea}>
          {phase === 'flashing' && currentCard ? (
            <PlayingCard
              card={currentCard.card}
              skin="regular"
              width={layout.maxContentWidth * 0.42}
              underglow={false}
              speed={1}
            />
          ) : phase === 'question' ? (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>?</Text>
            </View>
          ) : null}
        </View>

        {phase === 'question' ? (
          <CountingKeyboard
            value={guess}
            onChange={setGuess}
            onSubmit={submit}
            submitLabel="Submit Count"
          />
        ) : null}

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
    textAlign: 'center',
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
  },
  cardArea: {
    flex: 1,
    justifyContent: 'center',
  },
  placeholder: {
    width: layout.maxContentWidth * 0.42,
    aspectRatio: 500 / 700,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.borderGold,
  },
  placeholderText: {
    color: colors.gold,
    fontSize: fontSizes.title,
    fontWeight: fontWeights.heavy,
  },
  done: {
    flex: 1,
    gap: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  doneTitle: {
    color: colors.gold,
    fontSize: fontSizes.title,
    fontWeight: fontWeights.heavy,
    textAlign: 'center',
  },
  doneBody: {
    color: colors.textSecondary,
    fontSize: fontSizes.subtitle,
    textAlign: 'center',
  },
});
