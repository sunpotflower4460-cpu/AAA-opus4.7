// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { bindDraft, blankDraft, editionDraft, emptyLibrary } from "../model";
import type { Note } from "../../types/note";

const calls = vi.hoisted(() => ({
  product: vi.fn(), entitlement: vi.fn(), purchase: vi.fn(), restore: vi.fn(), addListener: vi.fn(),
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { getPlatform: () => "ios" },
  registerPlugin: () => calls,
}));

describe("Tsuzuri purchase boundary", () => {
  it("keeps transaction approval, cancellation, network failures and verified revocation distinct", async () => {
    const { refreshEntitlement, hasVerifiedPurchase, loadProduct, transact } = await import("../entitlements");
    let inform = (_value: { state: string }) => {};
    calls.addListener.mockImplementation(async (_event, listener) => { inform = listener; return { remove: async () => {} }; });
    calls.entitlement.mockResolvedValue({ state: "unowned" });
    calls.product.mockResolvedValue({ state: "ready", price: "¥1,800" });
    await refreshEntitlement();
    await loadProduct();
    calls.purchase.mockResolvedValueOnce({ state: "cancelled" });
    expect(await transact("purchasing")).toBe("purchaseCancelled");
    expect(hasVerifiedPurchase()).toBe(false);
    calls.purchase.mockResolvedValueOnce({ state: "pending" });
    expect(await transact("purchasing")).toBe("purchasePending");
    expect(await transact("purchasing")).toBeNull();
    expect(calls.purchase).toHaveBeenCalledTimes(2);
    inform({ state: "verified" });
    expect(hasVerifiedPurchase()).toBe(true);
    calls.entitlement.mockRejectedValueOnce(new Error("offline"));
    await refreshEntitlement();
    expect(hasVerifiedPurchase()).toBe(true);
    calls.restore.mockResolvedValueOnce({ state: "failed" });
    expect(await transact("restoring")).toBe("purchaseFailed");
    expect(hasVerifiedPurchase()).toBe(true);
    inform({ state: "revoked" });
    expect(hasVerifiedPurchase()).toBe(false);
    calls.restore.mockResolvedValueOnce({ state: "verified" });
    expect(await transact("restoring")).toBe("purchaseVerified");
  });

  it("separates content edits, material changes and new books after revocation", async () => {
    const { bindingBlock } = await import("../entitlements");
    const library = emptyLibrary();
    const note: Note = {
      id: "note", title: "", body: "  A line.\n", isFavorite: false,
      createdAt: "2026-11-27T01:00:00Z", updatedAt: "2026-11-27T01:00:00Z",
    };
    const basic = blankDraft("horizontal", note);
    expect(bindingBlock(library, basic, false)).toBeNull();
    const styled = { ...basic, appearance: { ...basic.appearance, paper: "PA08", brush: "BR01" } };
    expect(bindingBlock(library, styled, false)).toBe("paidPreview");
    expect(bindingBlock(library, styled, true)).toBeNull();
    const existing = bindDraft(library, styled);
    expect(bindingBlock(existing.library, basic, false)).toBe("freeLimit");
    const edit = editionDraft(existing.library, existing.book);
    edit.passages[0].body += "Book edit only";
    expect(bindingBlock(existing.library, edit, false)).toBeNull();
    expect(bindingBlock(existing.library, { ...edit, appearance: { ...edit.appearance, brush: "BR04" } }, false)).toBe("paidPreview");
  });
});
