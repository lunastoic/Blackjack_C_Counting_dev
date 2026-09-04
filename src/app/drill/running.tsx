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
import { dealRunningDrill, scoreDrill } from '../../engine/dojo';
import { useDojoStore } from '../../stores/dojoStore';
import { colors, fontSizes, fontWeights, layout, spacing } from '../../theme';

export default function RunningDrillScreen() {
  const router = useRouter();
  const recordDrillResult = useDojoStore((state) => state.recordDrillResult);
  const touchPractice = useDojoStore((state) => state.touchPractice);

  const drill = useMemo(() => dealRunningDrill(1, 21, 7), []);
  const [index, setIndex] = useState(0);
  const [runningCount, setRunningCount] = useState(0);
  const [correctChecks, setCorrectChecks] = useState(0);
  const [checks, setChecks] = useState(0);
  const [streak, setStreak] = useState(0);
  const [tip, setTip] = useState<string | null>(null);
  const [phase, setPhase] = useState<'dealing' | 'checking' | 'done'>('dealing');

  useEffect(() => {
    touchPractice();
  }, [touchPractice]);

  const currentCard = drill.cards[index];

  function advance() {
    const nextIndex = index + 1;
    if (nextIndex >= drill.cards.length) {
      const result = scoreDrill(correctChecks, Math.max(1, checks), 10);
      recordDrillResult('running', result);
      setPhase('done');
      return;
    }
    setIndex(nextIndex);
    if (drill.checkIndexes.includes(nextIndex)) {
      setPhase('checking');
    } else {
      setPhase('dealing');
    }
  }

  function submitCheck() {
    const expected = currentCard?.runningCount ?? 0;
    const isCorrect = runningCount === expected;
    setChecks((c) => c + 1);
    if (isCorrect) {
      setCorrectChecks((c) => c + 1);
      setStreak((s) => s + 1);
    } else {
      setStreak(0);
      setTip(`The count was ${expected > 0 ? `+${expected}` : expected}.`);
    }
    advance();
  }

  if (phase === 'done') {
    return (
      <AppScreen header={<ProgressionHeader />}>
        <View style={styles.done}>
          <Text style={styles.doneTitle}>Running Count Drill Complete</Text>
          <Text style={styles.doneBody}>
            {correctChecks} / {checks} checks correct
          </Text>
          <DojoButton label="Back to Drills" onPress={() => router.replace('/drill')} />
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen header={<ProgressionHeader />} scroll={false}>
      <View style={styles.root}>
        <Text style={styles.title}>Running Count</Text>
        <Text style={styles.subtitle}>
          {phase === 'checking'
            ? 'What is the running count right now?'
            : 'Update the count as each card appears.'}
        </Text>

        <View style={styles.statsRow}>
          <StreakFlame streak={streak} />
          <Text style={styles.counter}>
            Card {Math.min(index + 1, drill.cards.length)} / {drill.cards.length}
          </Text>
        </View>

        <View style={styles.cardArea}>
          {currentCard ? (
            <PlayingCard
              card={currentCard.card}
              skin="regular"
              width={layout.maxContentWidth * 0.42}
              underglow={false}
              speed={1}
            />
          ) : null}
        </View>

        {phase === 'checking' ? (
          <CountingKeyboard
            value={runningCount}
            onChange={setRunningCount}
            onSubmit={submitCheck}
            submitLabel="Check Count"
          />
        ) : (
          <DojoButton label="Next Card" onPress={advance} />
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
