import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface Currency { id: string; name: string; symbol: string; rate: number; is_base: boolean }

let cached: Currency[] | null = null;
const subs = new Set<(c: Currency[]) => void>();

export function useCurrencies() {
  const { user } = useAuth();
  const [currencies, setCurrencies] = useState<Currency[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    if (!user) return;
    const sub = (c: Currency[]) => setCurrencies(c);
    subs.add(sub);
    if (!cached) {
      (async () => {
        const { data } = await supabase.from("currencies").select("*").order("is_base", { ascending: false });
        cached = (data ?? []) as Currency[];
        subs.forEach((s) => s(cached!));
        setLoading(false);
      })();
    }
    return () => { subs.delete(sub); };
  }, [user]);

  const refresh = async () => {
    const { data } = await supabase.from("currencies").select("*").order("is_base", { ascending: false });
    cached = (data ?? []) as Currency[];
    subs.forEach((s) => s(cached!));
  };

  const base = currencies.find((c) => c.is_base) ?? currencies[0];

  return { currencies, base, loading, refresh };
}

/** Convert amount from currency to base via rate. */
export function toBase(currencies: Currency[], amount: number, currencyId: string) {
  const cur = currencies.find((c) => c.id === currencyId);
  return Number(amount) * (cur?.rate ?? 1);
}
