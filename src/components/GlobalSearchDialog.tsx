import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";
import { User, Receipt, Wallet, Loader2, Search } from "lucide-react";
import { fmtMoney, fmtDate } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/useDebounce";

interface Person { id: string; name: string; phone: string | null }
interface Tx { id: string; person_id: string; amount: number; direction: string; details: string | null; transaction_date: string; people?: { name: string } | null }
interface Exp { id: string; amount: number; note: string | null; expense_date: string; category_id: string | null }

interface Props { open: boolean; onOpenChange: (v: boolean) => void }

function normalize(s: string) {
  return s.toLowerCase().replace(/[\u064B-\u065F\u0670]/g, "").replace(/[إأآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").trim();
}

export function GlobalSearchDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);

  useEffect(() => { if (!open) setQ(""); }, [open]);

  const nq = normalize(debouncedQ);

  const { data, isLoading } = useQuery({
    queryKey: ["globalSearch", nq, user?.id],
    queryFn: async () => {
      if (!nq) {
        // Fetch recent defaults
        const [{ data: p }, { data: t }, { data: e }] = await Promise.all([
          supabase.from("people").select("id,name,phone").eq("is_archived", false).order("created_at", { ascending: false }).limit(6),
          supabase.from("transactions").select("id,person_id,amount,direction,details,transaction_date,people(name)").order("transaction_date", { ascending: false }).limit(6),
          supabase.from("expenses").select("id,amount,note,expense_date,category_id").order("expense_date", { ascending: false }).limit(6),
        ]);
        return { people: (p as Person[]) || [], txs: (t as Tx[]) || [], exps: (e as Exp[]) || [] };
      }

      // We'll search by trying to match ilike on text fields
      // For amounts, if nq is numeric, we can also search amounts (though ilike on numbers is tricky, we can try casting or just skip if not a number, but Supabase standard postgrest doesn't let us easily OR across different types without a view/RPC).
      // Let's use simple .ilike for names/details.
      const searchPattern = `%${nq}%`;
      const isNumeric = !isNaN(Number(nq)) && nq.trim() !== "";
      const numFilter = isNumeric ? `amount.eq.${Number(nq)}` : null;

      const txFilter = numFilter ? `details.ilike.${searchPattern},${numFilter}` : `details.ilike.${searchPattern}`;
      const expFilter = numFilter ? `note.ilike.${searchPattern},${numFilter}` : `note.ilike.${searchPattern}`;

      const [{ data: p }, { data: t }, { data: e }] = await Promise.all([
        supabase.from("people").select("id,name,phone").eq("is_archived", false).or(`name.ilike.${searchPattern},phone.ilike.${searchPattern}`).limit(6),
        supabase.from("transactions").select("id,person_id,amount,direction,details,transaction_date,people!inner(name)").or(txFilter).limit(8),
        supabase.from("expenses").select("id,amount,note,expense_date,category_id").or(expFilter).limit(6),
      ]);

      return { people: (p as Person[]) || [], txs: (t as Tx[]) || [], exps: (e as Exp[]) || [] };
    },
    enabled: open && !!user,
  });

  const results = data || { people: [], txs: [], exps: [] };

  const goPerson = (id: string) => { onOpenChange(false); nav({ to: "/app/person/$id", params: { id } }); };
  const goTx = (t: Tx) => goPerson(t.person_id);
  const goExp = () => { onOpenChange(false); nav({ to: "/app/expenses" }); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden top-[10%] translate-y-0">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <Input
            autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث عن شخص، مبلغ، أو وصف..."
            className="border-0 shadow-none focus-visible:ring-0 px-0 h-8 text-sm"
          />
          {isLoading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-3">
          {results.people.length > 0 && (
            <Section title="الأشخاص" icon={User}>
              {results.people.map((p) => (
                <Row key={p.id} onClick={() => goPerson(p.id)} icon={<User className="size-3.5" />} title={p.name} subtitle={p.phone ?? undefined} />
              ))}
            </Section>
          )}

          {results.txs.length > 0 && (
            <Section title="المعاملات" icon={Wallet}>
              {results.txs.map((t) => {
                const pName = t.people?.name || "—";
                return (
                  <Row
                    key={t.id} onClick={() => goTx(t)}
                    icon={<Wallet className={`size-3.5 ${t.direction === "credit" ? "text-emerald-600" : "text-rose-600"}`} />}
                    title={`${pName} — ${fmtMoney(Number(t.amount))}`}
                    subtitle={`${fmtDate(t.transaction_date)}${t.details ? " · " + t.details : ""}`}
                  />
                );
              })}
            </Section>
          )}

          {results.exps.length > 0 && (
            <Section title="المصاريف" icon={Receipt}>
              {results.exps.map((e) => (
                <Row key={e.id} onClick={goExp} icon={<Receipt className="size-3.5 text-amber-600" />}
                  title={`${fmtMoney(Number(e.amount))}${e.note ? " — " + e.note : ""}`}
                  subtitle={fmtDate(e.expense_date)} />
              ))}
            </Section>
          )}

          {!isLoading && nq && results.people.length + results.txs.length + results.exps.length === 0 && (
            <div className="text-center py-8 text-xs text-muted-foreground">لا توجد نتائج لـ "{q}"</div>
          )}
          {!nq && !isLoading && (
            <div className="px-2 pb-2 text-[11px] text-muted-foreground">ابدأ بالكتابة للبحث الفوري في كل بياناتك.</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof User; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 px-1.5 mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3" /> {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Row({ icon, title, subtitle, onClick }: { icon: React.ReactNode; title: string; subtitle?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-accent text-right transition-colors">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{title}</div>
        {subtitle && <div className="text-[10px] text-muted-foreground truncate">{subtitle}</div>}
      </div>
    </button>
  );
}
