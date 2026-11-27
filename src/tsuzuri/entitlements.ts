import { useEffect, useSyncExternalStore } from "react";
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { requiresPurchase, sameAppearance } from "./catalog";
import type { BookDraft, Library } from "./model";
import type { TsuzuriMessage } from "./messages";

type Entitlement = "verified" | "unowned" | "revoked" | "unknown" | "unavailable";
type TransactionResult = Entitlement | "cancelled" | "pending" | "failed";
type TsuzuriStore = {
  entitlement(): Promise<{ state: Entitlement }>;
  product(): Promise<{ state: "ready" | "unavailable" | "failed"; price?: string }>;
  purchase(): Promise<{ state: TransactionResult }>;
  restore(): Promise<{ state: TransactionResult }>;
  addListener(event: "entitlementChanged", callback: (data: { state: Entitlement }) => void): Promise<PluginListenerHandle>;
};

const nativeStore = registerPlugin<TsuzuriStore>("ZanshinTsuzuri");
const supported = Capacitor.getPlatform() === "ios";
const initial = {
  state: supported ? "unknown" as Entitlement : "unavailable" as Entitlement,
  action: "idle" as "idle" | "purchasing" | "restoring" | "pending",
  price: null as string | null,
  priceState: "idle" as "idle" | "loading" | "ready" | "unavailable" | "failed",
};
let state = initial;
let entitlementVersion = 0;
const subscribers = new Set<() => void>();
let listening: Promise<PluginListenerHandle> | null = null;
let checking: Promise<void> | null = null;

function publish(change: Partial<typeof initial>) {
  state = { ...state, ...change };
  subscribers.forEach((listener) => listener());
}

function getSnapshot() { return state; }

function subscribe(listener: () => void) {
  subscribers.add(listener);
  return () => { subscribers.delete(listener); };
}

function updateEntitlement(value: Entitlement, explicitlySynced = false) {
  // A transient verification failure leaves the last StoreKit-verified result intact.
  if (!explicitlySynced && (value === "unknown" || value === "unowned") &&
    (state.state === "verified" || state.state === "revoked")) return;
  publish({
    state: value,
    ...(state.action === "pending" && (value === "verified" || value === "revoked") ? { action: "idle" } : {}),
  });
}

export function refreshEntitlement() {
  if (!supported) return Promise.resolve();
  if (checking) return checking;
  if (!listening) {
    listening = nativeStore.addListener("entitlementChanged", ({ state: value }) => {
      entitlementVersion++;
      updateEntitlement(value);
    });
    void listening.catch(() => { listening = null; });
  }
  const version = entitlementVersion;
  checking = nativeStore.entitlement().then(({ state: current }) => {
    if (version === entitlementVersion && state.action !== "purchasing" && state.action !== "restoring") {
      updateEntitlement(current);
    }
  }).catch(() => {}).finally(() => { checking = null; });
  return checking;
}

export function useEntitlement() {
  useEffect(() => {
    void refreshEntitlement();
    const foreground = () => { if (document.visibilityState === "visible") void refreshEntitlement(); };
    document.addEventListener("visibilitychange", foreground);
    window.addEventListener("pageshow", foreground);
    return () => {
      document.removeEventListener("visibilitychange", foreground);
      window.removeEventListener("pageshow", foreground);
    };
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot, () => initial);
}

export function hasVerifiedPurchase() {
  return state.state === "verified";
}

export async function loadProduct() {
  if (!supported || state.priceState === "loading") return;
  publish({ priceState: "loading", price: null });
  try {
    const result = await nativeStore.product();
    const price = result.state === "ready" && result.price?.trim() ? result.price : null;
    publish({ price, priceState: price ? "ready" : result.state === "unavailable" ? "unavailable" : "failed" });
  } catch {
    publish({ price: null, priceState: "failed" });
  }
}

export async function transact(action: "purchasing" | "restoring"): Promise<TsuzuriMessage | null> {
  const previousAction = state.action;
  if (!supported || previousAction === "purchasing" || previousAction === "restoring") return null;
  if (action === "purchasing" && (previousAction === "pending" || !state.price || state.state === "verified")) return null;
  const version = ++entitlementVersion;
  let keepPending = previousAction === "pending";
  publish({ action });
  try {
    const { state: result } = await (action === "purchasing" ? nativeStore.purchase() : nativeStore.restore());
    if (result === "verified" || result === "revoked" || (action === "restoring" && result === "unowned")) {
      if (version === entitlementVersion) {
        entitlementVersion++;
        updateEntitlement(result, true);
      }
      keepPending = false;
      if (state.state === "verified") return "purchaseVerified";
      if (state.state === "revoked") return "purchaseRevoked";
      return "purchaseNotFound";
    }
    if (result === "cancelled") return "purchaseCancelled";
    if (result === "pending") {
      if (state.state === "verified") return "purchaseVerified";
      if (version !== entitlementVersion && state.state === "revoked") return "purchaseRevoked";
      keepPending = true;
      return "purchasePending";
    }
    return result === "unavailable" ? "purchaseUnavailable" : "purchaseFailed";
  } catch {
    return "purchaseFailed";
  } finally {
    const resolved = version !== entitlementVersion && (state.state === "verified" || state.state === "revoked");
    publish({ action: keepPending && !resolved ? "pending" : "idle" });
  }
}

export function bindingBlock(library: Library, value: BookDraft, owned: boolean) {
  if (owned) return null;
  const existing = library.books.find((item) => item.id === value.bookId);
  const previous = library.editions.find((edition) => edition.id === existing?.editionId);
  if (!existing && library.books.length > 0) return "freeLimit" as const;
  if (requiresPurchase(value.appearance) && (!previous || !sameAppearance(previous.appearance, value.appearance))) {
    return "paidPreview" as const;
  }
  return null;
}
