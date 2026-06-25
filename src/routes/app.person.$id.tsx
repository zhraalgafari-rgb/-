import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ArrowRight, Plus, Trash2, Pencil, Share2, MessageCircle, Archive, FileText, FileSpreadsheet } from "lucide-react";
import { ListSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtMoney, fmtDate, fmtMonthAr } from "@/lib/format";
import { toast } from "sonner";
import { AddTransactionDialog } from "@/components/AddTransactionDialog";
import { TransactionRow } from "@/features/debts/TransactionRow";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { exportPersonStatementPDF } from "@/lib/io/exportPdf";
import { exportPersonToExcel } from "@/lib/io/exportExcel";

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
  const [delTxId, setDelTxId] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelPerson, setConfirmDelPerson] = useState(false);

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
    setPeople((p ?? []) as { id: string; name: string }[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user, id]);

  const balance = useMemo(() => {
    let net = 0;
    for (const t of txs) {
      const cur = currencies.find((c) => c.id === t.currency_id);
      net += Number(t.amount) * (t.direction === "credit" ? 1 : -1) * (cur?.rate ?? 1);
    }
    return net;
  }, [txs, currencies]);

  // Build running balance by chronological order
  const running = useMemo(() => {
    const ordered = [...txs].sort(
      (a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime(),
    );
    const map: Record<string, number> = {};
    let acc = 0;
    for (const t of ordered) {
      const cur = currencies.find((c) => c.id === t.currency_id);
      acc += Number(t.amount) * (t.direction === "credit" ? 1 : -1) * (cur?.rate ?? 1);
      map[t.id] = acc;
    }
    return map;
  }, [txs, currencies]);

  // Group transactions by month for timeline view
  const grouped = useMemo(() => {
    const groups = new Map<string, Tx[]>();
    for (const t of txs) {
      const d = new Date(t.transaction_date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const arr = groups.get(key) ?? [];
      arr.push(t);
      groups.set(key, arr);
    }
    return Array.from(groups.entries()).map(([key, items]) => {
      const [y, m] = key.split("-").map(Number);
      return { key, label: fmtMonthAr(new Date(y, m, 1)), items };
    });
  }, [txs]);

  const delTx = async () => {
    if (!delTxId) return;
    const tx = txs.find((t) => t.id === delTxId);
    const { error } = await supabase.from("transactions").delete().eq("id", delTxId);
    if (error) { toast.error(error.message); return; }
    setDelTxId(null);
    toast.success("تم الحذف", {
      action: tx ? {
        label: "تراجع",
        onClick: async () => {
          const { id: _id, ...rest } = tx;
          await supabase.from("transactions").insert({ ...rest, user_id: user?.id ?? "" } as never);
          toast.success("تم الاسترجاع"); load();
        },
      } : undefined,
    });
    load();
  };

  const archivePerson = async () => {
    const { error } = await supabase.from("people").update({ is_archived: true }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تمت الأرشفة"); nav({ to: "/app" });
  };

  const delPerson = async () => {
    if (txs.length > 0) { toast.error("استخدم الأرشفة بدلاً من الحذف — لديه معاملات"); return; }
    const { error } = await supabase.from("people").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحذف"); nav({ to: "/app" });
  };

  const saveName = async () => {
    if (!draftName.trim()) { toast.error("الاسم مطلوب"); return; }
    const { error } = await supabase.from("people").update({
      name: draftName.trim(),
      phone: draftPhone.trim() || null,
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
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
      try { await navigator.share({ title: `كشف حساب ${name}`, text }); return; } catch { /* fallthrough */ }
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
    <div className="space-y-3 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <Link to="/app" className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
          <ArrowRight className="size-3.5" /> رجوع
        </Link>
        <div className="flex items-center gap-0.5">
          <button onClick={() => exportPersonStatementPDF({ personName: name, phone, txs, currencies, balance })} aria-label="PDF" className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-danger"><FileText className="size-3.5" /></button>
          <button onClick={() => exportPersonToExcel(id, name)} aria-label="Excel" className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-success"><FileSpreadsheet className="size-3.5" /></button>
          <button onClick={share} aria-label="مشاركة" className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-primary"><Share2 className="size-3.5" /></button>
          <button onClick={shareWhatsApp} aria-label="واتساب" className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-success"><MessageCircle className="size-3.5" /></button>
          <button onClick={() => setEditName(true)} aria-label="تعديل" className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-primary"><Pencil className="size-3.5" /></button>
          <button onClick={() => setConfirmArchive(true)} aria-label="أرشفة" className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-primary"><Archive className="size-3.5" /></button>
          <button onClick={() => setConfirmDelPerson(true)} aria-label="حذف" className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-danger"><Trash2 className="size-3.5" /></button>
        </div>
      </div>

      <div className={`rounded-xl p-3 shadow-elevated text-white ${isCredit ? "bg-gradient-success" : "bg-gradient-danger"}`}>
        <div className="text-[11px] opacity-90 mb-0.5">
          {name}
          {phone && <span className="ms-2 opacity-75" dir="ltr">{phone}</span>}
        </div>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] opacity-90">{isCredit ? "له عندك" : "عليه"}</div>
            <div className="text-2xl font-black mt-0.5 tabular-nums leading-tight">{fmtMoney(Math.abs(balance))}</div>
          </div>
          <div className="text-[10px] opacity-90">{txs.length} معاملة</div>
        </div>
      </div>

      {loading ? (
        <ListSkeleton rows={4} />
      ) : txs.length === 0 ? (
        <EmptyState icon={Plus} title="لا توجد معاملات بعد" description="أضف أول معاملة لهذا الشخص." variant="compact" />
      ) : (
        <div className="space-y-4">
          {grouped.map((g) => (
            <div key={g.key} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[11px] font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{g.label}</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              {g.items.map((t) => (
                <TransactionRow
                  key={t.id}
                  tx={t}
                  currency={currencies.find((c) => c.id === t.currency_id)}
                  runningBalance={running[t.id] ?? 0}
                  onEdit={() => { setEditingTx(t); setOpenAdd(true); }}
                  onDelete={() => setDelTxId(t.id)}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => { setEditingTx(null); setOpenAdd(true); }}
        aria-label="إضافة معاملة"
        className="fixed bottom-20 left-4 z-20 size-12 rounded-full bg-gradient-primary text-primary-foreground shadow-glow flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
      >
        <Plus className="size-5" />
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

      <ConfirmDialog
        open={!!delTxId}
        onOpenChange={(v) => !v && setDelTxId(null)}
        title="حذف المعاملة"
        description="لا يمكن التراجع عن هذا الإجراء."
        destructive confirmLabel="حذف"
        onConfirm={delTx}
      />

      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={`أرشفة ${name}؟`}
        description="يمكن استعادة الشخص من صفحة الأرشيف لاحقاً."
        confirmLabel="أرشفة"
        onConfirm={archivePerson}
      />

      <ConfirmDialog
        open={confirmDelPerson}
        onOpenChange={setConfirmDelPerson}
        title={`حذف ${name} نهائياً؟`}
        description="لا يمكن الحذف إذا كانت هناك معاملات. استخدم الأرشفة بدلاً من ذلك."
        destructive confirmLabel="حذف"
        onConfirm={delPerson}
      />
    </div>
  );
}
