import { useState } from "react";
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

  const handleUpgrade = async (): Promise<void> => {
    setIsPurchasing(true);
    try {
      const paywallPackage = await getPrimaryPaywallPackage();
      if (!paywallPackage) {
        Alert.alert(
          "Offerings unavailable",
          "RevenueCat has not returned an active offering yet.",
        );
        return;
      }

      await purchasePrimaryPackage();
      await onRefreshSubscription();
      Alert.alert(
        "Subscription updated",
        `Premium filters enabled. ${paywallPackage.product.priceString}`,
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
      <Text style={styles.title}>Premium filters</Text>
      <Text style={styles.priceLine}>
        {subscription?.is_active ? "Active subscription" : "Monthly plan"}
      </Text>
      <Text style={styles.body}>
        Unlock country, gender, and interest filters. Premium also removes banner
        and interstitial ads across all modes.
      </Text>
      <View style={styles.featureList}>
        <Text style={styles.feature}>• Exact country and region filters</Text>
        <Text style={styles.feature}>• Exact gender targeting</Text>
        <Text style={styles.feature}>• Interest matching</Text>
        <Text style={styles.feature}>• No banner or interstitial ads</Text>
      </View>

      <Pressable
        disabled={isPurchasing}
        onPress={handleUpgrade}
        style={[styles.button, styles.primaryButton]}
      >
        <Text style={styles.primaryText}>
          {isPurchasing ? "Processing..." : "Upgrade now"}
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
});
