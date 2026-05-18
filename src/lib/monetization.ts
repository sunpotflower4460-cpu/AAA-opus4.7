import type { MonetizationState, PremiumProduct } from "../types/monetization";

export const PREMIUM_KEY = "zanshin.premium.mock.v1";
export const REMOVE_ADS_PRODUCT_ID = "zanshin.premium.remove_ads";

export const PREMIUM_PRODUCTS: PremiumProduct[] = [
  {
    id: REMOVE_ADS_PRODUCT_ID,
    title: "残心 Premium",
    description: "広告を外して、静かな余白を守ります。",
    type: "non_consumable",
  },
  {
    id: "zanshin.premium.monthly",
    title: "残心 Premium Monthly",
    description: "将来の月額サポート案。",
    type: "subscription",
  },
  {
    id: "zanshin.premium.yearly",
    title: "残心 Premium Yearly",
    description: "将来の年額サポート案。",
    type: "subscription",
  },
];

export const REMOVE_ADS_PRODUCT = PREMIUM_PRODUCTS[0];

function createMonetizationState(isPremium: boolean): MonetizationState {
  return {
    isPremium,
    adsEnabled: !isPremium,
    purchaseStatus: isPremium ? "premium" : "free",
  };
}

function readPremiumFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PREMIUM_KEY) === "true";
  } catch {
    return false;
  }
}

export function loadMonetizationState(): MonetizationState {
  return createMonetizationState(readPremiumFlag());
}

export async function purchasePremiumMock(): Promise<MonetizationState> {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(PREMIUM_KEY, "true");
    } catch {
      return { ...createMonetizationState(false), purchaseStatus: "error" };
    }
  }

  return createMonetizationState(true);
}

export async function restorePurchasesMock(): Promise<MonetizationState> {
  return loadMonetizationState();
}

export async function clearPremiumMock(): Promise<MonetizationState> {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(PREMIUM_KEY);
    } catch {
      return { ...createMonetizationState(true), purchaseStatus: "error" };
    }
  }

  return createMonetizationState(false);
}

type AdVisibilityInput = {
  monetization: MonetizationState;
  currentScreen: "notes-list" | "editor";
  isEditing?: boolean;
  isSearching?: boolean;
  hasVisibleNotes?: boolean;
};

export function shouldShowAds({
  monetization,
  currentScreen,
  isEditing = false,
  isSearching = false,
  hasVisibleNotes = true,
}: AdVisibilityInput): boolean {
  return (
    !monetization.isPremium &&
    monetization.adsEnabled &&
    currentScreen === "notes-list" &&
    !isEditing &&
    !isSearching &&
    hasVisibleNotes
  );
}
