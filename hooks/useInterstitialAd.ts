import { useCallback, useEffect, useRef } from "react";
import {
  AdEventType,
  InterstitialAd,
  TestIds,
} from "react-native-google-mobile-ads";

import { env } from "@/lib/env";

export function useInterstitialAd(enabled: boolean): () => void {
  const adRef = useRef<InterstitialAd | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

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
