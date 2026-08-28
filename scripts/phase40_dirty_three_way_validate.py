from pathlib import Path
import runpy

runpy.run_path("scripts/phase40_dirty_three_way.py", run_name="__main__")

test = Path("src/__tests__/App.native-durable-snapshot.test.tsx")
text = test.read_text()

# Candidate switches intentionally re-query the textarea. Narrow every re-query explicitly.
old = '    textarea = container.querySelector("textarea");\n'
new = (
    '    textarea = container.querySelector("textarea");\n'
    '    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea not found");\n'
)
if old not in text:
    raise SystemExit("three-way textarea re-query marker not found")
text = text.replace(old, new)

# The initial textarea is a mutable `let` because later candidate switches reassign it.
# TypeScript correctly drops its narrowing inside a callback. Freeze an alias for the edit event.
for value in ("screen dirty", "絶対に守るdirty", "probe中も守るscreen"):
    old_block = (
        '    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;\n'
        '    act(() => {\n'
        f'      setter?.call(textarea, "{value}");\n'
        '      textarea.dispatchEvent(new Event("input", { bubbles: true }));\n'
        '    });'
    )
    new_block = (
        '    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;\n'
        '    const dirtyTextarea = textarea;\n'
        '    act(() => {\n'
        f'      setter?.call(dirtyTextarea, "{value}");\n'
        '      dirtyTextarea.dispatchEvent(new Event("input", { bubbles: true }));\n'
        '    });'
    )
    if old_block not in text:
        raise SystemExit(f"initial dirty textarea block not found: {value}")
    text = text.replace(old_block, new_block, 1)

test.write_text(text)
