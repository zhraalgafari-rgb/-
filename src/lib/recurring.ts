import { supabase } from "@/integrations/supabase/client";

interface Rule {
  id: string;
  user_id: string;
  kind: "expense" | "transaction";
  amount: number;
  currency_id: string;
  note: string | null;
  category_id: string | null;
  person_id: string | null;
  direction: string | null;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  next_run: string;
  is_active: boolean;
  title: string;
}

function advance(d: Date, freq: Rule["frequency"]): Date {
  const n = new Date(d);
  if (freq === "daily") n.setDate(n.getDate() + 1);
  else if (freq === "weekly") n.setDate(n.getDate() + 7);
  else if (freq === "monthly") n.setMonth(n.getMonth() + 1);
  else if (freq === "yearly") n.setFullYear(n.getFullYear() + 1);
  return n;
}

/** Process all due recurring rules for the current user. Returns count of generated entries. */
export async function processDueRecurring(userId: string): Promise<number> {
  const now = new Date();
  const { data: rules } = await supabase
    .from("recurring_rules")
    .select("*")
    .eq("is_active", true)
    .lte("next_run", now.toISOString());

  if (!rules || rules.length === 0) return 0;
  let count = 0;

  for (const r of rules as unknown as Rule[]) {
    let next = new Date(r.next_run);
    // Generate as many missed entries as needed (cap 24 to avoid runaways)
    let safety = 0;
    while (next <= now && safety < 24) {
      if (r.kind === "expense") {
        await supabase.from("expenses").insert({
          user_id: userId,
          amount: r.amount,
          currency_id: r.currency_id,
          category_id: r.category_id,
          note: r.note ?? r.title,
          expense_date: next.toISOString(),
        });
      } else if (r.kind === "transaction" && r.person_id && r.direction) {
        await supabase.from("transactions").insert({
          user_id: userId,
          person_id: r.person_id,
          amount: r.amount,
          currency_id: r.currency_id,
          direction: r.direction,
          details: r.note ?? r.title,
          transaction_date: next.toISOString(),
        });
      }
      count++;
      next = advance(next, r.frequency);
      safety++;
    }
    await supabase.from("recurring_rules").update({
      next_run: next.toISOString(),
      last_run: now.toISOString(),
    }).eq("id", r.id);
  }
  return count;
}
