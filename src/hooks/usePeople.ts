import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface PersonLite {
  id: string;
  name: string;
  phone: string | null;
  credit_limit?: number | null;
  avatar_color?: string | null;
  type?: string;
  is_archived?: boolean;
  notes?: string | null;
}

export interface ActivePeopleResult {
  people: PersonLite[];
  count: number;
}

export function useActivePeople() {
  const { user } = useAuth();
  return useQuery<PersonLite[]>({
    queryKey: ["activePeople", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("people")
        .select("id,name,phone,credit_limit,avatar_color,type,notes")
        .eq("is_archived", false)
        .order("created_at", { ascending: false });
      return (data ?? []) as PersonLite[];
    },
    enabled: !!user,
  });
}

export function useAllPeople() {
  const { user } = useAuth();
  return useQuery<PersonLite[]>({
    queryKey: ["people", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("people")
        .select("id,name,phone,credit_limit,avatar_color,type,is_archived,notes")
        .order("name");
      return (data ?? []) as PersonLite[];
    },
    enabled: !!user,
  });
}
