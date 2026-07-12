import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { processDueRecurring } from "@/lib/recurring";
import { type PersonBalance } from "@/features/debts/PersonRow";

export interface Currency {
  id: string;
  name: string;
  symbol: string;
  rate: number;
  is_base: boolean;
}

export interface Person {
  id: string;
  name: string;
  type: string;
  is_archived: boolean;
  avatar_color: string | null;
  phone: string | null;
  notes?: string | null;
  credit_limit?: number | null;
}

export function useDashboardData(userId?: string) {
  return useQuery({
    queryKey: ["dashboard", userId],
    queryFn: async () => {
      // Fire-and-forget background recurring process
      if (userId) processDueRecurring(userId).catch(console.error);

      const [{ data: p }, { data: dbBalances }, { data: c }] = await Promise.all([
        supabase.from("people").select("*").eq("is_archived", false).order("created_at", { ascending: false }),
        supabase.from("view_dashboard_person_balances" as any).select("*"),
        supabase.from("currencies").select("*").order("is_base", { ascending: false }),
      ]);

      // RPC may not exist in all environments — fail silently
      const rpcResult = await supabase.rpc("rpc_get_dashboard_totals" as any).then(r => r.data).catch(() => null);
      const rpcTotals = rpcResult ?? [];
      
      const map = new Map<string, PersonBalance>();
      if (dbBalances) {
        for (const row of dbBalances as any[]) {
          map.set(row.person_id, {
            net: row.net,
            count: row.tx_count,
            lastDate: new Date(row.last_date).getTime(),
            lastAmount: row.last_amount,
            lastDirection: row.last_direction,
            totalCredit: row.total_credit,
            totalDebit: row.total_debit,
          });
        }
      }

      return {
        people: (p ?? []) as Person[],
        personBalances: map,
        rpcTotals: rpcTotals as any[],
        currencies: (c ?? []) as Currency[],
      };
    },
    enabled: !!userId,
  });
}
