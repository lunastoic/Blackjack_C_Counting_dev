import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, spacing } from '../../theme';

interface AppScreenProps {
  readonly children: React.ReactNode;
  /** Wrap content in a vertical ScrollView (default true). */
  readonly scroll?: boolean;
  /** Extra element pinned above the scroll area (e.g. ProgressionHeader). */
  readonly header?: React.ReactNode;
}

/**
 * Base screen container: near-black casino background, safe-area padding,
 * and a centered max-width column so content behaves on all phone sizes.
 */
export function AppScreen({ children, scroll = true, header }: AppScreenProps) {
  const insets = useSafeAreaInsets();

  const content = <View style={styles.column}>{children}</View>;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {header}
      {scroll ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      ) : (
        <View style={[styles.fill, { paddingBottom: insets.bottom }]}>{content}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: layout.screenPaddingH,
    alignItems: 'center',
  },
  fill: {
    flex: 1,
    paddingHorizontal: layout.screenPaddingH,
    alignItems: 'center',
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
});
