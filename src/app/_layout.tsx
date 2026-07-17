import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LoadingGate } from '../components/common/LoadingGate';
import { initializeApp } from '../persistence/hydrate';
import { preloadSounds } from '../services/audio';
import { useHydrationStore } from '../stores/hydrationStore';
import { colors } from '../theme';

// Keep the native splash visible until the save has hydrated.
void SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash already hidden (e.g. fast refresh) — safe to ignore.
});

export default function RootLayout() {
  const hasHydrated = useHydrationStore((state) => state.hasHydrated);

  useEffect(() => {
    async function bootstrap() {
      await initializeApp();
      preloadSounds();
    }
    void bootstrap();
  }, []);

  useEffect(() => {
    if (hasHydrated) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [hasHydrated]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <LoadingGate>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
              animation: 'slide_from_right',
            }}
          />
        </LoadingGate>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
