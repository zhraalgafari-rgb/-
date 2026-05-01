import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { processDueRecurring } from "@/lib/recurring";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowRight, Plus, Repeat, Trash2, Play, Pause, RotateCw } from "lucide-react";
import { fmtMoney, fmtDate } from "@/lib/format";
import { AmountInput } from "@/components/AmountInput";
import { evalExpr } from "@/lib/calc";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";

export const Route = createFileRoute("/app/recurring")({ component: RecurringPage });

interface Rule {
  id: string;
  kind: string;
  amount: number;
  currency_id: string;
  category_id: string | null;
  person_id: string | null;
  direction: string | null;
  frequency: string;
  next_run: string;
  is_active: boolean;
  title: string;
  note: string | null;
}
interface Cur { id: string; name: string; is_base: boolean }
interface Cat { id: string; name: string; color: string; icon: string }
interface Person { id: string; name: string }

const FREQ_LABEL: Record<string, string> = { daily: "يومي", weekly: "أسبوعي", monthly: "شهري", yearly: "سنوي" };

function RecurringPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Rule[]>([]);
  const [curs, setCurs] = useState<Cur[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // form
  const [kind, setKind] = useState<"expense" | "transaction">("expense");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [personId, setPersonId] = useState("");
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly" | "yearly">("monthly");
  const [nextRun, setNextRun] = useState("");
  const [note, setNote] = useState("");

  const load = async () => {
    if (!user) return;
    const [{ data: r }, { data: c }, { data: ca }, { data: p }] = await Promise.all([
      supabase.from("recurring_rules").select("*").order("next_run"),
      supabase.from("currencies").select("id,name,is_base").order("is_base", { ascending: false }),
      supabase.from("expense_categories").select("id,name,color,icon").order("sort_order"),
      supabase.from("people").select("id,name").eq("is_archived", false),
    ]);
    setItems((r ?? []) as Rule[]);
    setCurs((c ?? []) as Cur[]);
    setCats((ca ?? []) as Cat[]);
    setPeople((p ?? []) as Person[]);
  };
  useEffect(() => { load(); }, [user]);

  const reset = () => {
    setKind("expense"); setTitle(""); setAmount(""); setNote("");
    setCategoryId(cats[0]?.id ?? "");
    setPersonId(""); setDirection("credit");
    setFrequency("monthly");
    const d = new Date(); d.setDate(d.getDate() + 1);
    setNextRun(d.toISOString().slice(0, 16));
    const base = curs.find((c) => c.is_base) ?? curs[0];
    setCurrencyId(base?.id ?? "");
  };

  const save = async () => {
    if (!user) return;
    if (!title.trim()) return toast.error("أدخل العنوان");
    const amt = evalExpr(amount);
    if (!isFinite(amt) || amt <= 0) return toast.error("مبلغ غير صحيح");
    if (!currencyId) return toast.error("اختر العملة");
    if (kind === "transaction" && !personId) return toast.error("اختر الشخص");
    setBusy(true);
    const { error } = await supabase.from("recurring_rules").insert({
      user_id: user.id,
      kind,
      title: title.trim(),
      amount: amt,
      currency_id: currencyId,
      category_id: kind === "expense" ? (categoryId || null) : null,
      person_id: kind === "transaction" ? personId : null,
      direction: kind === "transaction" ? direction : null,
      frequency,
      next_run: new Date(nextRun).toISOString(),
      note: note.trim() || null,
      is_active: true,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("تم الحفظ"); setOpen(false); load();
  };

  const toggleActive = async (r: Rule) => {
    await supabase.from("recurring_rules").update({ is_active: !r.is_active }).eq("id", r.id);
    load();
  };

  const del = async (id: string) => {
    if (!confirm("حذف هذه الدورية؟")) return;
    await supabase.from("recurring_rules").delete().eq("id", id);
    toast.success("تم الحذف"); load();
  };

  const runNow = async () => {
    if (!user) return;
    const n = await processDueRecurring(user.id);
    toast.success(n > 0 ? `تم توليد ${n} عملية` : "لا توجد عمليات مستحقة");
    load();
  };

  return (
    <div className="space-y-4">
      <Link to="/app/settings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4" /> رجوع للإعدادات
      </Link>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="size-10 rounded-xl bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-glow">
            <Repeat className="size-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">المعاملات المتكررة</h1>
            <p className="text-xs text-muted-foreground">{items.length} دورية</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <Button onClick={runNow} variant="outline" size="sm" title="توليد المستحقات الآن">
            <RotateCw className="size-4" />
          </Button>
          <Dialog open={open} onOpenChange={(v) => { if (v) reset(); setOpen(v); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-primary text-primary-foreground"><Plus className="size-4" /> جديد</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto">
              <DialogHeader><DialogTitle className="text-right">دورية جديدة</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setKind("expense")} className={`p-2.5 rounded-xl border-2 text-sm font-semibold ${kind === "expense" ? "border-primary bg-secondary" : "border-border"}`}>
                    مصروف
                  </button>
                  <button onClick={() => setKind("transaction")} className={`p-2.5 rounded-xl border-2 text-sm font-semibold ${kind === "transaction" ? "border-primary bg-secondary" : "border-border"}`}>
                    دين / استحقاق
                  </button>
                </div>

                <div className="space-y-1.5">
                  <Label>العنوان</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً: راتب، إيجار، اشتراك" maxLength={80} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label>المبلغ</Label>
                    <AmountInput value={amount} onChange={setAmount} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>العملة</Label>
                    <Select value={currencyId} onValueChange={setCurrencyId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{curs.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                {kind === "expense" ? (
                  <div className="space-y-1.5">
                    <Label>التصنيف</Label>
                    <Select value={categoryId} onValueChange={setCategoryId}>
                      <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                      <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label>الشخص</Label>
                      <Select value={personId} onValueChange={setPersonId}>
                        <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                        <SelectContent>{people.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setDirection("credit")} className={`p-2 rounded-xl border-2 text-xs font-semibold ${direction === "credit" ? "border-success bg-success-soft text-success" : "border-border"}`}>
                        له (دائن)
                      </button>
                      <button onClick={() => setDirection("debit")} className={`p-2 rounded-xl border-2 text-xs font-semibold ${direction === "debit" ? "border-danger bg-danger-soft text-danger" : "border-border"}`}>
                        عليه (مدين)
                      </button>
                    </div>
                  </>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label>التكرار</Label>
                    <Select value={frequency} onValueChange={(v) => setFrequency(v as never)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">يومي</SelectItem>
                        <SelectItem value="weekly">أسبوعي</SelectItem>
                        <SelectItem value="monthly">شهري</SelectItem>
                        <SelectItem value="yearly">سنوي</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>أول تشغيل</Label>
                    <Input type="datetime-local" dir="ltr" value={nextRun} onChange={(e) => setNextRun(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>ملاحظة (اختياري)</Label>
                  <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
                </div>

                <Button onClick={save} disabled={busy} className="w-full bg-gradient-primary text-primary-foreground">{busy ? "..." : "حفظ"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Repeat} title="لا توجد دوريات" description="أضف رواتب، إيجارات، اشتراكات لتُسجّل تلقائياً عند موعدها." />
      ) : (
        <div className="space-y-2">
          {items.map((r) => {
            const cur = curs.find((c) => c.id === r.currency_id)?.name ?? "";
            return (
              <Card key={r.id} className={`p-3 flex items-center gap-3 ${!r.is_active ? "opacity-60" : ""}`}>
                <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${r.kind === "expense" ? "bg-danger-soft text-danger" : r.direction === "credit" ? "bg-success-soft text-success" : "bg-primary/10 text-primary"}`}>
                  <Repeat className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{r.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {fmtMoney(Number(r.amount))} {cur} · {FREQ_LABEL[r.frequency]} · التالي {fmtDate(r.next_run)}
                  </div>
                </div>
                <button onClick={() => toggleActive(r)} className="p-2 text-muted-foreground hover:text-primary">
                  {r.is_active ? <Pause className="size-4" /> : <Play className="size-4" />}
                </button>
                <button onClick={() => del(r.id)} className="p-2 text-muted-foreground hover:text-danger"><Trash2 className="size-4" /></button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
