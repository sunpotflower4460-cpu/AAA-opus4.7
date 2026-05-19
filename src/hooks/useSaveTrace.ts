import { useEffect, useRef, useState } from "react";

/**
 * 保存が落ち着いた瞬間だけ、短い「定着」の余韻を返す。
 * null を渡している間は発火せず、保存完了のシグナルだけを受け取る。
 */
export function useSaveTrace(signal: string | null | undefined, delay = 900): boolean {
  const [isSettling, setIsSettling] = useState(false);
  const previousSignalRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!signal) return;

    if (previousSignalRef.current !== signal) {
      previousSignalRef.current = signal;
      setIsSettling(true);

      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }

      timerRef.current = window.setTimeout(() => {
        setIsSettling(false);
        timerRef.current = null;
      }, delay);
    }
  }, [signal, delay]);

  return isSettling;
}

export default useSaveTrace;
