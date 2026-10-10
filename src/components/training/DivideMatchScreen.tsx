import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme';

interface DivideMatchScreenProps {
  readonly mapId: number;
  readonly level: number;
}

/** Placeholder until the DivideMatch mini-game lands. */
export function DivideMatchScreen({ mapId, level }: DivideMatchScreenProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.text}>
        DivideMatch — map {mapId}, level {level}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  text: { color: colors.textPrimary },
});
