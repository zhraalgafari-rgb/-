import { useEffect, useState, ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingFlow } from "@/components/OnboardingFlow";

/** Shows onboarding flow once per user (until profile.onboarded = true). */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [needs, setNeeds] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading || !user) { setNeeds(false); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("onboarded")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setNeeds(!data?.onboarded);
    })();
    return () => { cancelled = true; };
  }, [user, loading]);

  if (needs === null) return null;
  if (needs) return <OnboardingFlow onDone={() => setNeeds(false)} />;
  return <>{children}</>;
}
