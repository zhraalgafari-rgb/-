import { useEffect, useRef, useState } from "react";

/** Lightweight pull-to-refresh. Trigger when user pulls down >70px from top. */
export function usePullToRefresh(onRefresh: () => void | Promise<void>) {
  const [pulling, setPulling] = useState(0);
  const startY = useRef<number | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      if (window.scrollY > 0) return;
      startY.current = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current == null || busy.current) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0) setPulling(Math.min(dy, 100));
    };
    const onEnd = async () => {
      if (startY.current == null) return;
      const p = pulling;
      startY.current = null;
      setPulling(0);
      if (p > 70 && !busy.current) {
        busy.current = true;
        try { await onRefresh(); } finally { busy.current = false; }
      }
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
    };
  }, [pulling, onRefresh]);

  return pulling;
}
