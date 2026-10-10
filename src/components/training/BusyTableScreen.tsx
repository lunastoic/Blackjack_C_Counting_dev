import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme';

interface BusyTableScreenProps {
  readonly mapId: number;
  readonly level: number;
}

/** Placeholder until the BusyTable mini-game lands. */
export function BusyTableScreen({ mapId, level }: BusyTableScreenProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.text}>
        BusyTable — map {mapId}, level {level}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  text: { color: colors.textPrimary },
});
