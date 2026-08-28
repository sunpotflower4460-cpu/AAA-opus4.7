from pathlib import Path

app = Path("src/App.tsx")
text = app.read_text()
old = '''  const [loadError, setLoadError] = useState<boolean>(\n    initialLoad.loadFailed && !initialLoad.recoveryPending,\n  );'''
new = '''  const [loadError, setLoadError] = useState<boolean>(\n    initialLoad.loadFailed &&\n      !initialLoad.recoveryPending &&\n      !nativeRecoveryInitiallyRequired,\n  );'''
if text.count(old) != 1:
    raise SystemExit(f"App loadError initializer: expected one match, found {text.count(old)}")
app.write_text(text.replace(old, new, 1))

test = Path("src/__tests__/App.native-durable-snapshot.test.tsx")
t = test.read_text()
old_test = '''    expect(container.textContent).toContain(copy.nativeRecoveryReadError);\n    expect(container.querySelector('[data-testid="native-recovery-error"]')).not.toBeNull();'''
new_test = '''    expect(container.textContent).toContain(copy.nativeRecoveryReadError);\n    expect(container.textContent).not.toContain(\n      "データの読み込みに問題がありました。メモが復元できない可能性があります。",\n    );\n    expect(container.querySelector('[data-testid="native-recovery-error"]')).not.toBeNull();'''
if t.count(old_test) != 1:
    raise SystemExit(f"native recovery unavailable test: expected one match, found {t.count(old_test)}")
test.write_text(t.replace(old_test, new_test, 1))
