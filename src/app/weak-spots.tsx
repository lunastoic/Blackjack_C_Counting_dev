import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '../components/common/AppScreen';
import { EmptyState } from '../components/common/EmptyState';
import { PressableScale } from '../components/common/PressableScale';
import { PrimaryButton } from '../components/common/PrimaryButton';
import { ScreenTitleRow } from '../components/common/ScreenTitleRow';
import { SecondaryButton } from '../components/common/SecondaryButton';
import { PlayingCard } from '../components/game/PlayingCard';
import { PlayerAction } from '../engine/blackjack/rules';
import { makeCard } from '../engine/cards/card';
import { ACTION_LABELS, dealerUpLabel, handLabel } from '../engine/strategy/describe';
import { playSound } from '../services/audio';
import { haptics } from '../services/haptics';
import { useWeakSpotsStore, WeakSpot } from '../stores/weakSpotsStore';
import { colors, fontSizes, fontWeights, radii, spacing } from '../theme';

const CARD_WIDTH = 64;

/** Beat the verdict stays up before the next spot deals. */
const VERDICT_MS = 1400;

/**
 * Weak Spots — every hand played off-book at the table, dealt again as a
 * drill: the hand, the dealer's up-card, the same choices. The book play
 * clears the spot; a miss keeps it in the pile for next time.
 */
export default function WeakSpotsScreen() {
  const router = useRouter();
  const spots = useWeakSpotsStore((state) => state.spots);
  const clear = useWeakSpotsStore((state) => state.clear);
  /** Which spot in the pile is up; a miss moves on, a clear shortens the pile. */
  const [cursor, setCursor] = useState(0);
  /** The spot on the felt while its verdict shows (a cleared one is already gone from the pile). */
  const [held, setHeld] = useState<WeakSpot | null>(null);
  const [verdict, setVerdict] = useState<{ chosen: PlayerAction; right: boolean } | null>(null);
  const [cleared, setCleared] = useState(0);

  const shown: WeakSpot | null = held ?? (spots.length > 0 ? spots[cursor % spots.length] : null);

  useEffect(() => {
    if (!verdict) {
      return;
    }
    const timer = setTimeout(() => {
      setCursor((index) => (verdict.right ? index : index + 1));
      setVerdict(null);
      setHeld(null);
    }, VERDICT_MS);
    return () => clearTimeout(timer);
  }, [verdict]);

  function answer(action: PlayerAction) {
    if (!shown || verdict) {
      return;
    }
    const right = action === shown.book;
    setHeld(shown);
    setVerdict({ chosen: action, right });
    if (right) {
      playSound('answerRight');
      void haptics.success();
      clear(shown.key);
      setCleared((n) => n + 1);
    } else {
      playSound('answerWrong');
      void haptics.error();
    }
  }

  if (!shown) {
    return (
      <AppScreen scroll={false}>
        <ScreenTitleRow title="Weak spots" />
        <EmptyState
          title={cleared > 0 ? 'All cleared' : 'No weak spots'}
          message={
            cleared > 0
              ? `${cleared} spot${cleared === 1 ? '' : 's'} played by the book. The table will log any new slips here.`
              : 'Play a hand off-book at any table and it lands here to drill until the book play sticks.'
          }
          action={<PrimaryButton label="Back" onPress={() => router.back()} />}
        />
      </AppScreen>
    );
  }

  const dealerCard = makeCard(shown.dealerUpRank, 'spades', { visibility: 'faceUp' });
  const playerCards = shown.cards.map((card, index) =>
    makeCard(card.rank, card.suit, { deckIndex: index, visibility: 'faceUp' }),
  );
  const actions: PlayerAction[] = [
    'hit',
    'stand',
    ...(shown.canDouble ? (['double'] as const) : []),
    ...(shown.canSplit ? (['split'] as const) : []),
  ];

  return (
    <AppScreen scroll={false}>
      <ScreenTitleRow title="Weak spots" />
      <View style={styles.meta}>
        <Text style={styles.metaText}>
          {spots.length} left · played off-book {shown.times}×
        </Text>
      </View>

      <View style={styles.felt}>
        <Text style={styles.areaLabel}>DEALER SHOWS {dealerUpLabel(shown.dealerUpRank)}</Text>
        <View style={styles.cards}>
          <PlayingCard card={dealerCard} skin="regular" width={CARD_WIDTH} underglow={false} />
        </View>
        <Text style={styles.areaLabel}>YOUR HAND · {handLabel(shown.cards).toUpperCase()}</Text>
        <View style={styles.cards}>
          {playerCards.map((card, index) => (
            <PlayingCard
              key={card.id}
              card={card}
              skin="regular"
              width={CARD_WIDTH}
              underglow={false}
              enterDelay={index * 80}
            />
          ))}
        </View>
      </View>

      <View style={styles.verdictSlot}>
        {verdict ? (
          <View style={[styles.verdict, verdict.right ? styles.verdictRight : styles.verdictWrong]}>
            <Ionicons
              name={verdict.right ? 'checkmark-circle' : 'close-circle'}
              size={18}
              color={verdict.right ? colors.success : colors.error}
            />
            <Text style={styles.verdictText}>
              {verdict.right
                ? `${ACTION_LABELS[shown.book]} — by the book. Spot cleared.`
                : `Book play: ${ACTION_LABELS[shown.book]}. Stays in the pile.`}
            </Text>
          </View>
        ) : (
          <Text style={styles.prompt}>What does the book say?</Text>
        )}
      </View>

      <View style={styles.actions}>
        {actions.map((action) => (
          <PressableScale
            key={action}
            style={[styles.actionButton, verdict && styles.actionButtonDim]}
            onPress={() => answer(action)}
            disabled={verdict !== null}
            accessibilityRole="button"
            accessibilityLabel={ACTION_LABELS[action]}
          >
            <Text style={styles.actionText}>{ACTION_LABELS[action]}</Text>
          </PressableScale>
        ))}
      </View>

      <View style={styles.footer}>
        <SecondaryButton label="Done" onPress={() => router.back()} />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  meta: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  metaText: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  felt: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  areaLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.bold,
    letterSpacing: 1,
  },
  cards: {
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: CARD_WIDTH * 1.4,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  verdictSlot: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  prompt: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    fontStyle: 'italic',
  },
  verdict: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  verdictRight: {
    borderColor: colors.success,
    backgroundColor: colors.backgroundElevated,
  },
  verdictWrong: {
    borderColor: colors.error,
    backgroundColor: colors.backgroundElevated,
  },
  verdictText: {
    color: colors.textPrimary,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.semibold,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    maxWidth: 140,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.burgundy,
    borderWidth: 1,
    borderColor: colors.borderGold,
  },
  actionButtonDim: {
    opacity: 0.5,
  },
  actionText: {
    color: colors.goldBright,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.5,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: spacing.lg,
  },
});
