import { useEffect, useRef } from "react";
import { loadProduct, transact, useEntitlement } from "./entitlements";
import type { TsuzuriCopy, TsuzuriMessage } from "./messages";

export function PurchasePanel({ c, onClose, onResult }: {
  c: TsuzuriCopy; onClose: () => void; onResult: (value: TsuzuriMessage) => void;
}) {
  const state = useEntitlement();
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    panel.current?.focus();
    void loadProduct();
  }, []);
  const unavailable = state.state === "unavailable" || state.priceState === "unavailable";
  const processing = state.action === "purchasing" || state.action === "restoring";
  async function run(action: "purchasing" | "restoring") {
    const result = await transact(action);
    if (result) onResult(result);
    if (result === "purchaseVerified" || result === "purchaseCancelled") onClose();
  }
  return (
    <section className="ts-purchase" role="region" tabIndex={-1} ref={panel} aria-label={c.purchaseInfo}>
      <h2>{c.product}</h2>
      <p>{c.purchaseScope}</p>
      {unavailable ? <p>{c.purchaseUnavailable}</p> : <>
        {state.state === "revoked" && <p role="status">{c.purchaseRevoked}</p>}
        {state.state === "verified" && <p role="status">{c.purchaseVerified}</p>}
        {state.priceState === "loading" && <p role="status">{c.priceLoading}</p>}
        {state.priceState === "failed" && <><p>{c.priceUnavailable}</p><button type="button" onClick={() => void loadProduct()}>{c.retry}</button></>}
        {state.action === "pending" && <p role="status">{c.purchasePending}</p>}
        {processing && <p role="status">{c.purchaseChecking}</p>}
        {state.price && state.state !== "verified" && <button type="button" className="ts-primary"
          disabled={state.action !== "idle"} onClick={() => void run("purchasing")}>{c.purchase} · {state.price}</button>}
        <p>{c.restorePurchaseHint}</p>
        <button type="button" disabled={processing} onClick={() => void run("restoring")}>{c.restorePurchase}</button>
      </>}
      <button type="button" onClick={onClose}>{c.close}</button>
    </section>
  );
}
