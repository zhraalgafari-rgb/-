import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCurrencies } from "@/hooks/useCurrencies";
import { fetchLatestRates, saveExchangeRate, type ExchangeRateRow } from "@/lib/money/rates";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, TrendingUp, History, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { fmtMoney } from "@/lib/format";

export const Route = createFileRoute("/app/exchange-rates")({ component: ExchangeRatesPage });

function ExchangeRatesPage() {
  const { user } = useAuth();
  const { currencies, base, refresh } = useCurrencies();
  const [latest, setLatest] = useState<ExchangeRateRow[]>([]);
  const [history, setHistory] = useState<ExchangeRateRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const l = await fetchLatestRates(user.id);
    setLatest(l);
    const { data } = await supabase
      .from("exchange_rates")
      .select("*")
      .eq("user_id", user.id)
      .order("effective_date", { ascending: false })
      .limit(50);
    setHistory((data ?? []) as ExchangeRateRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const latestMap = useMemo(() => {
    const m = new Map<string, ExchangeRateRow>();
    for (const r of latest) m.set(r.currency_id, r);
    return m;
  }, [latest]);

  const save = async (currencyId: string) => {
    if (!user) return;
    const v = parseFloat(drafts[currencyId] ?? "");
    if (!v || v <= 0) { toast.error("سعر غير صحيح"); return; }
    setBusy(currencyId);
    try {
      await saveExchangeRate(user.id, currencyId, v, new Date().toISOString().slice(0, 10), notes[currencyId]);
      toast.success("تم حفظ السعر");
      setDrafts((d) => ({ ...d, [currencyId]: "" }));
      setNotes((n) => ({ ...n, [currencyId]: "" }));
      await refresh();
      await load();
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err.message ?? "خطأ");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <Link to="/app/settings" className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
          <ArrowRight className="size-3.5" /> رجوع
        </Link>
        <div className="text-[11px] text-muted-foreground">
          الأساسية: <span className="font-bold text-primary">{base?.name ?? "—"}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="size-9 rounded-xl bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-glow">
          <TrendingUp className="size-4" />
        </div>
        <div>
          <h1 className="font-bold text-[15px] leading-tight">أسعار الصرف</h1>
          <p className="text-[10px] text-muted-foreground">تحديث يومي + سجل تاريخي</p>
        </div>
      </div>

      {loading ? (
        <div className="py-10 flex justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-2">
          {currencies.filter((c) => !c.is_base).map((c) => {
            const cur = latestMap.get(c.id);
            return (
              <Card key={c.id} className="p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-[13px]">{c.name} <span className="text-muted-foreground text-[11px]">{c.symbol}</span></div>
                    <div className="text-[10px] text-muted-foreground">
                      السعر الحالي: <span className="tabular-nums font-bold text-foreground">{cur?.rate_to_base ?? c.rate}</span>
                      {cur && <span className="ms-1">({new Date(cur.effective_date).toLocaleDateString("ar")})</span>}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5 items-end">
                  <div className="space-y-1">
                    <Label className="text-[10px]">السعر الجديد</Label>
                    <Input
                      type="number" inputMode="decimal" dir="ltr" className="h-8 text-[12px]"
                      value={drafts[c.id] ?? ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                      placeholder={String(c.rate)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">ملاحظة</Label>
                    <Input
                      className="h-8 text-[12px]"
                      value={notes[c.id] ?? ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [c.id]: e.target.value }))}
                      placeholder="مصدر السعر..."
                    />
                  </div>
                  <Button size="sm" onClick={() => save(c.id)} disabled={busy === c.id} className="h-8 bg-gradient-primary text-primary-foreground">
                    <Save className="size-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-1.5 px-1">
          <History className="size-3.5 text-muted-foreground" />
          <span className="text-[11px] font-bold text-muted-foreground">السجل التاريخي</span>
        </div>
        {history.length === 0 ? (
          <Card className="p-3 text-center text-[11px] text-muted-foreground">لا يوجد سجل بعد</Card>
        ) : (
          <div className="space-y-1.5">
            {history.map((h) => {
              const c = currencies.find((x) => x.id === h.currency_id);
              return (
                <Card key={h.id} className="p-2 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-[12px] font-bold">{c?.name ?? "—"}</div>
                    <div className="text-[10px] text-muted-foreground">{new Date(h.effective_date).toLocaleDateString("ar")} {h.note && `• ${h.note}`}</div>
                  </div>
                  <div className="text-[13px] font-black tabular-nums text-primary">{fmtMoney(h.rate_to_base)}</div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
