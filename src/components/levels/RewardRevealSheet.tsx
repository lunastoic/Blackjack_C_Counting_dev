import { Image } from 'expo-image';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { DECK_COVER_ART, REWARD_ART } from '../../assets/registry';
import { CasinoMap } from '../../engine/betting/casino';
import { mapRewards, rewardChips, RewardSlot } from '../../engine/dojo';
import { colors, fonts, fontSizes, spacing } from '../../theme';
import { ArcadeButton, ArcadePanel, ArcadePlaque } from '../arcade';
import { formatChips } from '../../utils/format';

interface RewardRevealSheetProps {
  readonly visible: boolean;
  readonly map: CasinoMap;
  readonly slot: RewardSlot;
  /** Already claimed: the pop-up just shows what it gave. */
  readonly claimed: boolean;
  /** The gift's card back is the one in use. */
  readonly equipped: boolean;
  /** Claim it: the gift's OK, the bag's Claim. */
  readonly onClaim: () => void;
  /** The gift's Equip: claim it (if not yet) and deal its card back. */
  readonly onEquip: () => void;
  readonly onClose: () => void;
}

/**
 * A reward on the trail, opened. The gift holds the Ivory card back — Equip
 * deals it everywhere, OK just keeps it — and the money bag holds chips,
 * paid on Claim. Tapping a claimed reward shows what it gave. A steady gold
 * glow sits behind the art while the reward is still to claim.
 */
export function RewardRevealSheet({
  visible,
  map,
  slot,
  claimed,
  equipped,
  onClaim,
  onEquip,
  onClose,
}: RewardRevealSheetProps) {
  const rewards = mapRewards(map.id);
  if (!rewards) {
    return null;
  }
  const gift = slot === 1;
  const chips = rewardChips(map.id);

  return (
    // The system fade, nothing more: the pop-up appears in place — no zoom, no bounce.
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close" onPress={onClose} />
        <View style={styles.sheet}>
          <ArcadePanel slab style={styles.panel}>
            <ArcadePlaque
              kicker={gift ? (claimed ? 'Gift · claimed' : 'Gift') : claimed ? 'Money bag · claimed' : 'Money bag'}
              title={map.name}
            />
            <View style={[styles.artSlot, !claimed && styles.artGlow]}>
              {gift ? (
                <Image
                  source={DECK_COVER_ART[rewards.gift.cover][map.id]}
                  style={styles.cover}
                  contentFit="cover"
                  transition={160}
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <Image source={REWARD_ART.bag[map.id]} style={styles.art} contentFit="contain" transition={160} />
              )}
            </View>
            {gift ? (
              <>
                <Text style={styles.title}>{rewards.gift.name}</Text>
                <Text style={styles.body}>{rewards.gift.blurb}</Text>
                <ArcadeButton
                  label={equipped ? 'Equipped' : 'Equip'}
                  trailing={equipped ? '✓' : undefined}
                  size="large"
                  variant={equipped ? 'neutral' : 'gold'}
                  disabled={equipped}
                  onPress={onEquip}
                  style={styles.cta}
                />
                <ArcadeButton
                  label="OK"
                  size="medium"
                  variant="neutral"
                  onPress={claimed ? onClose : onClaim}
                  style={styles.cta}
                />
              </>
            ) : (
              <>
                <Text style={styles.chips}>+{formatChips(chips)} chips</Text>
                <Text style={styles.body}>
                  {claimed
                    ? 'Already in your stack. Spend them at the table.'
                    : 'Chips for your stack, to bet at the table.'}
                </Text>
                <ArcadeButton
                  label={claimed ? 'OK' : 'Claim'}
                  size="large"
                  variant={claimed ? 'neutral' : 'green'}
                  onPress={claimed ? onClose : onClaim}
                  style={styles.cta}
                />
              </>
            )}
          </ArcadePanel>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.arcadeNightShade,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    alignSelf: 'stretch',
    maxWidth: 380,
    width: '100%',
  },
  panel: {
    gap: spacing.xs,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  artSlot: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.arcadeGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
  },
  /** Still to claim: a gold flare behind the prize. */
  artGlow: {
    borderRadius: 999,
    backgroundColor: 'rgba(242, 196, 69, 0.16)',
    padding: spacing.md,
  },
  art: {
    width: 132,
    height: 132,
  },
  cover: {
    width: 96,
    height: 134,
    borderRadius: 8,
    transform: [{ rotate: '-6deg' }],
  },
  chips: {
    fontFamily: fonts.display,
    fontSize: 32,
    letterSpacing: 1,
    color: colors.arcadeMint,
    includeFontPadding: false,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    letterSpacing: 1,
    color: colors.arcadeGold,
    textAlign: 'center',
    includeFontPadding: false,
    textShadowColor: colors.chipShadow,
    textShadowOffset: { width: 2, height: 3 },
    textShadowRadius: 0,
  },
  body: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.caption + 1,
    lineHeight: fontSizes.caption + 7,
    color: colors.arcadeCream,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  cta: {
    alignSelf: 'stretch',
    marginTop: spacing.xs,
  },
});
