from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}")
    file.write_text(text.replace(old, new, 1))


# A transiently unavailable Web Storage API is also a recovery-sensitive startup state.
replace_once(
    "src/App.tsx",
    '''      (initialLoad.primaryHealth === "missing" || initialLoad.primaryHealth === "invalid"),''',
    '''      (initialLoad.primaryHealth === "missing" ||
        initialLoad.primaryHealth === "invalid" ||
        initialLoad.primaryHealth === "unavailable"),''',
)

# When either storage layer cannot be safely inspected, keep one actionable safety banner
# instead of stacking the generic load error behind it.
replace_once(
    "src/App.tsx",
    '''      setNativeRecoveryStatus("error");\n      setNativeBackupRetryAllowed(false);\n      return;''',
    '''      setNativeRecoveryStatus("error");\n      setNativeBackupRetryAllowed(false);\n      setLoadError(false);\n      return;''',
)

# "native missing" only proves a fresh install when local primary is also missing.
# A corrupt local primary must still require explicit recovery/overwrite confirmation.
replace_once(
    "src/App.tsx",
    '''    // primary/backupの不存在を正常に確認できた時だけfresh installとして編集を解放する。\n    nativeRecoveryGateRef.current = false;\n    setNativeRecoveryStatus("idle");\n    saveGuardRef.current = initialLoad.loadFailed;''',
    '''    if (primaryHealth === "invalid") {\n      nativeRecoveryGateRef.current = false;\n      setNativeRecoveryStatus("idle");\n      saveGuardRef.current = true;\n      flagExternalConflict(false, false);\n      return;\n    }\n\n    // local primary と native primary/backup の不存在をすべて正常確認できた時だけfresh installとして解放する。\n    nativeRecoveryGateRef.current = false;\n    setNativeRecoveryStatus("idle");\n    saveGuardRef.current = false;\n    setLoadError(false);''',
)

replace_once(
    "src/lib/i18n.ts",
    '''  nativeRecoveryReadError:\n    "端末内の復元データを確認できませんでした。上書きを防ぐため、編集と保存を止めています。",''',
    '''  nativeRecoveryReadError:\n    "保存データの安全確認ができませんでした。上書きを防ぐため、編集と保存を止めています。",''',
)

# Add regressions before the suite's final closing brace.
test_path = Path("src/__tests__/App.native-durable-snapshot.test.tsx")
test_text = test_path.read_text()
marker = "\n});\n"
if not test_text.endswith(marker):
    raise SystemExit("unexpected native App test ending")
extra = r'''

  it("localStorage API自体が一時利用不能ならnative確認を必須化し、回復確認まで編集しない", async () => {
    storage.getItem.mockImplementation((key: string) => {
      if (key === STORAGE_KEY_FOR_TESTING) {
        throw new DOMException("storage unavailable", "SecurityError");
      }
      return storage._store[key] ?? null;
    });
    durable.read.mockResolvedValue({ status: "missing" });

    renderApp();
    await flushPromises();

    expect(container.textContent).toContain(copy.nativeRecoveryReadError);
    expect(container.querySelector('[data-testid="native-recovery-error"]')).not.toBeNull();
    act(() => click(findButton(container, copy.emptyAction)));
    act(() => vi.advanceTimersByTime(1_000));
    await flushPromises();
    expect(container.querySelector("textarea")).toBeNull();
    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBeUndefined();

    storage.getItem.mockImplementation((key: string) => storage._store[key] ?? null);
    act(() => click(findButton(container, copy.nativeRecoveryRetry)));
    await flushPromises();

    expect(container.textContent).not.toContain(copy.nativeRecoveryReadError);
    act(() => click(findButton(container, copy.emptyAction)));
    expect(container.querySelector("textarea")).not.toBeNull();
  });

  it("local primary破損かつnative不存在でもfresh install扱いせず明示復旧を要求する", async () => {
    storage._store[STORAGE_KEY_FOR_TESTING] = "{broken";
    durable.read.mockResolvedValue({ status: "missing" });

    renderApp();
    await flushPromises();

    expect(container.textContent).toContain(copy.storageRecoveryTitle);
    expect(hasButton(container, copy.storageRecoverySave)).toBe(true);

    act(() => click(findButton(container, copy.emptyAction)));
    act(() => vi.advanceTimersByTime(1_000));
    await flushPromises();

    expect(storage._store[STORAGE_KEY_FOR_TESTING]).toBe("{broken");
  });
'''
test_path.write_text(test_text[:-len(marker)] + extra + marker)
