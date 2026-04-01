import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import type { SubscriptionState } from "@/lib/domain";
import {
  getPrimaryPaywallPackage,
  purchasePrimaryPackage,
  restorePurchases,
} from "@/lib/purchases";

interface PricingCardProps {
  onRefreshSubscription: () => Promise<void>;
  subscription: SubscriptionState | null;
}

export function PricingCard({
  onRefreshSubscription,
  subscription,
}: PricingCardProps): JSX.Element {
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isLoadingOffer, setIsLoadingOffer] = useState(true);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [priceLine, setPriceLine] = useState("Monthly plan");
  const [productLabel, setProductLabel] = useState("Speaky Plus");

  useEffect(() => {
    let active = true;

    const loadOffer = async (): Promise<void> => {
      setIsLoadingOffer(true);
      try {
        const paywallPackage = await getPrimaryPaywallPackage();
        if (!active) {
          return;
        }

        if (!paywallPackage) {
          setOfferError("RevenueCat has not returned a current monthly offering yet.");
          setPriceLine("Monthly plan");
          return;
        }

        setOfferError(null);
        setProductLabel(paywallPackage.product.title || "Speaky Plus");
        setPriceLine(
          paywallPackage.product.priceString
            ? `${paywallPackage.product.priceString} / month`
            : "Monthly plan",
        );
      } catch (error) {
        if (!active) {
          return;
        }

        setOfferError(
          error instanceof Error ? error.message : "Unable to load paywall details.",
        );
      } finally {
        if (active) {
          setIsLoadingOffer(false);
        }
      }
    };

    void loadOffer();

    return () => {
      active = false;
    };
  }, []);

  const handleUpgrade = async (): Promise<void> => {
    if (subscription?.is_active) {
      Alert.alert("Already active", "Speaky Plus is already active on this account.");
      return;
    }

    setIsPurchasing(true);
    try {
      const paywallPackage = await getPrimaryPaywallPackage();
      if (!paywallPackage) {
        Alert.alert(
          "Offerings unavailable",
          offerError ?? "RevenueCat has not returned an active offering yet.",
        );
        return;
      }

      await purchasePrimaryPackage();
      await onRefreshSubscription();
      Alert.alert(
        "Subscription updated",
        `Premium filters enabled. ${paywallPackage.product.priceString} monthly plan is now available on this device.`,
      );
    } catch (error) {
      Alert.alert(
        "Upgrade failed",
        error instanceof Error ? error.message : "Unable to complete purchase.",
      );
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async (): Promise<void> => {
    try {
      await restorePurchases();
      await onRefreshSubscription();
      Alert.alert("Restored", "RevenueCat entitlements were refreshed.");
    } catch (error) {
      Alert.alert(
        "Restore failed",
        error instanceof Error ? error.message : "Unable to restore purchases.",
      );
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{productLabel}</Text>
      <Text style={styles.priceLine}>
        {subscription?.is_active ? "Active subscription" : priceLine}
      </Text>
      <Text style={styles.body}>
        Unlock country, gender, and interest filters. Premium also removes banner
        and interstitial ads across all modes.
      </Text>
      {offerError ? <Text style={styles.warning}>{offerError}</Text> : null}
      <View style={styles.featureList}>
        <Text style={styles.feature}>• Exact country and region filters</Text>
        <Text style={styles.feature}>• Exact gender targeting</Text>
        <Text style={styles.feature}>• Interest matching</Text>
        <Text style={styles.feature}>• No banner or interstitial ads</Text>
      </View>

      <Pressable
        disabled={isLoadingOffer || isPurchasing}
        onPress={handleUpgrade}
        style={[styles.button, styles.primaryButton]}
      >
        <Text style={styles.primaryText}>
          {isPurchasing
            ? "Processing..."
            : subscription?.is_active
              ? "Subscription active"
              : isLoadingOffer
                ? "Loading offer..."
                : "Upgrade now"}
        </Text>
      </Pressable>

      <Pressable onPress={handleRestore} style={styles.button}>
        <Text style={styles.secondaryText}>Restore purchases</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    color: "#b5c1cf",
    fontSize: 14,
    lineHeight: 21,
  },
  button: {
    alignItems: "center",
    borderColor: "#20304c",
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 50,
  },
  card: {
    backgroundColor: "rgba(91, 230, 197, 0.08)",
    borderColor: "rgba(91, 230, 197, 0.2)",
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  feature: {
    color: "#d6e0eb",
    fontSize: 14,
    fontWeight: "600",
  },
  featureList: {
    gap: 8,
  },
  priceLine: {
    color: "#5be6c5",
    fontSize: 20,
    fontWeight: "800",
  },
  primaryButton: {
    backgroundColor: "#5be6c5",
    borderColor: "#5be6c5",
  },
  primaryText: {
    color: "#07111f",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryText: {
    color: "#dce5ef",
    fontSize: 14,
    fontWeight: "700",
  },
  title: {
    color: "#f4f7fb",
    fontSize: 22,
    fontWeight: "800",
  },
  warning: {
    color: "#ffb7a0",
    fontSize: 13,
    lineHeight: 19,
  },
});
