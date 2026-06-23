import { supabase } from "@/integrations/supabase/client";

export interface PendingItem {
  id: string;
  kind: "reminder" | "overdue";
  title: string;
  due_date: string;
  person_id?: string | null;
}

/** Fetch unseen reminders + overdue debts (transactions older than 30 days unsettled). */
export async function fetchPending(userId: string): Promise<PendingItem[]> {
  const today = new Date(); today.setHours(23, 59, 59, 999);
  const { data: reminders } = await supabase.from("reminders")
    .select("id,title,due_date,person_id")
    .eq("is_done", false)
    .lte("due_date", today.toISOString())
    .order("due_date");

  const items: PendingItem[] = (reminders ?? []).map((r) => ({
    id: r.id, kind: "reminder" as const, title: r.title, due_date: r.due_date, person_id: r.person_id,
  }));
  return items;
  // Note: userId is implicitly enforced by RLS on the table.
}

export async function getLastSeen(userId: string): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("last_seen_reminder_at").eq("user_id", userId).maybeSingle();
  return data?.last_seen_reminder_at ?? null;
}

export async function markAllSeen(userId: string) {
  await supabase.from("profiles").update({ last_seen_reminder_at: new Date().toISOString() }).eq("user_id", userId);
}

export function showLocalNotification(title: string, body: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try { new Notification(title, { body, icon: "/favicon.ico" }); } catch { /* ignore */ }
}

const POLLED_KEY = "daftarak.notif.polledAt";
export async function pollAndNotify(userId: string) {
  const enabled = localStorage.getItem("daftarak.notif.enabled") === "1";
  if (!enabled) return;
  // Honour configured daily reminder time: only fire once per day, after the chosen hh:mm.
  const time = localStorage.getItem("daftarak.notif.time") ?? "09:00";
  const [hh, mm] = time.split(":").map((x) => Number(x) || 0);
  const now = new Date();
  const slot = new Date(now); slot.setHours(hh, mm, 0, 0);
  if (now < slot) return;
  const last = Number(localStorage.getItem(POLLED_KEY) ?? 0);
  // Skip if we already notified during this day's slot window.
  if (last && last >= slot.getTime()) return;
  const items = await fetchPending(userId);
  if (items.length > 0) showLocalNotification("دفترك", `لديك ${items.length} تذكيراً مستحقاً`);
  localStorage.setItem(POLLED_KEY, String(Date.now()));
}
