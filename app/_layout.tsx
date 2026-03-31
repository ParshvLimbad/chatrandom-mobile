import "react-native-url-polyfill/auto";
import "react-native-reanimated";

import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { nativeModulesSupported } from "@/lib/runtime";
import { AppBootstrap } from "@/providers/AppBootstrap";

const NAV_THEME = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: "#07111f",
    border: "#172033",
    card: "#0d1628",
    primary: "#5be6c5",
    text: "#f4f7fb",
  },
};

export default function RootLayout(): JSX.Element {
  useEffect(() => {
    if (!nativeModulesSupported) {
      return;
    }

    void (async () => {
      const googleMobileAdsModule = await import("react-native-google-mobile-ads");
      const mobileAds =
        googleMobileAdsModule.default ?? googleMobileAdsModule.MobileAds;

      if (typeof mobileAds === "function") {
        await mobileAds().initialize();
      }
    })();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={NAV_THEME}>
        <AppBootstrap>
          <Stack
            screenOptions={{
              animation: "fade",
              contentStyle: { backgroundColor: "#07111f" },
              headerShown: false,
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="auth" />
            <Stack.Screen name="auth-callback" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(tabs)" />
          </Stack>
          <StatusBar style="light" />
        </AppBootstrap>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
