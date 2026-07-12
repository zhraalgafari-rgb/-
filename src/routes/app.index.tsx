import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Plus, UserPlus, Users, Sparkles, Loader2, LayoutGrid, Table as TableIcon } from "lucide-react";
import { AddTransactionDialog } from "@/components/AddTransactionDialog";
import { AiChatPanel } from "@/components/ai/AiChatPanel";
import { PersonFormDialog, type PersonEditing } from "@/components/PersonFormDialog";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ListSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { SearchBar } from "@/components/common/SearchBar";
import { FabButton } from "@/components/common/FabButton";
import { DebtsHeader } from "@/features/debts/DebtsHeader";
import { MultiCurrencyTotals } from "@/features/debts/MultiCurrencyTotals";
import { PersonRow } from "@/features/debts/PersonRow";
import { PersonTable } from "@/features/debts/PersonTable";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { toast } from "sonner";
import { useDashboardData, type Person } from "@/hooks/useDashboardData";
import { useDashboardFilter, type ViewMode } from "@/hooks/useDashboardFilter";

export const Route = createFileRoute("/app/")({ component: DebtsHome });

function DebtsHome() {
  const { user } = useAuth();
  const [openAdd, setOpenAdd] = useState(false);
  const [openAiChat, setOpenAiChat] = useState(false);
  const [openPerson, setOpenPerson] = useState(false);
  const [editingPerson, setEditingPerson] = useState<PersonEditing | null>(null);
  const [delPerson, setDelPerson] = useState<Person | null>(null);
  const [archivePerson, setArchivePerson] = useState<Person | null>(null);
  
  const [view, setView] = useState<ViewMode>(() => (typeof localStorage !== "undefined" && (localStorage.getItem("people_view") as ViewMode)) || "cards");
  useEffect(() => { try { localStorage.setItem("people_view", view); } catch { /* ignore */ } }, [view]);

  const { data, isLoading: loading, refetch } = useDashboardData(user?.id);
  const pullDist = usePullToRefresh(() => refetch());

  const people = data?.people ?? [];
  const personBalances = data?.personBalances ?? new Map();
  const rpcTotalsData = data?.rpcTotals ?? [];
  const currencies = data?.currencies ?? [];
  const baseCurrency = currencies.find((c) => c.is_base) ?? currencies[0];

  const {
    q, setQ,
    deferredQ,
    filter, setFilter,
    sort, setSort,
    filtered
  } = useDashboardFilter(people, personBalances);

  const [visibleCount, setVisibleCount] = useState(30);
  useEffect(() => {
    setVisibleCount(30);
  }, [deferredQ, filter, sort]);

  const totals = useMemo(() => {
    let owe = 0, owed = 0;
    for (const [, v] of personBalances) {
      if (v.net > 0) owed += v.net; else owe += -v.net;
    }
    return { owe, owed };
  }, [personBalances]);


  const visibleList = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const loadMoreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!loadMoreRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisibleCount((prev) => Math.min(prev + 30, filtered.length));
      }
    }, { rootMargin: "400px" });
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [filtered.length]);

  return (
    <div className="space-y-3 animate-in fade-in duration-300">
      {pullDist > 10 && (
        <div className="flex justify-center text-primary" style={{ height: Math.min(pullDist, 60) }}>
          <Loader2 className={`size-5 ${pullDist > 70 ? "animate-spin" : ""}`} style={{ transform: `rotate(${pullDist * 3}deg)` }} />
        </div>
      )}
      <DebtsHeader
        owed={totals.owed}
        owe={totals.owe}
        baseName={baseCurrency?.name ?? "محلي"}
        peopleCount={people.length}
        txCount={0}
        filter={filter}
        onFilterChange={setFilter}
      />

      <MultiCurrencyTotals rpcTotals={rpcTotalsData} currencies={currencies} />

      <div className="flex items-center gap-1.5">
        <div className="flex-1"><SearchBar value={q} onChange={setQ} placeholder="ابحث عن شخص..." /></div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="h-9 rounded-lg border bg-card px-2 text-[11px] font-semibold text-foreground"
          aria-label="فرز"
        >
          <option value="active">الأكثر نشاطاً</option>
          <option value="recent">الأحدث</option>
          <option value="name">أبجدي</option>
        </select>
        <div className="inline-flex h-9 rounded-lg border bg-card overflow-hidden" role="group" aria-label="طريقة العرض">
          <button
            onClick={() => setView("cards")}
            className={`px-2 flex items-center justify-center transition-colors ${view === "cards" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            aria-label="بطاقات"
            aria-pressed={view === "cards"}
          >
            <LayoutGrid className="size-3.5" />
          </button>
          <button
            onClick={() => setView("table")}
            className={`px-2 flex items-center justify-center transition-colors border-r ${view === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            aria-label="جدول"
            aria-pressed={view === "table"}
          >
            <TableIcon className="size-3.5" />
          </button>
        </div>
      </div>

      {filter !== "all" && (
        <div className="flex items-center justify-between text-xs px-1 animate-in slide-in-from-top-2 duration-200">
          <span className="text-muted-foreground">تصفية: {filter === "credit" ? "له فقط" : "عليه فقط"}</span>
          <button onClick={() => setFilter("all")} className="text-primary font-semibold">إلغاء التصفية</button>
        </div>
      )}

      {loading ? (
        <ListSkeleton rows={5} />
      ) : filtered.length === 0 ? (
        people.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title="ابدأ بإضافة أول معاملة"
            description="سجّل ما لك وما عليك بسهولة، وسنحتفظ لك بكل التفاصيل."
            action={
              <Button onClick={() => setOpenAdd(true)} size="lg" className="bg-gradient-primary text-primary-foreground shadow-glow">
                <Plus className="size-4" /> إضافة أول معاملة
              </Button>
            }
          />
        ) : (
          <EmptyState icon={Users} title="لا توجد نتائج" description="جرّب كلمة بحث أخرى أو ألغِ التصفية." variant="compact" />
        )
      ) : view === "table" ? (
        <PersonTable
          rows={visibleList.map((p) => ({
            person: p,
            balance: personBalances.get(p.id) ?? { net: 0, count: 0, lastDate: 0, totalCredit: 0, totalDebit: 0 },
          }))}
          onEdit={(p) => { const full = people.find((x) => x.id === p.id)!; setEditingPerson({ id: full.id, name: full.name, phone: full.phone, type: full.type, notes: full.notes ?? null, avatar_color: full.avatar_color, credit_limit: full.credit_limit ?? null }); setOpenPerson(true); }}
          onArchive={(p) => setArchivePerson(people.find((x) => x.id === p.id) ?? null)}
          onDelete={(p) => setDelPerson(people.find((x) => x.id === p.id) ?? null)}
        />
      ) : (
        <div className="space-y-2">
          {visibleList.map((p, i) => (
            <PersonRow
              key={p.id}
              person={p}
              balance={personBalances.get(p.id) ?? { net: 0, count: 0, lastDate: 0 }}
              onEdit={() => { setEditingPerson({ id: p.id, name: p.name, phone: p.phone, type: p.type, notes: p.notes ?? null, avatar_color: p.avatar_color, credit_limit: p.credit_limit ?? null }); setOpenPerson(true); }}
              onArchive={() => setArchivePerson(p)}
              onDelete={() => setDelPerson(p)}
            />
          ))}
        </div>
      )}

      {visibleList.length > 0 && visibleList.length < filtered.length && (
        <div ref={loadMoreRef} className="h-20 flex items-center justify-center text-muted-foreground pb-20">
          <Loader2 className="size-5 animate-spin" />
        </div>
      )}

      {/* AI Chat floating button */}
      <button
        onClick={() => setOpenAiChat(true)}
        aria-label="المساعد الذكي"
        className="fixed bottom-36 left-4 z-20 size-12 rounded-full shadow-glow flex items-center justify-center hover:scale-110 active:scale-95 transition-transform overflow-hidden"
        style={{ background: "linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)" }}
      >
        <Sparkles className="size-5 text-white" />
      </button>

      {/* Add new customer button */}
      <button
        onClick={() => { setEditingPerson(null); setOpenPerson(true); }}
        aria-label="إضافة عميل جديد"
        className="fixed bottom-52 left-4 z-20 size-11 rounded-full bg-card border-2 border-success text-success shadow-elevated flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
      >
        <UserPlus className="size-4" />
      </button>

      <FabButton onClick={() => { setOpenAdd(true); }} label="إضافة معاملة" />

      <AiChatPanel open={openAiChat} onClose={() => setOpenAiChat(false)} />

      <AddTransactionDialog
        open={openAdd}
        onOpenChange={setOpenAdd}
        people={people}
        currencies={currencies}
        onSuccess={() => refetch()}
      />


      <PersonFormDialog
        open={openPerson}
        onOpenChange={(v) => { setOpenPerson(v); if (!v) setEditingPerson(null); }}
        editing={editingPerson}
        onSuccess={() => refetch()}
      />

      <ConfirmDialog
        open={!!archivePerson}
        onOpenChange={(v) => !v && setArchivePerson(null)}
        title={`أرشفة ${archivePerson?.name ?? ""}؟`}
        description="يمكن استعادته لاحقاً من صفحة الأرشيف."
        confirmLabel="أرشفة"
        onConfirm={async () => {
          if (!archivePerson) return;
          const { error } = await supabase.from("people").update({ is_archived: true }).eq("id", archivePerson.id);
          if (error) { toast.error(error.message); return; }
          toast.success("تمت الأرشفة"); refetch();
        }}
      />

      <ConfirmDialog
        open={!!delPerson}
        onOpenChange={(v) => !v && setDelPerson(null)}
        title={`حذف ${delPerson?.name ?? ""} نهائياً؟`}
        description="لا يمكن الحذف إذا كانت لديه معاملات. استخدم الأرشفة بدلاً من ذلك."
        destructive
        confirmLabel="حذف"
        onConfirm={async () => {
          if (!delPerson) return;
          const { count } = await supabase.from("transactions").select("id", { count: "exact", head: true }).eq("person_id", delPerson.id);
          if ((count ?? 0) > 0) { toast.error("لا يمكن الحذف — لديه معاملات. استخدم الأرشفة."); return; }
          const { error } = await supabase.from("people").delete().eq("id", delPerson.id);
          if (error) { toast.error(error.message); return; }
          toast.success("تم الحذف"); refetch();
        }}
      />
    </div>
  );
}

