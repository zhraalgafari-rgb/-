import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchPending } from "@/lib/notifications";

export function usePendingCount() {
  const { user } = useAuth();
  return useQuery<number>({
    queryKey: ["pendingCount", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const items = await fetchPending(user.id);
      return items.length;
    },
    enabled: !!user,
    staleTime: 1000 * 30,
    refetchInterval: 5 * 60 * 1000,
  });
}
