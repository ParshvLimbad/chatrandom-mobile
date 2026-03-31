import type { ComponentType } from "react";
import { StyleSheet, Text, View } from "react-native";

import { env } from "@/lib/env";
import { nativeModulesSupported } from "@/lib/runtime";

interface BannerAdPropsLike {
  size: string;
  unitId: string;
}

interface GoogleMobileAdsModuleLike {
  BannerAd: ComponentType<BannerAdPropsLike>;
  BannerAdSize: {
    ANCHORED_ADAPTIVE_BANNER: string;
  };
  TestIds: {
    BANNER: string;
  };
}

export function AdBanner(): JSX.Element {
  if (!nativeModulesSupported) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Ads appear in the dev build.</Text>
      </View>
    );
  }

  const googleMobileAds =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("react-native-google-mobile-ads") as GoogleMobileAdsModuleLike;
  const { BannerAd, BannerAdSize, TestIds } = googleMobileAds;

  return (
    <BannerAd
      size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
      unitId={env.admobBannerUnitId || TestIds.BANNER}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 12,
  },
  placeholderText: {
    color: "#8fa0b6",
    fontSize: 12,
    fontWeight: "600",
  },
});
