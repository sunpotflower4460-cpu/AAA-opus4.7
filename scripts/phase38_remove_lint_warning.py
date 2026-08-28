from pathlib import Path

path = Path("src/App.tsx")
text = path.read_text()
old = '''    flagExternalConflict,\n    initialLoad.loadFailed,\n    persistDurableSnapshot,\n  ]);'''
new = '''    flagExternalConflict,\n    persistDurableSnapshot,\n  ]);'''
if text.count(old) != 1:
    raise SystemExit(f"expected one dependency block, found {text.count(old)}")
path.write_text(text.replace(old, new, 1))
