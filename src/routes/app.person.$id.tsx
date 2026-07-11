import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ClipboardList, Paperclip, BarChart3 } from "lucide-react";
import { ListSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { AddTransactionDialog } from "@/components/AddTransactionDialog";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { exportPersonStatementPDF } from "@/lib/io/exportPdf";
import { exportPersonToExcel } from "@/lib/io/exportExcel";
import { PersonActionsBar } from "@/features/debts/person/PersonActionsBar";
import { PersonBalancesByCurrency } from "@/features/debts/person/PersonBalancesByCurrency";
import { PersonTimeline } from "@/features/debts/person/PersonTimeline";
import { AiReminderDialog } from "@/components/ai/AiReminderDialog";
import { CustomerHealthCard } from "@/components/CustomerHealthCard";
import { PersonAnalytics } from "@/features/debts/person/PersonAnalytics";
import { CustomerAttachments } from "@/features/attachments/CustomerAttachments";
import { PaymentDialog } from "@/features/debts/PaymentDialog";
import { buildShareText } from "@/lib/money/statements";
import { EditPersonDialog } from "@/features/debts/person/EditPersonDialog";
import { computeRunningByCurrency, computeBalancesByCurrency } from "@/lib/money/balances";
import { useCurrencies } from "@/hooks/useCurrencies";
import { useAllPeople } from "@/hooks/usePeople";

export const Route = createFileRoute("/app/person/$id")({ component: PersonPage });

interface Currency { id: string; name: string; symbol: string; rate: number; is_base: boolean }
interface Account { id: string; name: string; currency_id: string; is_default: boolean }
interface Tx { id: string; person_id: string; amount: number; direction: string; currency_id: string; transaction_date: string; details: string | null; due_date: string | null; is_paid: boolean; allocations?: { allocated_amount: number }[] }

function PersonPage() {
  const { id } = useParams({ from: "/app/person/$id" });
  const { user } = useAuth();
  const nav = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const [editName, setEditName] = useState(false);
  const [openAdd, setOpenAdd] = useState(false);
  const [editingTx, setEditingTx] = useState<Tx | null>(null);
  const [payingTx, setPayingTx] = useState<Tx | null>(null);
  const [delTxId, setDelTxId] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelPerson, setConfirmDelPerson] = useState(false);
  const [openAi, setOpenAi] = useState(false);
  const [tab, setTab] = useState<"timeline" | "attachments" | "insights">("timeline");

  const { data: person } = useQuery({
    queryKey: ["person", id],
    queryFn: async () => {
      const { data } = await supabase.from("people").select("name,phone").eq("id", id).maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const { data: txs = [], isLoading: loadingTx } = useQuery({
    queryKey: ["personTx", id],
    queryFn: async () => {
      const { data } = await (supabase.from("transactions") as any).select("*, allocations:payment_allocations!debt_tx_id(allocated_amount)").eq("person_id", id).order("transaction_date", { ascending: false });
      return (data ?? []) as Tx[];
    },
    enabled: !!id,
  });

  const { data: currencies = [] } = useCurrencies();
  const { data: allPeople = [] } = useAllPeople();

  const { data: openings = [] } = useQuery({
    queryKey: ["openings", id],
    queryFn: async () => {
      const { data } = await supabase.from("opening_balances").select("currency_id,amount,direction").eq("person_id", id);
      return (data ?? []) as any[];
    },
    enabled: !!id,
  });

  const { data: company = null } = useQuery({
    queryKey: ["companyProfile"],
    queryFn: async () => {
      const { data } = await supabase.from("company_profile").select("name,phone,address").maybeSingle();
      return data as { name: string | null; phone: string | null; address: string | null } | null;
    },
  });

  const { data: rpcBalances = [] } = useQuery({
    queryKey: ["personBalances", id],
    queryFn: async () => (await (supabase.rpc as any)("rpc_get_person_balances", { p_person_id: id })).data as any[],
    enabled: !!id,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("financial_accounts").select("*").order("is_default", { ascending: false });
      return (data ?? []) as Account[];
    },
  });

  const people = allPeople.map(p => ({ id: p.id, name: p.name }));

  useEffect(() => {
    if (person) {
      setName(person.name ?? "");
      setPhone(person.phone ?? null);
    }
  }, [person]);

  const loading = loadingTx;

  // Build per-currency balances from backend RPC (includes opening balances)
  const balancesByCurrency = useMemo(() => {
    if (rpcBalances.length === 0) {
      return computeBalancesByCurrency(txs, currencies, openings);
    }
    return rpcBalances
      .map((rb: any) => {
        const currency = currencies.find((c) => c.id === rb.currency_id);
        if (!currency) return null;
        return {
          currency,
          balance: Number(rb.net),
          txCount: Number(rb.tx_count),
          opening: Number(rb.opening_net),
          baseEquivalent: Number(rb.net) * (currency.rate || 1),
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => Number(b.currency.is_base) - Number(a.currency.is_base));
  }, [rpcBalances, currencies, txs, openings]) as any[];

  // Used by AI reminder dialog — pick base currency balance (or first available)
  const primaryBalance = (balancesByCurrency as any[]).find((b) => b.currency.is_base) ?? (balancesByCurrency as any[])[0];
  const balanceForActions = primaryBalance?.balance ?? 0;

  const running = useMemo(
    () => computeRunningByCurrency(txs, openings),
    [txs, openings],
  );

  const refetchPerson = () => {
    queryClient.invalidateQueries({ queryKey: ["person"] });
    queryClient.invalidateQueries({ queryKey: ["personTx"] });
    queryClient.invalidateQueries({ queryKey: ["openings"] });
    queryClient.invalidateQueries({ queryKey: ["personBalances"] });
  };

  const delTx = async () => {
    if (!delTxId) return;
    const tx = txs.find((t) => t.id === delTxId);
    const { error } = await supabase.from("transactions").delete().eq("id", delTxId);
    if (error) { toast.error(error.message); return; }
    setDelTxId(null);
    const { logAudit } = await import("@/lib/audit");
    await logAudit(user!.id, "delete", "transaction", delTxId, { person_id: id });
    toast.success("تم الحذف", {
      action: tx ? {
        label: "تراجع",
        onClick: async () => {
          const { id: _id, allocations: _alloc, ...rest } = tx as any;
          await supabase.from("transactions").insert({ ...rest } as never);
          toast.success("تم الاسترجاع"); refetchPerson();
        },
      } : undefined,
    });
    refetchPerson();
  };

  const archivePerson = async () => {
    const { error } = await supabase.from("people").update({ is_archived: true }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    const { logAudit } = await import("@/lib/audit");
    await logAudit(user!.id, "archive", "person", id, { name });
    toast.success("تمت الأرشفة"); nav({ to: "/app" });
  };

  const delPerson = async () => {
    if (txs.length > 0) { toast.error("استخدم الأرشفة بدلاً من الحذف — لديه معاملات"); return; }
    const { error } = await supabase.from("people").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    const { logAudit } = await import("@/lib/audit");
    await logAudit(user!.id, "delete", "person", id, { name });
    toast.success("تم الحذف"); nav({ to: "/app" });
  };

  const share = async () => {
    const text = buildShareText({ personName: name, company, txsCount: txs.length, balancesByCurrency });
    if (navigator.share) { try { await navigator.share({ title: `كشف حساب ${name}`, text }); return; } catch { /* ignore */ } }
    await navigator.clipboard.writeText(text);
    toast.success("تم نسخ الكشف للحافظة");
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(buildShareText({ personName: name, company, txsCount: txs.length, balancesByCurrency }));
    const p = phone ? phone.replace(/\D/g, "") : "";
    window.open(p ? `https://wa.me/${p}?text=${text}` : `https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-300">
      <PersonActionsBar
        onPdf={() => exportPersonStatementPDF({ personName: name, phone, txs, currencies, openings, balance: balanceForActions })}
        onExcel={() => exportPersonToExcel(id, name)}
        onShare={share}
        onWhatsApp={shareWhatsApp}
        onAiMessage={() => setOpenAi(true)}
        onEdit={() => setEditName(true)}
        onArchive={() => setConfirmArchive(true)}
        onDelete={() => setConfirmDelPerson(true)}
      />

      <PersonBalancesByCurrency name={name} phone={phone} balances={balancesByCurrency} totalTxCount={txs.length} txs={txs} />

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-secondary/60 p-1 ring-1 ring-border">
        {[
          { v: "timeline" as const,    label: "المعاملات",  icon: ClipboardList },
          { v: "attachments" as const, label: "المرفقات",   icon: Paperclip },
          { v: "insights" as const,    label: "تحليلات",    icon: BarChart3 },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.v;
          return (
            <button
              key={t.v}
              onClick={() => setTab(t.v)}
              className={`inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11.5px] font-semibold transition ${
                active ? "bg-card text-primary shadow-sm ring-1 ring-primary/30" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "timeline" && (
        loading ? (
          <ListSkeleton rows={4} />
        ) : txs.length === 0 ? (
          <EmptyState icon={Plus} title="لا توجد معاملات بعد" description="أضف أول معاملة لهذا الشخص." variant="compact" />
        ) : (
          <PersonTimeline
            txs={txs} currencies={currencies} running={running}
            onEdit={(t) => { setEditingTx(t); setOpenAdd(true); }}
            onDelete={(id) => setDelTxId(id)}
            onPay={(t) => setPayingTx(t)}
          />
        )
      )}

      {tab === "attachments" && (
        <CustomerAttachments personId={id} personPhone={phone} />
      )}

      {tab === "insights" && (
        <div className="space-y-3">
          <CustomerHealthCard personId={id} />
          <PersonAnalytics txs={txs} />
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
        people={people} currencies={currencies} accounts={accounts}
        onSuccess={refetchPerson} defaultPersonId={id} editing={editingTx}
      />

      <PaymentDialog
        open={!!payingTx}
        onOpenChange={(v) => !v && setPayingTx(null)}
        debtTx={payingTx}
        accounts={accounts}
        onSuccess={refetchPerson}
      />

      <AiReminderDialog
        open={openAi} onOpenChange={setOpenAi}
        personName={name}
        amount={Math.abs(balanceForActions)}
        currency={primaryBalance?.currency.name}
        phone={phone}
      />

      <EditPersonDialog
        open={editName}
        onOpenChange={setEditName}
        personId={id}
        initialName={name}
        initialPhone={phone}
        onSuccess={refetchPerson}
      />

      <ConfirmDialog open={!!delTxId} onOpenChange={(v) => !v && setDelTxId(null)} title="حذف المعاملة" description="لا يمكن التراجع عن هذا الإجراء." destructive confirmLabel="حذف" onConfirm={delTx} />
      <ConfirmDialog open={confirmArchive} onOpenChange={setConfirmArchive} title={`أرشفة ${name}؟`} description="يمكن استعادة الشخص من صفحة الأرشيف لاحقاً." confirmLabel="أرشفة" onConfirm={archivePerson} />
      <ConfirmDialog open={confirmDelPerson} onOpenChange={setConfirmDelPerson} title={`حذف ${name} نهائياً؟`} description="لا يمكن الحذف إذا كانت هناك معاملات. استخدم الأرشفة بدلاً من ذلك." destructive confirmLabel="حذف" onConfirm={delPerson} />
    </div>
  );
}

