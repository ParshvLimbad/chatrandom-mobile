import type {
  CustomerInfo,
  PurchasesPackage,
} from "react-native-purchases";

import { env } from "@/lib/env";
import { nativeModulesSupported } from "@/lib/runtime";

let configuredUserId: string | null = null;

async function loadPurchasesModule(): Promise<typeof import("react-native-purchases") | null> {
  if (!nativeModulesSupported || !env.revenueCatAndroidApiKey) {
    return null;
  }

  return import("react-native-purchases");
}

export async function configurePurchases(userId: string): Promise<void> {
  if (configuredUserId === userId) {
    return;
  }

  const purchasesModule = await loadPurchasesModule();
  if (!purchasesModule) {
    return;
  }

  await purchasesModule.default.configure({
    apiKey: env.revenueCatAndroidApiKey,
    appUserID: userId,
  });
  configuredUserId = userId;
}

export async function getPrimaryPaywallPackage(): Promise<PurchasesPackage | null> {
  const purchasesModule = await loadPurchasesModule();
  if (!purchasesModule) {
    return null;
  }

  const offerings = await purchasesModule.default.getOfferings();
  return offerings.current?.availablePackages[0] ?? null;
}

export async function purchasePrimaryPackage(): Promise<CustomerInfo | null> {
  const packageToPurchase = await getPrimaryPaywallPackage();
  if (!packageToPurchase) {
    return null;
  }

  const purchasesModule = await loadPurchasesModule();
  if (!purchasesModule) {
    return null;
  }

  const result = await purchasesModule.default.purchasePackage(packageToPurchase);
  return result.customerInfo;
}

export async function restorePurchases(): Promise<CustomerInfo> {
  const purchasesModule = await loadPurchasesModule();
  if (!purchasesModule) {
    throw new Error("RevenueCat is only available in a development build.");
  }

  return purchasesModule.default.restorePurchases();
}
