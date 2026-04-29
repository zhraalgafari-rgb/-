import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { useTheme } from "@/lib/theme";
import { hashPin, markLocked } from "@/lib/pin";
import { Coins, Tags, Bell, Moon, Lock, LogOut, User, Download, ChevronLeft, Sun } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/settings")({ component: SettingsPage });

function SettingsPage() {
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const [displayName, setDisplayName] = useState("");
  const [hasPin, setHasPin] = useState(false);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("display_name, pin_hash").eq("user_id", user.id).maybeSingle();
      setDisplayName(data?.display_name ?? "");
      setHasPin(!!data?.pin_hash);
    })();
  }, [user]);

  const saveName = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ display_name: displayName.trim() || null }).eq("user_id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("تم الحفظ");
  };

  const setPinCode = async () => {
    if (!user) return;
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) return toast.error("الرقم يجب أن يكون 4 أرقام");
    if (pin !== pin2) return toast.error("الرقمان غير متطابقين");
    setBusy(true);
    const h = await hashPin(pin, user.id);
    const { error } = await supabase.from("profiles").update({ pin_hash: h }).eq("user_id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    setHasPin(true);
    setPin(""); setPin2("");
    toast.success("تم تفعيل القفل");
  };

  const removePin = async () => {
    if (!user) return;
    if (!confirm("إلغاء قفل التطبيق؟")) return;
    const { error } = await supabase.from("profiles").update({ pin_hash: null }).eq("user_id", user.id);
    if (error) return toast.error(error.message);
    setHasPin(false);
    toast.success("تم إلغاء القفل");
  };

  const exportData = async () => {
    if (!user) return;
    const [people, txs, expenses, currencies, categories] = await Promise.all([
      supabase.from("people").select("*"),
      supabase.from("transactions").select("*"),
      supabase.from("expenses").select("*"),
      supabase.from("currencies").select("*"),
      supabase.from("expense_categories").select("*"),
    ]);
    const blob = new Blob([JSON.stringify({
      exportedAt: new Date().toISOString(),
      people: people.data, transactions: txs.data, expenses: expenses.data, currencies: currencies.data, categories: categories.data,
    }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `daftarak-backup-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success("تم التنزيل");
  };

  const handleSignOut = async () => {
    markLocked();
    await signOut();
  };

  const Row = ({ to, icon: Icon, label, desc }: any) => (
    <Link to={to} className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors">
      <div className="size-10 rounded-xl bg-secondary text-primary flex items-center justify-center">
        <Icon className="size-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">{label}</div>
        {desc && <div className="text-xs text-muted-foreground">{desc}</div>}
      </div>
      <ChevronLeft className="size-4 text-muted-foreground" />
    </Link>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="size-10 rounded-xl bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-glow">
          <User className="size-5" />
        </div>
        <div>
          <h1 className="font-bold text-lg leading-tight">الإعدادات</h1>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold text-sm">الملف الشخصي</h3>
        <div className="space-y-1.5">
          <Label className="text-xs">الاسم المعروض</Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="اسمك" maxLength={60} />
        </div>
        <Button onClick={saveName} disabled={busy} className="w-full">حفظ</Button>
      </Card>

      <Card className="p-2">
        <Row to="/app/currencies" icon={Coins} label="العملات" desc="إدارة العملات وأسعار التحويل" />
        <Row to="/app/categories" icon={Tags} label="تصنيفات المصاريف" desc="إضافة وتعديل التصنيفات" />
        <Row to="/app/budgets" icon={Coins} label="الميزانية الشهرية" desc="حدّد سقف لكل تصنيف" />
        <Row to="/app/reminders" icon={Bell} label="التذكيرات" desc="مواعيد استرداد الديون" />
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-secondary text-primary flex items-center justify-center">
              {theme === "dark" ? <Moon className="size-5" /> : <Sun className="size-5" />}
            </div>
            <div>
              <div className="font-semibold text-sm">الوضع الداكن</div>
              <div className="text-xs text-muted-foreground">تبديل بين الفاتح والداكن</div>
            </div>
          </div>
          <Switch checked={theme === "dark"} onCheckedChange={toggle} />
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-secondary text-primary flex items-center justify-center">
            <Lock className="size-5" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-sm">قفل التطبيق برقم سري</div>
            <div className="text-xs text-muted-foreground">{hasPin ? "مفعّل — سيُطلب الرقم عند فتح التطبيق" : "غير مفعّل"}</div>
          </div>
        </div>
        {hasPin ? (
          <Button variant="outline" onClick={removePin} className="w-full text-danger border-danger/30">إلغاء القفل</Button>
        ) : (
          <div className="space-y-2">
            <Input type="password" inputMode="numeric" maxLength={4} placeholder="رقم من 4 خانات" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g,""))} dir="ltr" />
            <Input type="password" inputMode="numeric" maxLength={4} placeholder="تأكيد الرقم" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g,""))} dir="ltr" />
            <Button onClick={setPinCode} disabled={busy} className="w-full bg-gradient-primary text-primary-foreground">تفعيل القفل</Button>
          </div>
        )}
      </Card>

      <Card className="p-2">
        <button onClick={exportData} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors text-right">
          <div className="size-10 rounded-xl bg-secondary text-primary flex items-center justify-center">
            <Download className="size-5" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-sm">نسخة احتياطية (JSON)</div>
            <div className="text-xs text-muted-foreground">تنزيل كل بياناتك</div>
          </div>
        </button>
        <button onClick={handleSignOut} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-danger-soft transition-colors text-right text-danger">
          <div className="size-10 rounded-xl bg-danger-soft flex items-center justify-center">
            <LogOut className="size-5" />
          </div>
          <div className="flex-1 text-right">
            <div className="font-semibold text-sm">تسجيل الخروج</div>
          </div>
        </button>
      </Card>
    </div>
  );
}
