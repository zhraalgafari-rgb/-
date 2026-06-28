import { supabase } from "@/integrations/supabase/client";

export interface ExchangeRateRow {
  id: string;
  currency_id: string;
  rate_to_base: number;
  effective_date: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

/** Latest rate for each currency (current). */
export async function fetchLatestRates(userId: string) {
  const { data, error } = await supabase
    .from("exchange_rates")
    .select("*")
    .eq("user_id", userId)
    .order("effective_date", { ascending: false })
    .limit(500);
  if (error) throw error;
  const seen = new Set<string>();
  const out: ExchangeRateRow[] = [];
  for (const r of (data ?? []) as ExchangeRateRow[]) {
    if (seen.has(r.currency_id)) continue;
    seen.add(r.currency_id);
    out.push(r);
  }
  return out;
}

/** Find the historical rate for a currency that was active on a given date. */
export function rateOnDate(
  history: ExchangeRateRow[],
  currencyId: string,
  isoDate: string,
  fallback: number,
): number {
  const d = new Date(isoDate).getTime();
  const candidates = history
    .filter((r) => r.currency_id === currencyId && new Date(r.effective_date).getTime() <= d)
    .sort((a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime());
  return candidates[0]?.rate_to_base ?? fallback;
}

export async function saveExchangeRate(
  userId: string,
  currencyId: string,
  rate: number,
  effectiveDate: string,
  note?: string,
) {
  const { error } = await supabase.from("exchange_rates").insert({
    user_id: userId,
    currency_id: currencyId,
    rate_to_base: rate,
    effective_date: effectiveDate,
    note: note ?? null,
    created_by: userId,
  });
  if (error) throw error;
  // Also update the live `currencies.rate` so legacy code keeps working.
  await supabase.from("currencies").update({ rate }).eq("id", currencyId);
}
