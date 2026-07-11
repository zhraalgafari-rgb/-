import { useEffect, useState, ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { OnboardingFlow } from "@/components/OnboardingFlow";

const profileCache = new Map<string, { pin_hash: string | null; onboarded: boolean | null }>();

export function setProfileCache(userId: string, data: { pin_hash?: string | null; onboarded?: boolean | null }) {
  if (!profileCache.has(userId)) {
    profileCache.set(userId, { pin_hash: null, onboarded: null });
  }
  const existing = profileCache.get(userId)!;
  if (data.pin_hash !== undefined) existing.pin_hash = data.pin_hash;
  if (data.onboarded !== undefined) existing.onboarded = data.onboarded;
}

export function getCachedOnboarding(userId: string): boolean | null {
  const cached = profileCache.get(userId);
  if (!cached) return null;
  return cached.onboarded;
}

export function OnboardingGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [needs, setNeeds] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading || !user) { setNeeds(false); return; }
    const cached = getCachedOnboarding(user.id);
    if (cached !== null) {
      setNeeds(!cached);
      return;
    }
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;
    const waitForCache = () => {
      timeout = setTimeout(() => {
        if (cancelled) return;
        const updated = getCachedOnboarding(user.id);
        if (updated !== null) {
          setNeeds(!updated);
        } else {
          waitForCache();
        }
      }, 50);
    };
    waitForCache();
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [user, loading]);

  if (needs === null) return null;
  if (needs) return <OnboardingFlow onDone={() => setNeeds(false)} />;
  return <>{children}</>;
}
