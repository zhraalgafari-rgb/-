import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ArrowRight, Plus, Trash2, TrendingUp, TrendingDown, Pencil, Share2, MessageCircle, Archive } from "lucide-react";
import { ListSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtMoney, fmtDate, fmtTime } from "@/lib/format";
import { toast } from "sonner";
import { AddTransactionDialog } from "@/components/AddTransactionDialog";

export const Route = createFileRoute("/app/person/$id")({ component: PersonPage });

interface Currency { id: string; name: string; symbol: string; rate: number; is_base: boolean }
interface Tx { id: string; person_id: string; amount: number; direction: string; currency_id: string; transaction_date: string; details: string | null }

function PersonPage() {
  const { id } = useParams({ from: "/app/person/$id" });
  const { user } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const [editName, setEditName] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftPhone, setDraftPhone] = useState("");
  const [txs, setTxs] = useState<Tx[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [openAdd, setOpenAdd] = useState(false);
  const [editingTx, setEditingTx] = useState<Tx | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: person }, { data: t }, { data: c }, { data: p }] = await Promise.all([
      supabase.from("people").select("name,phone").eq("id", id).single(),
      supabase.from("transactions").select("*").eq("person_id", id).order("transaction_date", { ascending: false }),
      supabase.from("currencies").select("*").order("is_base", { ascending: false }),
      supabase.from("people").select("id,name"),
    ]);
    setName(person?.name ?? "");
    setPhone(person?.phone ?? null);
    setDraftName(person?.name ?? "");
    setDraftPhone(person?.phone ?? "");
    setTxs((t ?? []) as Tx[]);
    setCurrencies((c ?? []) as Currency[]);
    setPeople((p ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user, id]);

  const balance = useMemo(() => {
    let net = 0;
    for (const t of txs) {
      const cur = currencies.find((c) => c.id === t.currency_id);
      const rate = cur?.rate ?? 1;
      const sign = t.direction === "credit" ? 1 : -1;
      net += Number(t.amount) * sign * rate;
    }
    return net;
  }, [txs, currencies]);

  const ordered = [...txs].sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());
  const running: Record<string, number> = {};
  let acc = 0;
  for (const t of ordered) {
    const cur = currencies.find((c) => c.id === t.currency_id);
    acc += Number(t.amount) * (t.direction === "credit" ? 1 : -1) * (cur?.rate ?? 1);
    running[t.id] = acc;
  }

  const delTx = async (txId: string) => {
    if (!confirm("حذف هذه المعاملة؟")) return;
    const { error } = await supabase.from("transactions").delete().eq("id", txId);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف"); load();
  };

  const archivePerson = async () => {
    if (!confirm(`أرشفة ${name}؟ (يمكن استعادتها لاحقاً)`)) return;
    const { error } = await supabase.from("people").update({ is_archived: true }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تمت الأرشفة"); nav({ to: "/app" });
  };

  const delPerson = async () => {
    if (txs.length > 0) return toast.error("استخدم الأرشفة بدلاً من الحذف — لديه معاملات");
    if (!confirm(`حذف ${name} نهائياً؟`)) return;
    const { error } = await supabase.from("people").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف"); nav({ to: "/app" });
  };

  const saveName = async () => {
    if (!draftName.trim()) return toast.error("الاسم مطلوب");
    const { error } = await supabase.from("people").update({ name: draftName.trim(), phone: draftPhone.trim() || null }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم الحفظ"); setEditName(false); load();
  };

  const buildShareText = () => {
    const lines = [`📒 كشف حساب: ${name}`, ""];
    for (const t of [...txs].sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime())) {
      const cur = currencies.find((c) => c.id === t.currency_id)?.name ?? "";
      const sign = t.direction === "credit" ? "+" : "-";
      lines.push(`${fmtDate(t.transaction_date)} | ${sign}${fmtMoney(Number(t.amount))} ${cur}${t.details ? " — " + t.details : ""}`);
    }
    lines.push("", `الرصيد: ${balance >= 0 ? "+" : ""}${fmtMoney(balance)} ${balance >= 0 ? "(له)" : "(عليه)"}`);
    lines.push("— عبر تطبيق دفترك");
    return lines.join("\n");
  };

  const share = async () => {
    const text = buildShareText();
    if (navigator.share) {
      try { await navigator.share({ title: `كشف حساب ${name}`, text }); return; } catch {}
    }
    await navigator.clipboard.writeText(text);
    toast.success("تم نسخ الكشف للحافظة");
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(buildShareText());
    const phoneClean = phone ? phone.replace(/\D/g, "") : "";
    window.open(phoneClean ? `https://wa.me/${phoneClean}?text=${text}` : `https://wa.me/?text=${text}`, "_blank");
  };

  const isCredit = balance >= 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link to="/app" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowRight className="size-4" /> رجوع
        </Link>
        <div className="flex items-center gap-1">
          <button onClick={share} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-primary"><Share2 className="size-4" /></button>
          <button onClick={shareWhatsApp} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-success"><MessageCircle className="size-4" /></button>
          <button onClick={() => setEditName(true)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-primary"><Pencil className="size-4" /></button>
          <button onClick={archivePerson} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-primary" title="أرشفة"><Archive className="size-4" /></button>
          <button onClick={delPerson} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-danger" title="حذف"><Trash2 className="size-4" /></button>
        </div>
      </div>

      <div className={`rounded-2xl p-4 shadow-elevated text-white ${isCredit ? "bg-gradient-success" : "bg-gradient-danger"}`}>
        <div className="text-xs opacity-90 mb-1">{name}{phone && <span className="ms-2 opacity-75" dir="ltr">{phone}</span>}</div>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs opacity-90">{isCredit ? "له عندك" : "عليه"}</div>
            <div className="text-3xl font-black mt-0.5">{fmtMoney(Math.abs(balance))}</div>
          </div>
          <div className="text-xs opacity-90">{txs.length} معاملة</div>
        </div>
      </div>

      {loading ? (
        <ListSkeleton rows={4} />
      ) : txs.length === 0 ? (
        <EmptyState icon={Plus} title="لا توجد معاملات بعد" description="أضف أول معاملة لهذا الشخص." variant="compact" />
      ) : (
        <div className="space-y-2">
          {txs.map((t) => {
            const cur = currencies.find((c) => c.id === t.currency_id);
            const credit = t.direction === "credit";
            return (
              <div key={t.id} className="bg-card border rounded-2xl p-3 shadow-card">
                <div className="flex items-start gap-3">
                  <div className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${credit ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
                    {credit ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className={`font-bold ${credit ? "text-success" : "text-danger"}`}>
                        {credit ? "+" : "-"}{fmtMoney(Number(t.amount))} <span className="text-xs text-muted-foreground font-normal">{cur?.name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{fmtDate(t.transaction_date)} · {fmtTime(t.transaction_date)}</div>
                    </div>
                    {t.details && <div className="text-sm text-muted-foreground mt-0.5 truncate">{t.details}</div>}
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="text-[11px] text-muted-foreground">الرصيد: {fmtMoney(Math.abs(running[t.id]))} {running[t.id] >= 0 ? "له" : "عليه"}</div>
                      <div className="flex gap-1">
                        <button onClick={() => { setEditingTx(t); setOpenAdd(true); }} className="text-muted-foreground hover:text-primary p-1"><Pencil className="size-3.5" /></button>
                        <button onClick={() => delTx(t.id)} className="text-muted-foreground hover:text-danger p-1"><Trash2 className="size-3.5" /></button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button onClick={() => { setEditingTx(null); setOpenAdd(true); }}
        className="fixed bottom-20 left-4 z-20 size-14 rounded-full bg-gradient-primary text-primary-foreground shadow-glow flex items-center justify-center hover:scale-105 active:scale-95 transition-transform">
        <Plus className="size-6" />
      </button>

      <AddTransactionDialog
        open={openAdd}
        onOpenChange={(v) => { setOpenAdd(v); if (!v) setEditingTx(null); }}
        people={people}
        currencies={currencies}
        onSuccess={load}
        defaultPersonId={id}
        editing={editingTx}
      />

      <Dialog open={editName} onOpenChange={setEditName}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-right">تعديل البيانات</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="الاسم" maxLength={80} />
            <Input value={draftPhone} onChange={(e) => setDraftPhone(e.target.value)} placeholder="رقم الجوال (اختياري)" dir="ltr" maxLength={30} />
            <Button onClick={saveName} className="w-full bg-gradient-primary text-primary-foreground">حفظ</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
