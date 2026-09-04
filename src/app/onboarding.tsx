import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { appAssets } from '../assets/registry';
import { DojoButton } from '../components/dojo/DojoButton';
import { useDojoStore } from '../stores/dojoStore';
import { colors, fontSizes, fontWeights, layout, radii, spacing } from '../theme';

const SLIDES = [
  {
    title: 'Counting is legal mental math',
    body: 'Card counting is simply paying attention to what has been dealt. This app teaches the Hi-Lo system — the most widely used counting method in the world.',
  },
  {
    title: 'Hi-Lo in 10 seconds',
    body: '2, 3, 4, 5, 6 = +1. 7, 8, 9 = 0. 10, J, Q, K, A = −1. Add those values as cards appear and you are counting.',
  },
  {
    title: 'Start your first lesson',
    body: 'The Counting Dojo will take you from raw beginner to confident counter through lessons, drills, and guided live-table practice.',
  },
] as const;

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const finishOnboarding = useDojoStore((state) => state.finishOnboarding);
  const [index, setIndex] = useState(0);

  function next() {
    if (index < SLIDES.length - 1) {
      setIndex(index + 1);
      return;
    }
    finishOnboarding();
    router.replace('/');
  }

  const slide = SLIDES[index];

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={styles.hero}>
        <Image source={appAssets.branding.appIcon} style={styles.icon} resizeMode="contain" />
        <Text style={styles.appName}>Counting Dojo</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </View>

      <View style={styles.footer}>
        <DojoButton label={index < SLIDES.length - 1 ? 'Next' : 'Enter the Dojo'} onPress={next} />
        {index < SLIDES.length - 1 ? (
          <DojoButton label="Skip" variant="secondary" onPress={next} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: layout.screenPaddingH,
    gap: spacing.xl,
    justifyContent: 'space-between',
  },
  hero: {
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.xl,
  },
  icon: {
    width: 120,
    height: 120,
    borderRadius: radii.lg,
  },
  appName: {
    color: colors.gold,
    fontSize: fontSizes.title,
    fontWeight: fontWeights.heavy,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.xl,
    gap: spacing.md,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.borderSubtle,
  },
  dotActive: {
    backgroundColor: colors.gold,
    width: 24,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.bold,
    textAlign: 'center',
  },
  body: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    gap: spacing.md,
  },
});
