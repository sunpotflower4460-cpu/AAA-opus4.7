from pathlib import Path

app = Path("src/App.tsx")
text = app.read_text()
old = '''      !initialLoad.recoveryPending &&\n      (initialLoad.primaryHealth === "missing" ||\n        initialLoad.primaryHealth === "invalid" ||\n        initialLoad.primaryHealth === "unavailable"),'''
new = '''      !initialLoad.recoveryPending &&\n      (initialLoad.loadFailed ||\n        initialLoad.primaryHealth === "missing" ||\n        initialLoad.primaryHealth === "invalid" ||\n        initialLoad.primaryHealth === "unavailable"),'''
if text.count(old) != 1:
    raise SystemExit(f"startup gate: expected one match, found {text.count(old)}")
app.write_text(text.replace(old, new, 1))

test = Path("src/__tests__/App.native-durable-snapshot.test.tsx")
t = test.read_text()
marker = '\n  it("localStorage API自体が一時利用不能ならnative確認を必須化し、回復確認まで編集しない", async () => {'
if t.count(marker) != 1:
    raise SystemExit(f"test insertion marker: expected one match, found {t.count(marker)}")
extra = r'''

  it("初回loadNotesだけ一時失敗して直後にprimaryが読めてもnative safety probeで現在正本へ収束する", async () => {
    const existing = [makeNote({ title: "一時障害後の正本" })];
    storage._store[STORAGE_KEY_FOR_TESTING] = JSON.stringify(existing);
    let primaryReads = 0;
    storage.getItem.mockImplementation((key: string) => {
      if (key === STORAGE_KEY_FOR_TESTING) {
        primaryReads += 1;
        if (primaryReads === 1) {
          throw new DOMException("transient storage failure", "SecurityError");
        }
      }
      return storage._store[key] ?? null;
    });
    durable.read.mockResolvedValue({ status: "missing" });

    renderApp();
    expect(container.querySelector('[data-testid="native-recovery-checking"]')).not.toBeNull();
    expect(container.textContent).not.toContain(
      "データの読み込みに問題がありました。メモが復元できない可能性があります。",
    );

    await flushPromises();

    expect(container.textContent).toContain("一時障害後の正本");
    expect(container.querySelector('[data-testid="native-recovery-checking"]')).toBeNull();
    expect(container.querySelector('[data-testid="native-recovery-error"]')).toBeNull();
    expect(durable.persist).toHaveBeenCalledWith(existing);
  });
'''
test.write_text(t.replace(marker, extra + marker, 1))
