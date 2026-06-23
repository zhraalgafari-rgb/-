import { useEffect, useRef, useState } from "react";

/** Lightweight pull-to-refresh. Triggers when the user pulls down >70px from top. */
export function usePullToRefresh(onRefresh: () => void | Promise<void>) {
  const [pulling, setPulling] = useState(0);
  const pullRef = useRef(0);
  const startY = useRef<number | null>(null);
  const busy = useRef(false);
  const cbRef = useRef(onRefresh);

  // Keep latest callback without retearing listeners.
  useEffect(() => { cbRef.current = onRefresh; }, [onRefresh]);

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      if (window.scrollY > 0 || busy.current) return;
      startY.current = e.touches[0].clientY;
      pullRef.current = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current == null || busy.current) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0) {
        const next = Math.min(dy, 100);
        pullRef.current = next;
        setPulling(next);
      }
    };
    const onEnd = async () => {
      if (startY.current == null) return;
      const p = pullRef.current;
      startY.current = null;
      pullRef.current = 0;
      setPulling(0);
      if (p > 70 && !busy.current) {
        busy.current = true;
        try { await cbRef.current(); } finally { busy.current = false; }
      }
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  return pulling;
}
