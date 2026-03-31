import { useCallback, useEffect, useRef } from "react";

import { env } from "@/lib/env";
import { nativeModulesSupported } from "@/lib/runtime";

interface InterstitialAdLike {
  addAdEventListener: (
    type: string,
    listener: () => void,
  ) => () => void;
  load: () => void;
  show: () => void;
}

interface GoogleMobileAdsModuleLike {
  AdEventType: {
    CLOSED: string;
    ERROR: string;
    LOADED: string;
  };
  InterstitialAd: {
    createForAdRequest: (unitId: string) => InterstitialAdLike;
  };
  TestIds: {
    INTERSTITIAL: string;
  };
}

export function useInterstitialAd(enabled: boolean): () => void {
  const adRef = useRef<InterstitialAdLike | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !nativeModulesSupported) {
      return;
    }

    const googleMobileAds =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("react-native-google-mobile-ads") as GoogleMobileAdsModuleLike;
    const { AdEventType, InterstitialAd, TestIds } = googleMobileAds;

    const ad = InterstitialAd.createForAdRequest(
      env.admobInterstitialUnitId || TestIds.INTERSTITIAL,
    );
    adRef.current = ad;

    const unsubscribeLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
      loadedRef.current = true;
    });
    const unsubscribeClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      loadedRef.current = false;
      ad.load();
    });
    const unsubscribeError = ad.addAdEventListener(AdEventType.ERROR, () => {
      loadedRef.current = false;
    });

    ad.load();

    return () => {
      unsubscribeLoaded();
      unsubscribeClosed();
      unsubscribeError();
      adRef.current = null;
    };
  }, [enabled]);

  return useCallback(() => {
    if (enabled && loadedRef.current) {
      adRef.current?.show();
    }
  }, [enabled]);
}
