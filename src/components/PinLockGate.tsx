import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { hashPin, isUnlocked, markUnlocked, getLockRemaining, setLockedUntil, clearLockTimer } from "@/lib/pin";
import { Lock, Delete } from "lucide-react";
import { toast } from "sonner";

export function PinLockGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [pinHash, setPinHash] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(true);
  const [pin, setPin] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [waitMs, setWaitMs] = useState(0);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!user) { setChecking(false); return; }
    (async () => {
      const { data } = await supabase.from("profiles").select("pin_hash").eq("user_id", user.id).maybeSingle();
      const h = data?.pin_hash ?? null;
      setPinHash(h);
      if (h && !isUnlocked()) setUnlocked(false);
      setChecking(false);
    })();
  }, [user]);

  useEffect(() => {
    if (unlocked) return;
    const t = setInterval(() => setWaitMs(getLockRemaining()), 500);
    return () => clearInterval(t);
  }, [unlocked]);

  if (checking || unlocked || !pinHash || !user) return <>{children}</>;

  const press = (d: string) => {
    if (waitMs > 0) return;
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) verify(next);
  };
  const back = () => setPin((p) => p.slice(0, -1));

  const verify = async (val: string) => {
    const h = await hashPin(val, user.id);
    if (h === pinHash) {
      markUnlocked();
      clearLockTimer();
      setUnlocked(true);
      setPin("");
    } else {
      const a = attempts + 1;
      setAttempts(a);
      setPin("");
      if (a >= 3) {
        setLockedUntil(30_000);
        setWaitMs(30_000);
        setAttempts(0);
        toast.error("تم تجاوز المحاولات. انتظر 30 ثانية");
      } else {
        toast.error(`رقم غير صحيح (${3 - a} محاولات متبقية)`);
      }
    }
  };

  const wait = Math.ceil(waitMs / 1000);

  return (
    <div className="fixed inset-0 z-[100] bg-gradient-hero flex flex-col items-center justify-center text-white p-6">
      <div className="size-16 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center mb-4 shadow-glow">
        <Lock className="size-7" />
      </div>
      <h2 className="text-xl font-bold">أدخل رقم الأمان</h2>
      <p className="text-white/80 text-sm mt-1 mb-6">{wait > 0 ? `قفل مؤقت — ${wait}s` : "للمتابعة إلى دفترك"}</p>

      <div className="flex gap-3 mb-8">
        {[0,1,2,3].map((i) => (
          <div key={i} className={`size-4 rounded-full transition-all ${pin.length > i ? "bg-white scale-110" : "bg-white/30"}`} />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {["1","2","3","4","5","6","7","8","9"].map((d) => (
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
    </div>
  );
}
