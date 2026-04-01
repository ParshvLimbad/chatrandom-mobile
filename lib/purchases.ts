import type {
  CustomerInfo,
  PurchasesPackage,
} from "react-native-purchases";

import type { SubscriptionState } from "@/lib/domain";
import { env } from "@/lib/env";
import { nativeModulesSupported } from "@/lib/runtime";

let configuredUserId: string | null = null;
const PRIMARY_ENTITLEMENT_IDENTIFIER = "premium_filters";
const PRIMARY_PRODUCT_IDENTIFIER = "speaky_plus:monthly";

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

function pickPrimaryPackage(packages: PurchasesPackage[]): PurchasesPackage | null {
  if (packages.length === 0) {
    return null;
  }

  return (
    packages.find((item) => item.product.identifier === PRIMARY_PRODUCT_IDENTIFIER) ??
    packages[0] ??
    null
  );
}

function toSubscriptionState(
  userId: string,
  customerInfo: CustomerInfo,
): SubscriptionState {
  const activeEntitlements = Object.values(customerInfo.entitlements.active);
  const matchingEntitlement =
    activeEntitlements.find(
      (item) =>
        item.identifier === PRIMARY_ENTITLEMENT_IDENTIFIER ||
        item.productIdentifier === PRIMARY_PRODUCT_IDENTIFIER,
    ) ?? activeEntitlements[0] ?? null;

  const activeProductIdentifier =
    customerInfo.activeSubscriptions.find(
      (identifier) => identifier === PRIMARY_PRODUCT_IDENTIFIER,
    ) ??
    matchingEntitlement?.productIdentifier ??
    customerInfo.activeSubscriptions[0] ??
    customerInfo.allPurchasedProductIdentifiers.find(
      (identifier) => identifier === PRIMARY_PRODUCT_IDENTIFIER,
    ) ??
    customerInfo.allPurchasedProductIdentifiers[0] ??
    null;

  return {
    entitlement_id: matchingEntitlement?.identifier ?? null,
    expires_at:
      matchingEntitlement?.expirationDate ?? customerInfo.latestExpirationDate ?? null,
    is_active:
      matchingEntitlement?.isActive ?? customerInfo.activeSubscriptions.length > 0,
    product_id: activeProductIdentifier,
    updated_at: new Date().toISOString(),
    user_id: userId,
  };
}

export async function getPrimaryPaywallPackage(): Promise<PurchasesPackage | null> {
  const purchasesModule = await loadPurchasesModule();
  if (!purchasesModule) {
    return null;
  }

  const offerings = await purchasesModule.default.getOfferings();
  const currentPackages = offerings.current?.availablePackages ?? [];
  const primaryCurrentPackage = pickPrimaryPackage(currentPackages);
  if (primaryCurrentPackage) {
    return primaryCurrentPackage;
  }

  const fallbackPackages = Object.values(offerings.all).flatMap(
    (offering) => offering.availablePackages,
  );
  return pickPrimaryPackage(fallbackPackages);
}

export async function purchasePrimaryPackage(): Promise<CustomerInfo | null> {
  const packageToPurchase = await getPrimaryPaywallPackage();
  if (!packageToPurchase) {
    return null;
  }

  const purchasesModule = await loadPurchasesModule();
  if (!purchasesModule) {
    throw new Error("RevenueCat is only available in a native Android build.");
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

export async function getCustomerSubscriptionState(
  userId: string,
): Promise<SubscriptionState | null> {
  const purchasesModule = await loadPurchasesModule();
  if (!purchasesModule) {
    return null;
  }

  const customerInfo = await purchasesModule.default.getCustomerInfo();
  return toSubscriptionState(userId, customerInfo);
}
