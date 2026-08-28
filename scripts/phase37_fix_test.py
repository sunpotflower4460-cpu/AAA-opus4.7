from pathlib import Path

path = Path("src/lib/__tests__/nativeAppLifecycle.test.ts")
text = path.read_text()
old = '''    let resolveHandle: ((value: { remove: () => Promise<void> }) => void) | null = null;\n    const remove = vi.fn().mockResolvedValue(undefined);\n    mocks.addListener.mockReturnValue(\n      new Promise((resolve) => {\n        resolveHandle = resolve;\n      }),\n    );\n\n    const unsubscribe = subscribeToNativeAppState(() => {});\n    unsubscribe();\n    resolveHandle?.({ remove });'''
new = '''    let resolveHandle!: (value: { remove: () => Promise<void> }) => void;\n    const remove = vi.fn().mockResolvedValue(undefined);\n    mocks.addListener.mockReturnValue(\n      new Promise((resolve) => {\n        resolveHandle = resolve;\n      }),\n    );\n\n    const unsubscribe = subscribeToNativeAppState(() => {});\n    unsubscribe();\n    resolveHandle({ remove });'''
if text.count(old) != 1:
    raise SystemExit("phase37 deferred listener test anchor mismatch")
path.write_text(text.replace(old, new, 1))
