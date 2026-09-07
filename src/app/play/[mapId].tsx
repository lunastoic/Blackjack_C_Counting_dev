import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { TABLE_FELTS } from '../../assets/registry';
import { AppScreen } from '../../components/common/AppScreen';
import { ProgressionHeader } from '../../components/progression/ProgressionHeader';
import { DojoButton } from '../../components/dojo/DojoButton';
import { ObjectivePanel } from '../../components/dojo/ObjectivePanel';
import { objectivesForMap } from '../../engine/dojo';
import { mapById } from '../../engine/betting/casino';
import { useGameSessionStore } from '../../stores/gameSessionStore';
import { colors, fontSizes, fontWeights, radii, spacing } from '../../theme';

export default function PlayPreviewScreen() {
  const router = useRouter();
  const { mapId } = useLocalSearchParams<{ mapId: string }>();
  const parsed = Number(mapId);
  const map = Number.isInteger(parsed) ? mapById(parsed) : undefined;
  const startGuidedSession = useGameSessionStore((state) => state.startGuidedSession);
  const endSession = useGameSessionStore((state) => state.endSession);

  useEffect(() => {
    return () => {
      endSession();
    };
  }, [endSession]);

  if (!map) {
    return (
      <AppScreen header={<ProgressionHeader />}>
        <Text style={styles.error}>Table not found.</Text>
      </AppScreen>
    );
  }
  const currentMap = map;

  // The table is the root screen: unwind to it (switching its map) instead of
  // stacking tables, which keeps every felt below in memory.
  function start() {
    startGuidedSession(currentMap.id);
    router.dismissTo({ pathname: '/game/[mapId]', params: { mapId: String(currentMap.id) } });
  }

  function chooseAnotherTable() {
    if (router.canDismiss()) {
      router.dismissAll();
    } else {
      router.replace('/');
    }
  }

  const objectives = objectivesForMap(currentMap);

  return (
    <AppScreen header={<ProgressionHeader />}>
      <View style={styles.root}>
        <Image
          source={TABLE_FELTS[currentMap.feltKey] ?? TABLE_FELTS['gray-suede']}
          style={styles.felt}
          resizeMode="cover"
        />
        <View style={styles.feltTint} />

        <Text style={styles.title}>{currentMap.name}</Text>
        <Text style={styles.subtitle}>
          Guided practice with the count coach on full. Focus on the objectives below while you
          play.
        </Text>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Tonight&apos;s Objectives</Text>
          <ObjectivePanel objectives={objectives} completed={new Set()} progress={{}} />
        </View>

        <View style={styles.footer}>
          <DojoButton label="Sit Down & Play" onPress={start} />
          <DojoButton label="Choose Another Table" variant="secondary" onPress={chooseAnotherTable} />
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingVertical: spacing.xl,
    gap: spacing.lg,
  },
  felt: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    borderRadius: radii.lg,
  },
  feltTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
    borderRadius: radii.lg,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.title,
    fontWeight: fontWeights.heavy,
    textAlign: 'center',
    zIndex: 1,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    textAlign: 'center',
    lineHeight: 22,
    zIndex: 1,
  },
  panel: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderGold,
    padding: spacing.lg,
    gap: spacing.md,
    zIndex: 1,
  },
  panelTitle: {
    color: colors.gold,
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.bold,
    textAlign: 'center',
  },
  footer: {
    gap: spacing.md,
    zIndex: 1,
    marginTop: 'auto',
  },
  error: {
    color: colors.error,
    fontSize: fontSizes.body,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
