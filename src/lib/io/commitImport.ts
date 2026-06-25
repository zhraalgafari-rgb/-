import { supabase } from "@/integrations/supabase/client";
import type { MappedTx } from "./importExcel";

export async function commitImportedTxs(userId: string, baseCurrencyId: string, rows: MappedTx[]): Promise<{ inserted: number; failed: number }> {
  // Build / fetch person map
  const { data: existing } = await supabase.from("people").select("id,name").eq("user_id", userId);
  const map = new Map<string, string>(((existing as { id: string; name: string }[]) ?? []).map((p) => [p.name.trim().toLowerCase(), p.id]));

  const newNames = Array.from(new Set(rows.map((r) => r.name.trim()).filter((n) => !map.has(n.toLowerCase()))));
  if (newNames.length) {
    const { data: inserted } = await supabase.from("people").insert(newNames.map((name) => ({ name, user_id: userId }))).select("id,name");
    for (const p of (inserted as { id: string; name: string }[] | null) ?? []) {
      map.set(p.name.trim().toLowerCase(), p.id);
    }
  }

  const payload = rows.map((r) => ({
    user_id: userId,
    person_id: map.get(r.name.trim().toLowerCase())!,
    currency_id: baseCurrencyId,
    amount: r.amount,
    direction: r.direction,
    details: r.details,
    transaction_date: r.date,
  }));

  let inserted = 0;
  let failed = 0;
  // Chunk in 200s
  for (let i = 0; i < payload.length; i += 200) {
    const chunk = payload.slice(i, i + 200);
    const { error } = await supabase.from("transactions").insert(chunk);
    if (error) failed += chunk.length;
    else inserted += chunk.length;
  }
  return { inserted, failed };
}
