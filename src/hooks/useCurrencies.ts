import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Currency {
  id: string;
  name: string;
  symbol: string;
  rate: number;
  is_base: boolean;
}

export function useCurrencies() {
  return useQuery<Currency[]>({
    queryKey: ["currencies"],
    queryFn: async () => {
      const { data } = await supabase.from("currencies").select("*").order("is_base", { ascending: false });
      return (data ?? []) as Currency[];
    },
  });
}
