from pathlib import Path

path = Path("src/App.tsx")
text = path.read_text()

def replace_once(old: str, new: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"App.tsx: expected one match, found {count}")
    text = text.replace(old, new, 1)

replace_once(
    '''  const [nativeBackupError, setNativeBackupError] = useState(false);\n''',
    '''  const [nativeBackupError, setNativeBackupError] = useState(false);\n  const [nativeBackupRetryAllowed, setNativeBackupRetryAllowed] = useState(false);\n''',
)

replace_once(
    '''  const persistDurableSnapshot = useCallback((snapshot: readonly Note[]) => {\n    void persistNativeDurableSnapshot(snapshot).then((ok) => {\n      if (mountedRef.current) setNativeBackupError(!ok);\n    });\n  }, []);''',
    '''  const persistDurableSnapshot = useCallback((snapshot: readonly Note[]) => {\n    void persistNativeDurableSnapshot(snapshot).then((ok) => {\n      if (!mountedRef.current) return;\n      setNativeBackupError(!ok);\n      setNativeBackupRetryAllowed(\n        !ok &&\n          !notesDirtyRef.current &&\n          !saveGuardRef.current &&\n          !externalConflictRef.current,\n      );\n    });\n  }, []);''',
)

replace_once(
    '''      setLastSaveResult({ ok: false, reason: "conflict" });\n      // 状態が回復した後に古い汎用エラーが残らないよう、毎回現在状態へ揃える。''',
    '''      setLastSaveResult({ ok: false, reason: "conflict" });\n      setNativeBackupRetryAllowed(false);\n      // 状態が回復した後に古い汎用エラーが残らないよう、毎回現在状態へ揃える。''',
)

replace_once(
    '''        setNativeBackupError(false);\n        return;''',
    '''        setNativeBackupError(false);\n        setNativeBackupRetryAllowed(false);\n        return;''',
)

replace_once(
    '''  const canRetryNativeBackup =\n    nativeBackupError &&\n    !notesDirtyRef.current &&\n    !saveGuardRef.current &&\n    !externalConflictRef.current;\n''',
    '''  const canRetryNativeBackup =\n    nativeBackupError && nativeBackupRetryAllowed && !externalConflict;\n''',
)

path.write_text(text)
