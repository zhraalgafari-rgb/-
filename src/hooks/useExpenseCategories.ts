import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface ExpenseCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
}

export function useExpenseCategories() {
  const { user } = useAuth();
  return useQuery<ExpenseCategory[]>({
    queryKey: ["expenseCategories", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("expense_categories").select("*").order("sort_order");
      return (data ?? []) as ExpenseCategory[];
    },
    enabled: !!user,
  });
}
