import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { ListSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { fmtMoney } from "@/lib/format";
import { AlertTriangle, CheckCircle2, BellRing } from "lucide-react";
import { generateReminderMessage } from "@/lib/ai.functions";
import { ensureNotificationPermission, notify } from "@/lib/push";
import { toast } from "sonner";
import { Bucket, buildBuckets } from "@/lib/money/followup";
import { FollowupBucketCard } from "@/features/reminders/FollowupBucketCard";
import { FollowupDraftDialog } from "@/features/reminders/FollowupDraftDialog";
import { useActivePeople } from "@/hooks/usePeople";
import { useCurrencies } from "@/hooks/useCurrencies";

export const Route = createFileRoute("/app/followup")({ component: FollowupPage });

function FollowupPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"all" | "critical" | "late" | "soon">("all");
  const [draftFor, setDraftFor] = useState<Bucket | null>(null);
  const [draftText, setDraftText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const { data: people = [] } = useActivePeople();
  const { data: currencies = [] } = useCurrencies();

  const { data: buckets = [], isLoading } = useQuery({
    queryKey: ["followupBuckets", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const [{ data: tx }] = await Promise.all([
        supabase.from("transactions").select("id,person_id,amount,direction,currency_id,due_date,is_paid,transaction_date,details").eq("is_paid", false),
      ]);
      const currencyMap = new Map<string, any>((currencies ?? []).map((c: any) => [c.id, c]));
      const peopleMap = new Map<string, any>();
      (people).forEach((p) => peopleMap.set(p.id, p));
      const list = buildBuckets(tx ?? [], peopleMap, currencyMap);
      list.sort((a, b) => {
        const order = { critical: 0, late: 1, soon: 2, ok: 3 } as const;
        if (order[a.severity] !== order[b.severity]) return order[a.severity] - order[b.severity];
        return b.daysOverdue - a.daysOverdue;
      });
      return list;
    },
    enabled: !!user && currencies.length > 0 && people.length > 0,
  });

  // Local notification for critical/late buckets once per session
  useMemo(() => {
    if (isLoading || buckets.length === 0) return;
    const crit = buckets.filter((b) => b.severity === "critical" || b.severity === "late");
    if (crit.length === 0) return;
    const key = `followup-notified-${new Date().toDateString()}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    ensureNotificationPermission().then((ok) => {
      if (ok) notify("ديون متأخرة تستدعي المتابعة", `لديك ${crit.length} عميل متأخر — راجع صفحة المتابعة الذكية.`, "/app/followup", "followup-daily");
    });
  }, [isLoading, buckets]);

  const counts = useMemo(() => ({
    all: buckets.length,
    critical: buckets.filter((b) => b.severity === "critical").length,
    late: buckets.filter((b) => b.severity === "late").length,
    soon: buckets.filter((b) => b.severity === "soon").length,
  }), [buckets]);

  const filtered = tab === "all" ? buckets : buckets.filter((b) => b.severity === tab);

  const totalAtRisk = useMemo(() => {
    const map = new Map<string, number>();
    buckets.filter((b) => b.severity !== "ok").forEach((b) => map.set(b.currency, (map.get(b.currency) ?? 0) + b.net));
    return [...map.entries()];
  }, [buckets]);

  async function genMessage(b: Bucket, tone: "polite" | "firm" | "friendly" = "polite") {
    setDraftFor(b);
    setDraftText("");
    setAiLoading(true);
    try {
      const res = await generateReminderMessage({
        data: { person_name: b.person.name, amount: b.net, currency: b.currency, days_overdue: b.daysOverdue > 0 ? b.daysOverdue : undefined, tone },
      });
      setDraftText(res.message);
    } catch (e: any) {
      const dayPart = b.daysOverdue > 0 ? `\nتأخر السداد ${b.daysOverdue} يوم.` : "";
      setDraftText(`السلام عليكم ${b.person.name}،\nنود تذكيركم بمبلغ ${fmtMoney(b.net)} ${b.currency} المستحق علينا.${dayPart}\nنشكر تعاونكم — وفقكم الله.`);
      toast.message("استخدمنا قالب جاهز (الذكاء الاصطناعي غير متاح حالياً)");
    } finally {
      setAiLoading(false);
    }
  }

  function openWhatsApp(b: Bucket, text: string) {
    if (!b.person.phone) { toast.error("لا يوجد رقم هاتف لهذا العميل"); return; }
    const phone = b.person.phone.replace(/[^\d]/g, "");
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  }

  return (
    <div className="space-y-3">
      <PageHeader icon={BellRing} title="المتابعة الذكية" subtitle="تذكير وإدارة الديون المتأخرة بمساعدة الذكاء الاصطناعي" />

      {/* Summary chips */}
      <div className="grid grid-cols-4 gap-1.5">
        {(["all", "critical", "late", "soon"] as const).map((t) => {
          const active = tab === t;
          const meta: Record<string, { label: string; cls: string }> = {
            all: { label: "الكل", cls: "bg-primary text-primary-foreground" },
            critical: { label: "حرج", cls: "bg-danger text-danger-foreground" },
            late: { label: "متأخر", cls: "bg-danger-soft text-danger" },
            soon: { label: "قريب", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
          };
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg p-1.5 border text-[11px] font-bold flex flex-col items-center gap-0.5 transition ${active ? meta[t].cls + " border-transparent shadow-card" : "bg-card border-border text-foreground hover:bg-secondary"}`}
            >
              <span>{meta[t].label}</span>
              <span className="text-[10px] opacity-80 tabular-nums">{counts[t]}</span>
            </button>
          );
        })}
      </div>

      {totalAtRisk.length > 0 && (
        <div className="rounded-lg border border-danger/30 bg-danger-soft/40 p-2.5 flex items-start gap-2">
          <AlertTriangle className="size-4 text-danger shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed">
            <div className="font-bold text-danger mb-0.5">إجمالي المبالغ المعرضة للخطر:</div>
            <div className="flex flex-wrap gap-1.5">
              {totalAtRisk.map(([cur, amt]) => (
                <span key={cur} className="bg-card border rounded px-1.5 py-0.5 font-black tabular-nums text-danger">{fmtMoney(amt)} {cur}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="لا يوجد ما يستوجب المتابعة" description="جميع العملاء ضمن الحدود الآمنة. أحسنت!" />
      ) : (
        <div className="space-y-2">
          {filtered.map((b) => (
            <FollowupBucketCard 
              key={`${b.person.id}-${b.currency}`}
              bucket={b}
              onGenerateMessage={genMessage}
              onSendWhatsApp={openWhatsApp}
            />
          ))}
        </div>
      )}

      {/* AI draft modal */}
      <FollowupDraftDialog
        draftFor={draftFor}
        draftText={draftText}
        aiLoading={aiLoading}
        onClose={() => setDraftFor(null)}
        onDraftTextChange={setDraftText}
        onGenerateMessage={genMessage}
        onSendWhatsApp={openWhatsApp}
      />
    </div>
  );
}
