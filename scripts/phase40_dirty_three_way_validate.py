from pathlib import Path
import runpy

runpy.run_path("scripts/phase40_dirty_three_way.py", run_name="__main__")

# The three-way regression intentionally re-queries the textarea after candidate switches.
# Reassignment loses the earlier instanceof narrowing, so narrow each re-query explicitly.
test = Path("src/__tests__/App.native-durable-snapshot.test.tsx")
text = test.read_text()
old = '    textarea = container.querySelector("textarea");\n'
new = (
    '    textarea = container.querySelector("textarea");\n'
    '    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");\n'
)
if old not in text:
    raise SystemExit("three-way textarea re-query marker not found")
test.write_text(text.replace(old, new))
