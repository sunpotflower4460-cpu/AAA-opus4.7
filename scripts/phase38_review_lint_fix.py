from pathlib import Path

path = Path("src/App.tsx")
text = path.read_text()
old = '''    if (nativeRecoveryInitiallyRequired) {\n      void probeNativeRecovery();\n      return () => {\n        nativeRecoveryProbeIdRef.current += 1;\n      };\n    }'''
new = '''    if (nativeRecoveryInitiallyRequired) {\n      // 初期state/refですでに編集・保存はgate済み。probeのstate通知はeffect本体の外で開始する。\n      queueMicrotask(() => {\n        void probeNativeRecovery();\n      });\n      return () => {\n        nativeRecoveryProbeIdRef.current += 1;\n      };\n    }'''
if text.count(old) != 1:
    raise SystemExit(f"expected one effect call, found {text.count(old)}")
path.write_text(text.replace(old, new, 1))
