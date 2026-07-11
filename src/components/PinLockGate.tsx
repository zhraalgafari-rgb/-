import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  hashPin, isUnlocked, markUnlocked, markLocked,
  getLockRemaining, setLockedUntil, clearLockTimer,
} from "@/lib/pin";
import { biometricEnabled, verifyBiometric } from "@/lib/biometric";
import { Lock, Delete, LogOut, Fingerprint } from "lucide-react";
import { toast } from "sonner";

const AUTOLOCK_KEY = "daftarak.autolock.minutes";
const LAST_ACTIVE_KEY = "daftarak.lastActive";
const ATTEMPTS_KEY = "daftarak.pin.attempts";

const profileCache = new Map<string, { pin_hash: string | null; onboarded: boolean | null }>();

function getCachedProfile(userId: string) {
  if (!profileCache.has(userId)) {
    profileCache.set(userId, { pin_hash: null, onboarded: null });
  }
  return profileCache.get(userId)!;
}

export function PinLockGate({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const [pinHash, setPinHash] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(true);
  const [pin, setPin] = useState("");
  const [attempts, setAttempts] = useState(() => typeof window !== "undefined" ? Number(localStorage.getItem(ATTEMPTS_KEY) ?? "0") || 0 : 0);
  const [waitMs, setWaitMs] = useState(0);
  const [checking, setChecking] = useState(true);
  const autolockMin = useRef(5);

  useEffect(() => {
    if (!user) { setChecking(false); return; }
    let cancelled = false;
    (async () => {
      const cache = getCachedProfile(user.id);
      if (cache.pin_hash === null) {
        const { data } = await supabase.from("profiles").select("pin_hash, onboarded").eq("user_id", user.id).maybeSingle();
        cache.pin_hash = data?.pin_hash ?? null;
        cache.onboarded = data?.onboarded ?? false;
      }
      if (cancelled) return;
      setPinHash(cache.pin_hash);
      if (cache.pin_hash && !isUnlocked()) setUnlocked(false);
      setChecking(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!pinHash) return;
    const touch = () => { try { sessionStorage.setItem(LAST_ACTIVE_KEY, String(Date.now())); } catch { /* ignore */ } };
    touch();
    const evs: Array<keyof DocumentEventMap> = ["click", "keydown", "touchstart", "scroll"];
    evs.forEach((e) => document.addEventListener(e, touch, { passive: true }));

    const check = () => {
      const last = Number(sessionStorage.getItem(LAST_ACTIVE_KEY) ?? Date.now());
      const limit = autolockMin.current * 60_000;
      if (Date.now() - last >= limit) {
        markLocked();
        setUnlocked(false);
      }
    };
    const onVisibility = () => { if (document.hidden) check(); else touch(); };
    const t = setInterval(check, 30_000);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", check);

    return () => {
      evs.forEach((e) => document.removeEventListener(e, touch));
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", check);
      clearInterval(t);
    };
  }, [pinHash]);

  useEffect(() => {
    if (unlocked) return;
    const t = setInterval(() => setWaitMs(getLockRemaining()), 500);
    return () => clearInterval(t);
  }, [unlocked]);

  useEffect(() => {
    if (checking || unlocked || !pinHash) return;
    if (!biometricEnabled()) return;
    const id = setTimeout(() => { void tryBiometric(); }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking, unlocked, pinHash]);

  const press = (d: string) => {
    if (waitMs > 0) return;
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) verify(next);
  };
  const back = () => setPin((p) => p.slice(0, -1));

  const verify = async (val: string) => {
    const h = await hashPin(val, user!.id);
    if (h === pinHash) {
      markUnlocked();
      clearLockTimer();
      try { sessionStorage.setItem(LAST_ACTIVE_KEY, String(Date.now())); localStorage.removeItem(ATTEMPTS_KEY); } catch { /* ignore */ }
      setAttempts(0);
      setUnlocked(true);
      setPin("");
    } else {
      const a = attempts + 1;
      setAttempts(a);
      try { localStorage.setItem(ATTEMPTS_KEY, String(a)); } catch { /* ignore */ }
      setPin("");
      if (a >= 3) {
        setLockedUntil(30_000);
        setWaitMs(30_000);
        setAttempts(0);
        try { localStorage.removeItem(ATTEMPTS_KEY); } catch { /* ignore */ }
        toast.error("تم تجاوز المحاولات. انتظر 30 ثانية");
      } else {
        toast.error(`رقم غير صحيح (${3 - a} محاولات متبقية)`);
      }
    }
  };

  const wait = Math.ceil(waitMs / 1000);

  const forgotPin = async () => {
    if (!confirm("نسيت الرمز؟ سيتم تسجيل خروجك. أعد الدخول لإلغاء القفل من الإعدادات.")) return;
    markLocked();
    await signOut();
  };

  const tryBiometric = async () => {
    if (waitMs > 0) return;
    const ok = await verifyBiometric();
    if (ok) {
      markUnlocked();
      clearLockTimer();
      try { sessionStorage.setItem(LAST_ACTIVE_KEY, String(Date.now())); } catch { /* ignore */ }
      setUnlocked(true);
    } else {
      toast.error("فشل التحقق بالبصمة");
    }
  };

  const bioOn = biometricEnabled();

  if (checking || unlocked || !pinHash || !user) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[100] bg-gradient-hero flex flex-col items-center justify-center text-white p-6">
      <div className="size-16 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center mb-4 shadow-glow">
        <Lock className="size-7" />
      </div>
      <h2 className="text-xl font-bold">أدخل رقم الأمان</h2>
      <p className="text-white/80 text-sm mt-1 mb-6">{wait > 0 ? `قفل مؤقت — ${wait}s` : "للمتابعة إلى دفترك"}</p>

      <div className="flex gap-3 mb-8">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`size-4 rounded-full transition-all ${pin.length > i ? "bg-white scale-110" : "bg-white/30"}`} />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} onClick={() => press(d)} disabled={wait > 0}
            className="h-14 rounded-2xl bg-white/15 backdrop-blur text-2xl font-bold hover:bg-white/25 active:scale-95 transition-all disabled:opacity-40">
            {d}
          </button>
        ))}
        <div />
        <button onClick={() => press("0")} disabled={wait > 0} className="h-14 rounded-2xl bg-white/15 backdrop-blur text-2xl font-bold hover:bg-white/25 active:scale-95 transition-all disabled:opacity-40">0</button>
        <button onClick={back} className="h-14 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all flex items-center justify-center">
          <Delete className="size-5" />
        </button>
      </div>

      {bioOn && (
        <button onClick={tryBiometric} disabled={wait > 0}
          className="mt-6 inline-flex items-center gap-2 text-sm bg-white/15 hover:bg-white/25 active:scale-95 transition-all px-4 py-2 rounded-xl disabled:opacity-40">
          <Fingerprint className="size-4" /> فتح بالبصمة
        </button>
      )}

      <button onClick={forgotPin} className="mt-8 inline-flex items-center gap-2 text-sm text-white/80 hover:text-white">
        <LogOut className="size-4" /> نسيت الرمز؟ تسجيل خروج
      </button>
    </div>
  );
}
