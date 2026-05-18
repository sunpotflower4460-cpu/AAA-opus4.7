export type PurchaseStatus = "unknown" | "free" | "premium" | "loading" | "error";

export type MonetizationState = {
  isPremium: boolean;
  adsEnabled: boolean;
  purchaseStatus: PurchaseStatus;
};

export type PremiumProduct = {
  id: string;
  title: string;
  description: string;
  priceLabel?: string;
  type: "non_consumable" | "subscription";
};
