import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePersonData(id: string) {
  const personQuery = useQuery({
    queryKey: ["person", id],
    queryFn: async () => {
      const { data } = await supabase.from("people").select("name,phone").eq("id", id).maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const txsQuery = useQuery({
    queryKey: ["personTx", id],
    queryFn: async () => {
      const { data } = await (supabase.from("transactions") as any).select("*, allocations:payment_allocations!debt_tx_id(allocated_amount)").eq("person_id", id).order("transaction_date", { ascending: false });
      return (data ?? []) as any[];
    },
    enabled: !!id,
  });

  const openingsQuery = useQuery({
    queryKey: ["openings", id],
    queryFn: async () => {
      const { data } = await supabase.from("opening_balances").select("currency_id,amount,direction").eq("person_id", id);
      return (data ?? []) as any[];
    },
    enabled: !!id,
  });

  const companyQuery = useQuery({
    queryKey: ["companyProfile"],
    queryFn: async () => {
      const { data } = await supabase.from("company_profile").select("name,phone,address").maybeSingle();
      return data as { name: string | null; phone: string | null; address: string | null } | null;
    },
  });

  const rpcBalancesQuery = useQuery({
    queryKey: ["personBalances", id],
    queryFn: async () => (await (supabase.rpc as any)("rpc_get_person_balances", { p_person_id: id })).data as any[],
    enabled: !!id,
  });

  const accountsQuery = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("financial_accounts").select("*").order("is_default", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  return {
    person: personQuery.data,
    txs: txsQuery.data ?? [],
    loadingTx: txsQuery.isLoading,
    openings: openingsQuery.data ?? [],
    company: companyQuery.data ?? null,
    rpcBalances: rpcBalancesQuery.data ?? [],
    accounts: accountsQuery.data ?? [],
  };
}
