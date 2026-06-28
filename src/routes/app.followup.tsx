import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { ListSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { fmtMoney } from "@/lib/format";
import { BellRing, MessageCircle, Sparkles, Phone, AlertTriangle, Clock, CheckCircle2, Loader2, Send } from "lucide-react";
import { generateReminderMessage } from "@/lib/ai.functions";
import { ensureNotificationPermission, notify } from "@/lib/push";
import { toast } from "sonner";

export const Route = createFileRoute("/app/followup")({ component: FollowupPage });

interface Tx {
  id: string;
  person_id: string;
  amount: number;
  direction: "credit" | "debit";
  currency_code: string;
  due_date: string | null;
  is_paid: boolean;
  occurred_at: string;
  details: string | null;
}
interface Person { id: string; name: string; phone: string | null; credit_limit: number | null }

interface Bucket {
  person: Person;
  net: number;
  currency: string;
  daysOverdue: number;
  oldestDue: string | null;
  txCount: number;
  severity: "ok" | "soon" | "late" | "critical";
}

function severityFor(days: number, amount: number, limit: number | null): Bucket["severity"] {
  if (days >= 30 || (limit && amount > limit * 1.2)) return "critical";
  if (days >= 7) return "late";
  if (days >= 0) return "soon";
  return "ok";
}

const severityMeta: Record<Bucket["severity"], { label: string; cls: string; ring: string }> = {
  ok: { label: "ضمن المهلة", cls: "bg-success-soft text-success", ring: "ring-success/30" },
  soon: { label: "قريباً", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", ring: "ring-amber-400/40" },
  late: { label: "متأخر", cls: "bg-danger-soft text-danger", ring: "ring-danger/30" },
  critical: { label: "حرج", cls: "bg-danger text-danger-foreground", ring: "ring-danger/50" },
};

function FollowupPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [tab, setTab] = useState<"all" | "critical" | "late" | "soon">("all");
  const [draftFor, setDraftFor] = useState<Bucket | null>(null);
  const [draftText, setDraftText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: tx }, { data: pp }] = await Promise.all([
      supabase.from("transactions").select("id,person_id,amount,direction,currency_code,due_date,is_paid,occurred_at,details").eq("is_paid", false),
      supabase.from("people").select("id,name,phone,credit_limit").eq("is_archived", false),
    ]);
    const peopleMap = new Map<string, Person>();
    (pp ?? []).forEach((p) => peopleMap.set(p.id, p as Person));

    const grouped = new Map<string, { person: Person; net: number; currency: string; oldestDue: string | null; daysOverdue: number; count: number }>();
    const today = Date.now();
    (tx ?? []).forEach((t: any) => {
      const person = peopleMap.get(t.person_id);
      if (!person) return;
      const key = `${t.person_id}|${t.currency_code}`;
      const sign = t.direction === "credit" ? 1 : -1; // credit = he owes me
      const entry = grouped.get(key) ?? { person, net: 0, currency: t.currency_code, oldestDue: null, daysOverdue: -9999, count: 0 };
      entry.net += sign * Number(t.amount);
      entry.count += 1;
      if (t.due_date) {
        const d = new Date(t.due_date).getTime();
        const days = Math.floor((today - d) / 86400000);
        if (days > entry.daysOverdue) {
          entry.daysOverdue = days;
          entry.oldestDue = t.due_date;
        }
      }
      grouped.set(key, entry);
    });

    const list: Bucket[] = [];
    grouped.forEach((g) => {
      if (g.net <= 0) return; // only show debtors (people who owe the user)
      list.push({
        person: g.person,
        net: g.net,
        currency: g.currency,
        daysOverdue: g.daysOverdue,
        oldestDue: g.oldestDue,
        txCount: g.count,
        severity: severityFor(g.daysOverdue, g.net, g.person.credit_limit),
      });
    });
    list.sort((a, b) => {
      const order = { critical: 0, late: 1, soon: 2, ok: 3 } as const;
      if (order[a.severity] !== order[b.severity]) return order[a.severity] - order[b.severity];
      return b.daysOverdue - a.daysOverdue;
    });
    setBuckets(list);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  // Local notification for critical/late buckets once per session
  useEffect(() => {
    if (loading || buckets.length === 0) return;
    const crit = buckets.filter((b) => b.severity === "critical" || b.severity === "late");
    if (crit.length === 0) return;
    const key = `followup-notified-${new Date().toDateString()}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    ensureNotificationPermission().then((ok) => {
      if (ok) notify("ديون متأخرة تستدعي المتابعة", `لديك ${crit.length} عميل متأخر — راجع صفحة المتابعة الذكية.`, "/app/followup", "followup-daily");
    });
  }, [loading, buckets]);

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
      // Fallback offline template
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

  function suggestions(b: Bucket): string[] {
    const out: string[] = [];
    if (b.severity === "critical") {
      out.push("اتصل مباشرة بالعميل وحدد موعداً نهائياً للسداد.");
      out.push("اقترح تقسيط المبلغ على دفعتين أو ثلاث.");
      out.push("ابدأ بإيقاف أي تعاملات جديدة حتى السداد.");
    } else if (b.severity === "late") {
      out.push("أرسل تذكيراً مهذباً عبر الواتساب الآن.");
      out.push("حدّد موعد سداد جديد ودوّنه كتذكير.");
    } else if (b.severity === "soon") {
      out.push("أرسل تذكيراً ودياً قبل موعد الاستحقاق.");
    }
    if (b.person.credit_limit && b.net > b.person.credit_limit) {
      out.push("تجاوز الحد الائتماني — يفضل تقليل التعامل الآجل.");
    }
    return out;
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

      {loading ? (
        <ListSkeleton rows={4} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="لا يوجد ما يستوجب المتابعة" description="جميع العملاء ضمن الحدود الآمنة. أحسنت!" />
      ) : (
        <div className="space-y-2">
          {filtered.map((b) => {
            const meta = severityMeta[b.severity];
            return (
              <div key={`${b.person.id}-${b.currency}`} className={`rounded-lg border bg-card shadow-card p-2.5 space-y-2 ring-1 ${meta.ring}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${meta.cls}`}>{meta.label}</span>
                    <Link to="/app/person/$id" params={{ id: b.person.id }} className="font-bold text-foreground hover:text-primary truncate">
                      {b.person.name}
                    </Link>
                  </div>
                  <div className="text-left">
                    <div className="text-[10px] text-muted-foreground">المستحق</div>
                    <div className="font-black tabular-nums text-danger text-sm">{fmtMoney(b.net)} <span className="text-[10px]">{b.currency}</span></div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-muted-foreground">
                  {b.person.phone && (
                    <span className="flex items-center gap-1" dir="ltr"><Phone className="size-3" />{b.person.phone}</span>
                  )}
                  {b.daysOverdue >= 0 && (
                    <span className="flex items-center gap-1"><Clock className="size-3" />{b.daysOverdue === 0 ? "يستحق اليوم" : `متأخر ${b.daysOverdue} يوم`}</span>
                  )}
                  <span>{b.txCount} معاملة</span>
                </div>
                {suggestions(b).length > 0 && (
                  <ul className="text-[10.5px] space-y-0.5 bg-secondary/40 rounded p-1.5 border border-border/60">
                    {suggestions(b).map((s, i) => (
                      <li key={i} className="flex gap-1.5"><span className="text-primary">•</span><span>{s}</span></li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] flex-1" onClick={() => genMessage(b, "polite")}>
                    <Sparkles className="size-3" /> رسالة ذكية
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 px-2 text-[11px] flex-1 bg-success text-success-foreground hover:bg-success/90"
                    onClick={() => {
                      const t = `السلام عليكم ${b.person.name}،\nتذكير ودي بمبلغ ${fmtMoney(b.net)} ${b.currency} المستحق.\nشكراً لتعاونكم.`;
                      openWhatsApp(b, t);
                    }}
                  >
                    <MessageCircle className="size-3" /> واتساب
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* AI draft modal */}
      {draftFor && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={() => setDraftFor(null)}>
          <div className="bg-card rounded-xl border shadow-elevated w-full max-w-md p-3 space-y-2.5 animate-in slide-in-from-bottom-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="font-bold text-sm flex items-center gap-1.5"><Sparkles className="size-4 text-primary" /> رسالة لـ {draftFor.person.name}</div>
              <button onClick={() => setDraftFor(null)} className="text-muted-foreground text-xs">✕</button>
            </div>
            <div className="flex gap-1">
              {(["polite", "friendly", "firm"] as const).map((t) => (
                <button key={t} onClick={() => genMessage(draftFor, t)} className="text-[10px] px-2 py-1 rounded border bg-secondary hover:bg-primary hover:text-primary-foreground transition">
                  {t === "polite" ? "مهذبة" : t === "friendly" ? "ودية" : "حازمة"}
                </button>
              ))}
            </div>
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              rows={7}
              dir="rtl"
              className="w-full text-[12px] p-2 rounded border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={aiLoading ? "جاري توليد الرسالة..." : "اكتب أو عدّل الرسالة..."}
            />
            {aiLoading && (
              <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground"><Loader2 className="size-3 animate-spin" /> جاري التوليد بالذكاء الاصطناعي...</div>
            )}
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" className="flex-1 h-8" onClick={() => { navigator.clipboard.writeText(draftText); toast.success("تم النسخ"); }}>
                نسخ
              </Button>
              <Button
                size="sm"
                className="flex-1 h-8 bg-success text-success-foreground hover:bg-success/90"
                disabled={!draftText.trim()}
                onClick={() => { openWhatsApp(draftFor, draftText); setDraftFor(null); }}
              >
                <Send className="size-3" /> إرسال واتساب
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
