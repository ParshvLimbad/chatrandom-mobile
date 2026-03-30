import Purchases, {
  type CustomerInfo,
  type PurchasesPackage,
} from "react-native-purchases";

import { env } from "@/lib/env";

let configuredUserId: string | null = null;

export async function configurePurchases(userId: string): Promise<void> {
  if (!env.revenueCatAndroidApiKey) {
    return;
  }

  if (configuredUserId === userId) {
    return;
  }

  await Purchases.configure({
    apiKey: env.revenueCatAndroidApiKey,
    appUserID: userId,
  });
  configuredUserId = userId;
}

export async function getPrimaryPaywallPackage(): Promise<PurchasesPackage | null> {
  if (!env.revenueCatAndroidApiKey) {
    return null;
  }

  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages[0] ?? null;
}

export async function purchasePrimaryPackage(): Promise<CustomerInfo | null> {
  const packageToPurchase = await getPrimaryPaywallPackage();
  if (!packageToPurchase) {
    return null;
  }

  const result = await Purchases.purchasePackage(packageToPurchase);
  return result.customerInfo;
}

export async function restorePurchases(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}
