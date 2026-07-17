import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '../components/common/AppScreen';
import { ScreenTitleRow } from '../components/common/ScreenTitleRow';
import { SectionCard } from '../components/common/SectionCard';
import { ProgressionHeader } from '../components/progression/ProgressionHeader';
import { colors, fontSizes, fontWeights, spacing } from '../theme';

export default function HowToPlayScreen() {
  return (
    <AppScreen header={<ProgressionHeader />}>
      <ScreenTitleRow title="How to Play" />
      <View style={styles.stack}>
        <SectionCard title="What this app is">
          <Text style={styles.body}>
            Blackjack Card Counter is a training game. On the surface it plays like a casino
            blackjack progression game. Underneath, it teaches Hi-Lo card counting — the most
            widely used counting system — through real play.
          </Text>
        </SectionCard>

        <SectionCard title="Hi-Lo card values">
          <ValueRow value="+1" color={colors.trainingPlus} cards="2, 3, 4, 5, 6" />
          <ValueRow value="0" color={colors.trainingNeutral} cards="7, 8, 9" />
          <ValueRow value="−1" color={colors.trainingMinus} cards="10, J, Q, K, A" />
          <Text style={styles.body}>
            Add these values for every card you can see. The total is called the running count. A
            high positive count means the shoe is rich in tens and aces, which favors the player.
          </Text>
        </SectionCard>

        <SectionCard title="Count only what you can see">
          <Text style={styles.body}>
            Every face-up card at the table affects the count — yours and the dealer&apos;s. The
            dealer&apos;s second card is dealt face down, so it is NOT counted until it is revealed
            at the end of the hand. Counting cards you cannot see is the most common beginner
            mistake, and this trainer is built to break that habit.
          </Text>
        </SectionCard>

        <SectionCard title="Training Mode">
          <Text style={styles.body}>
            Every card shows its Hi-Lo value with a color glow, the running count is displayed, and
            basic-strategy hints show the mathematically best move. Use it to build the habit
            before hiding the aids.
          </Text>
        </SectionCard>

        <SectionCard title="Regular Mode">
          <Text style={styles.body}>
            A clean casino game with no visible aids. Keep the count in your head, size your bets
            with the count, and grow your bankroll to unlock new casinos.
          </Text>
        </SectionCard>

        <SectionCard title="Quiz Mode">
          <Text style={styles.body}>
            Cards flash one at a time and the app quizzes you on the running count. It arrives in a
            later update.
          </Text>
        </SectionCard>

        <SectionCard title="Blackjack basics">
          <Text style={styles.body}>
            Get closer to 21 than the dealer without going over. Number cards are face value, face
            cards are 10, and aces are 1 or 11. A two-card 21 is a blackjack and pays 3:2. The
            dealer must hit to 16 and stands on all 17s. You can hit, stand, double your bet for
            one card, or split a pair into two hands.
          </Text>
        </SectionCard>

        <SectionCard title="A note on card counting">
          <Text style={styles.body}>
            Card counting is a legal mental skill in most places — it is simply keeping track of
            what has been dealt. Casinos are private businesses and may refuse service to counters.
            This app is for education and entertainment: it does not guarantee winnings, and real
            casino conditions differ from practice.
          </Text>
        </SectionCard>
      </View>
    </AppScreen>
  );
}

function ValueRow({ value, color, cards }: { value: string; color: string; cards: string }) {
  return (
    <View style={styles.valueRow}>
      <View style={[styles.valueBadge, { borderColor: color }]}>
        <Text style={[styles.valueText, { color }]}>{value}</Text>
      </View>
      <Text style={styles.valueCards}>{cards}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  body: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    lineHeight: 21,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  valueBadge: {
    width: 48,
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderWidth: 1.5,
    borderRadius: 8,
    backgroundColor: colors.backgroundElevated,
  },
  valueText: {
    fontSize: fontSizes.body,
    fontWeight: fontWeights.bold,
  },
  valueCards: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.medium,
  },
});
