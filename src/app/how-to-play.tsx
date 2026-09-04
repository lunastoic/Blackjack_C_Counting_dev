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
            Blackjack Card Counter is a training game built around the Counting Dojo — a
            tutorial-first path that teaches Hi-Lo card counting through lessons, drills, and
            guided live-table practice. Start in Learn, sharpen speed in Drills, then take your
            count to the Live Table.
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

        <SectionCard title="The table — fog of war">
          <Text style={styles.body}>
            Every table plays real blackjack with the count meter riding along
            <Text style={styles.bodyStrong}> fogged</Text>: it tracks everything but shows
            &quot;?&quot;. Tap the meter between hands (or pass the coach&apos;s post-round
            checks) to prove your count — one correct answer lights up the running count, a
            second unlocks the true count, a miss fogs a tier back, and every shuffle resets
            the fog. Chips, bets, and payouts are always real. This is where counting becomes
            second nature.
          </Text>
        </SectionCard>

        <SectionCard title="Quiz Mode — the count sprint">
          <Text style={styles.body}>
            Cards flash fast and you call the running count — four choices early on, exact entry
            once your streak hits six. Training wheels come off as you climb: the first three
            circles flash training cards with the Hi-Lo glow, the next three keep only the glow,
            and from seven up it&apos;s bare cards. Every correct answer fills one of nine golden
            circles and pays more XP as flashes speed up, add cards, sneak in face-down decoys
            (backs count for nothing!), and eventually deal in pairs. Fancier casinos deal
            faster too — Luna Luxe drills at a learner&apos;s pace, Kepler Fortune at dealer
            speed. A miss falls back to the last checkpoint
            (six or three), not to zero. Fill all nine for the 1,000-chip grand prize — bank it,
            or let it ride and play the next cycle for double the pot, up to 8,000 chips. One miss
            while riding loses the pot.
          </Text>
        </SectionCard>

        <SectionCard title="Earn your seat — table licenses">
          <Text style={styles.body}>
            The count sprint is the front door at every casino. Hit 3 in a row to earn a
            <Text style={styles.bodyStrong}> table permit</Text> — the blackjack floor opens with
            bets capped at a tenth of the table max. Run the full 9 for the
            <Text style={styles.bodyStrong}> full license</Text> — the cap lifts for good and
            the next casino on the strip opens.
            Each casino issues its own license, and the shoes grow with the house: Luna Luxe
            deals 1 deck, Io Inferno 2, Europa 4, Ganymede 6, Titan and Kepler 8 — so the true
            count gets harder to read exactly as your counting gets stronger.
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
  bodyStrong: {
    color: colors.textPrimary,
    fontWeight: fontWeights.bold,
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
