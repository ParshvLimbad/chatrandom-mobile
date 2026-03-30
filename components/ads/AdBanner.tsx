import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from "react-native-google-mobile-ads";

import { env } from "@/lib/env";

export function AdBanner(): JSX.Element {
  return (
    <BannerAd
      size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
      unitId={env.admobBannerUnitId || TestIds.BANNER}
    />
  );
}
