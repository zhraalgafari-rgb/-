import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/common/PageHeader";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { hashPin } from "@/lib/pin";
import { Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/settings/security")({ component: SecurityPage });

const AUTOLOCK_KEY = "daftarak.autolock.minutes";

function SecurityPage() {
  const { user } = useAuth();
  const [hasPin, setHasPin] = useState(false);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [autolock, setAutolock] = useState<number>(5);
  const [biometric, setBiometric] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("pin_hash").eq("user_id", user.id).maybeSingle();
      setHasPin(!!data?.pin_hash);
    })();
    try {
      const v = Number(localStorage.getItem(AUTOLOCK_KEY) ?? "5");
      setAutolock(isNaN(v) ? 5 : v);
      setBiometric(localStorage.getItem("daftarak.biometric") === "1");
    } catch {}
  }, [user]);

  const setPinCode = async () => {
    if (!user) return;
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) return toast.error("الرقم يجب أن يكون 4 أرقام");
    if (pin !== pin2) return toast.error("الرقمان غير متطابقين");
    setBusy(true);
    const h = await hashPin(pin, user.id);
    const { error } = await supabase.from("profiles").update({ pin_hash: h }).eq("user_id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    setHasPin(true); setPin(""); setPin2("");
    toast.success("تم تفعيل القفل");
  };

  const removePin = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ pin_hash: null }).eq("user_id", user.id);
    if (error) { toast.error(error.message); return; }
    setHasPin(false);
    toast.success("تم إلغاء القفل");
  };

  const saveAutolock = (v: number) => {
    setAutolock(v);
    try { localStorage.setItem(AUTOLOCK_KEY, String(v)); } catch {}
  };

  const toggleBio = (v: boolean) => {
    setBiometric(v);
    try { localStorage.setItem("daftarak.biometric", v ? "1" : "0"); } catch {}
    if (v) toast.info("سيتم استخدام البصمة عند توفرها");
  };

  return (
    <div className="space-y-4">
      <PageHeader icon={ShieldCheck} title="الأمان والخصوصية" subtitle="حماية بياناتك المالية" back="/app/settings" />

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-secondary text-primary flex items-center justify-center">
            <Lock className="size-5" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-sm">قفل التطبيق برقم سري</div>
            <div className="text-xs text-muted-foreground">{hasPin ? "مفعّل" : "غير مفعّل"}</div>
          </div>
        </div>
        {hasPin ? (
          <Button variant="outline" onClick={() => setConfirmRemove(true)} className="w-full text-danger border-danger/30">إلغاء القفل</Button>
        ) : (
          <div className="space-y-2">
            <Input type="password" inputMode="numeric" maxLength={4} placeholder="رقم من 4 خانات" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g,""))} dir="ltr" />
            <Input type="password" inputMode="numeric" maxLength={4} placeholder="تأكيد الرقم" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g,""))} dir="ltr" />
            <Button onClick={setPinCode} disabled={busy} className="w-full bg-gradient-primary text-primary-foreground">تفعيل القفل</Button>
          </div>
        )}
      </Card>

      {hasPin && (
        <Card className="p-4 space-y-3">
          <Label className="text-xs">القفل التلقائي بعد</Label>
          <div className="grid grid-cols-4 gap-2">
            {[1, 5, 15, 30].map((m) => (
              <button
                key={m}
                onClick={() => saveAutolock(m)}
                className={`py-2 rounded-lg text-sm font-semibold transition-all ${autolock === m ? "bg-gradient-primary text-primary-foreground shadow-glow" : "bg-secondary text-muted-foreground"}`}
              >
                {m} د
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">يقفل التطبيق بعد عدم النشاط لهذه المدة.</p>
        </Card>
      )}

      <Card className="p-4 flex items-center justify-between">
        <div>
          <div className="font-semibold text-sm">البصمة (إن أمكن)</div>
          <div className="text-xs text-muted-foreground">استخدم بصمة الجهاز إن دعمها المتصفح</div>
        </div>
        <Switch checked={biometric} onCheckedChange={toggleBio} />
      </Card>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="إلغاء قفل التطبيق؟"
        description="سيتمكن أي شخص من الوصول لبياناتك."
        confirmLabel="إلغاء القفل"
        destructive
        onConfirm={removePin}
      />
    </div>
  );
}
