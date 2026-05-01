import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Sparkles, ArrowRight, TrendingUp, TrendingDown, AlertCircle, Trophy, Calendar, Target } from "lucide-react";
import { fmtMoney, fmtMonthAr, monthRange } from "@/lib/format";
import { CardSkeleton } from "@/components/Skeleton";

export const Route = createFileRoute("/app/insights")({ component: InsightsPage });

interface Cur { id: string; name: string; rate: number; is_base: boolean }
interface Cat { id: string; name: string; color: string }
interface Exp { amount: number; category_id: string | null; currency_id: string; expense_date: string }
interface Bud { amount: number; currency_id: string }

function InsightsPage() {
  const { user } = useAuth();
  const [curs, setCurs] = useState<Cur[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [thisMonth, setThisMonth] = useState<Exp[]>([]);
  const [lastMonth, setLastMonth] = useState<Exp[]>([]);
  const [budgets, setBudgets] = useState<Bud[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const now = new Date();
      const cur = monthRange(now);
      const prev = monthRange(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      const [{ data: c }, { data: ca }, { data: t }, { data: l }, { data: b }] = await Promise.all([
        supabase.from("currencies").select("*").order("is_base", { ascending: false }),
        supabase.from("expense_categories").select("id,name,color"),
        supabase.from("expenses").select("amount,category_id,currency_id,expense_date").gte("expense_date", cur.start.toISOString()).lt("expense_date", cur.end.toISOString()),
        supabase.from("expenses").select("amount,category_id,currency_id,expense_date").gte("expense_date", prev.start.toISOString()).lt("expense_date", prev.end.toISOString()),
        supabase.from("budgets").select("amount,currency_id"),
      ]);
      setCurs((c ?? []) as Cur[]);
      setCats((ca ?? []) as Cat[]);
      setThisMonth((t ?? []) as Exp[]);
      setLastMonth((l ?? []) as Exp[]);
      setBudgets((b ?? []) as Bud[]);
      setLoading(false);
    })();
  }, [user]);

  const base = curs.find((c) => c.is_base) ?? curs[0];
  const toBase = (a: number, cid: string) => Number(a) * (curs.find((c) => c.id === cid)?.rate ?? 1);

  const stats = useMemo(() => {
    const tot = thisMonth.reduce((s, e) => s + toBase(e.amount, e.currency_id), 0);
    const totLast = lastMonth.reduce((s, e) => s + toBase(e.amount, e.currency_id), 0);
    const day = new Date().getDate();
    const avgDaily = day > 0 ? tot / day : 0;
    const projected = avgDaily * new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const change = totLast > 0 ? ((tot - totLast) / totLast) * 100 : 0;

    // Top category
    const byCat = new Map<string, number>();
    for (const e of thisMonth) {
      const k = e.category_id ?? "_";
      byCat.set(k, (byCat.get(k) ?? 0) + toBase(e.amount, e.currency_id));
    }
    const sorted = Array.from(byCat.entries()).sort((a, b) => b[1] - a[1]);
    const topCatId = sorted[0]?.[0];
    const topCat = cats.find((c) => c.id === topCatId);
    const topVal = sorted[0]?.[1] ?? 0;

    // Top day this month
    const byDay = new Map<number, number>();
    for (const e of thisMonth) {
      const d = new Date(e.expense_date).getDate();
      byDay.set(d, (byDay.get(d) ?? 0) + toBase(e.amount, e.currency_id));
    }
    const topDay = Array.from(byDay.entries()).sort((a, b) => b[1] - a[1])[0];

    const totalBudget = budgets.reduce((s, b) => s + toBase(b.amount, b.currency_id), 0);
    const budgetRemaining = totalBudget - tot;

    return { tot, totLast, change, avgDaily, projected, topCat, topVal, topDay, totalBudget, budgetRemaining };
  }, [thisMonth, lastMonth, cats, curs, budgets]);

  // Heatmap of days
  const days = useMemo(() => {
    const map = new Map<number, number>();
    let max = 0;
    for (const e of thisMonth) {
      const d = new Date(e.expense_date).getDate();
      const v = (map.get(d) ?? 0) + toBase(e.amount, e.currency_id);
      map.set(d, v);
      if (v > max) max = v;
    }
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    return { map, max, total: daysInMonth };
  }, [thisMonth, curs]);

  if (loading) {
    return (
      <div className="space-y-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <Link to="/app" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4" /> الرئيسية
      </Link>

      <div className="flex items-center gap-2">
        <div className="size-10 rounded-xl bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-glow">
          <Sparkles className="size-5" />
        </div>
        <div>
          <h1 className="font-bold text-lg leading-tight">رؤى ذكية</h1>
          <p className="text-xs text-muted-foreground">{fmtMonthAr(new Date())}</p>
        </div>
      </div>

      {/* Hero comparison */}
      <Card className="p-4">
        <div className="text-xs text-muted-foreground mb-1">إجمالي الإنفاق</div>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-3xl font-black tabular-nums">{fmtMoney(stats.tot)}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{base?.name}</div>
          </div>
          {stats.totLast > 0 && (
            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${stats.change > 0 ? "bg-danger-soft text-danger" : "bg-success-soft text-success"}`}>
              {stats.change > 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
              {Math.abs(Math.round(stats.change))}%
            </div>
          )}
        </div>
        <div className="mt-3 pt-3 border-t text-xs text-muted-foreground flex justify-between">
          <span>الشهر الماضي: <span className="tabular-nums font-semibold text-foreground">{fmtMoney(stats.totLast)}</span></span>
        </div>
      </Card>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-2">
        <KPI icon={Calendar} label="متوسط يومي" value={fmtMoney(stats.avgDaily)} sub={base?.name} />
        <KPI icon={TrendingUp} label="توقّع نهاية الشهر" value={fmtMoney(stats.projected)} sub={base?.name} />
        {stats.topCat && (
          <KPI icon={Trophy} label="الأعلى تصنيفاً" value={stats.topCat.name} sub={`${fmtMoney(stats.topVal)} ${base?.name}`} accent={stats.topCat.color} />
        )}
        {stats.topDay && (
          <KPI icon={AlertCircle} label="أكبر يوم إنفاق" value={`يوم ${stats.topDay[0]}`} sub={`${fmtMoney(stats.topDay[1])} ${base?.name}`} />
        )}
      </div>

      {/* Budget snapshot */}
      {stats.totalBudget > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target className="size-4 text-primary" />
            <h3 className="font-semibold text-sm">حالة الميزانية</h3>
          </div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">متبقّي</span>
            <span className={`font-bold tabular-nums ${stats.budgetRemaining < 0 ? "text-danger" : "text-success"}`}>
              {fmtMoney(stats.budgetRemaining)} {base?.name}
            </span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${stats.tot > stats.totalBudget ? "bg-danger" : "bg-gradient-primary"}`}
              style={{ width: `${Math.min(100, (stats.tot / stats.totalBudget) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground mt-1.5">
            <span>{fmtMoney(stats.tot)}</span>
            <span>{fmtMoney(stats.totalBudget)}</span>
          </div>
        </Card>
      )}

      {/* Heatmap */}
      {days.max > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-3">خريطة الإنفاق اليومي</h3>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: days.total }).map((_, i) => {
              const d = i + 1;
              const v = days.map.get(d) ?? 0;
              const intensity = days.max > 0 ? v / days.max : 0;
              return (
                <div
                  key={d}
                  title={v > 0 ? `يوم ${d}: ${fmtMoney(v)}` : `يوم ${d}: لا إنفاق`}
                  className="aspect-square rounded-md flex items-center justify-center text-[10px] font-medium border"
                  style={{
                    background: v > 0 ? `color-mix(in oklab, var(--primary) ${Math.round(intensity * 80) + 10}%, transparent)` : "transparent",
                    color: intensity > 0.5 ? "var(--primary-foreground)" : "var(--muted-foreground)",
                  }}
                >
                  {d}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

function KPI({ icon: Icon, label, value, sub, accent }: { icon: typeof Sparkles; label: string; value: string; sub?: string; accent?: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
        <Icon className="size-3.5" style={accent ? { color: accent } : undefined} />
        {label}
      </div>
      <div className="font-bold text-sm truncate">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground tabular-nums">{sub}</div>}
    </Card>
  );
}
