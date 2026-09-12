import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import { Jersey20_400Regular, useFonts } from '@expo-google-fonts/jersey-20';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LoadingGate } from '../components/common/LoadingGate';
import { initializeApp } from '../persistence/hydrate';
import { preloadSounds } from '../services/audio';
import { configureImageMemory, subscribeToMemoryWarnings } from '../services/memory';
import { useHydrationStore } from '../stores/hydrationStore';
import { colors } from '../theme';

// Keep the native splash visible until the save has hydrated, then cross-fade
// into the first screen instead of cutting (fade is iOS-only; Android cuts).
SplashScreen.setOptions({ fade: true, duration: 400 });
void SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash already hidden (e.g. fast refresh) — safe to ignore.
});

export default function RootLayout() {
  const hasHydrated = useHydrationStore((state) => state.hasHydrated);
  // The Modern look's faces. A load error still opens the app — text falls
  // back to the system face rather than the table never appearing.
  const [fontsLoaded, fontError] = useFonts({
    Jersey20_400Regular,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });
  const fontsReady = fontsLoaded || fontError !== null;
  const ready = hasHydrated && fontsReady;

  useEffect(() => {
    async function bootstrap() {
      configureImageMemory();
      subscribeToMemoryWarnings();
      await initializeApp();
      preloadSounds();
    }
    void bootstrap();
  }, []);

  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <LoadingGate ready={fontsReady}>
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
