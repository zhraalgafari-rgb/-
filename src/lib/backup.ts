import { supabase } from "@/integrations/supabase/client";

export interface BackupSnapshot {
  version: number;
  exportedAt: string;
  user_id: string;
  people: unknown[]; transactions: unknown[]; expenses: unknown[];
  currencies: unknown[]; categories: unknown[];
  budgets: unknown[]; reminders: unknown[]; recurring: unknown[];
}

export async function buildSnapshot(userId: string): Promise<BackupSnapshot> {
  const [people, txs, expenses, currencies, categories, budgets, reminders, recurring] = await Promise.all([
    supabase.from("people").select("*"),
    supabase.from("transactions").select("*"),
    supabase.from("expenses").select("*"),
    supabase.from("currencies").select("*"),
    supabase.from("expense_categories").select("*"),
    supabase.from("budgets").select("*"),
    supabase.from("reminders").select("*"),
    supabase.from("recurring_rules").select("*"),
  ]);
  return {
    version: 1, exportedAt: new Date().toISOString(), user_id: userId,
    people: people.data ?? [], transactions: txs.data ?? [], expenses: expenses.data ?? [],
    currencies: currencies.data ?? [], categories: categories.data ?? [],
    budgets: budgets.data ?? [], reminders: reminders.data ?? [], recurring: recurring.data ?? [],
  };
}

export async function uploadBackup(userId: string, kind: "manual" | "auto"): Promise<{ path: string; size: number } | null> {
  const snap = await buildSnapshot(userId);
  const json = JSON.stringify(snap);
  const blob = new Blob([json], { type: "application/json" });
  const path = `${userId}/${kind}-${Date.now()}.json`;
  const { error } = await supabase.storage.from("backups").upload(path, blob, { contentType: "application/json", upsert: false });
  if (error) return null;
  await supabase.from("backup_meta").insert({ user_id: userId, path, size_bytes: blob.size, kind });
  
  const { data: list } = await supabase.from("backup_meta").select("id, path").eq("user_id", userId).order("created_at", { ascending: false });
  if (list && list.length > 10) {
    const old = list.slice(10);
    await supabase.storage.from("backups").remove(old.map((x) => x.path));
    await supabase.from("backup_meta").delete().in("id", old.map((x) => x.id));
  }
  return { path, size: blob.size };
}

export async function downloadBackup(path: string): Promise<BackupSnapshot | null> {
  const { data, error } = await supabase.storage.from("backups").download(path);
  if (error || !data) return null;
  return JSON.parse(await data.text()) as BackupSnapshot;
}

export async function restoreFromSnapshot(userId: string, snap: BackupSnapshot, mode: "merge" | "replace"): Promise<number> {
  if (mode === "replace") {
    const tables = ["transactions", "expenses", "reminders", "recurring_rules", "budgets", "people"];
    for (const t of tables) await (supabase.from(t as never) as never as { delete: () => { eq: (k: string, v: string) => Promise<unknown> } }).delete().eq("user_id", userId);
  }
  const map: Array<[string, unknown[]]> = [
    ["people", snap.people], ["currencies", snap.currencies], ["expense_categories", snap.categories],
    ["transactions", snap.transactions], ["expenses", snap.expenses],
    ["budgets", snap.budgets], ["reminders", snap.reminders], ["recurring_rules", snap.recurring],
  ];
  let total = 0;
  for (const [table, rows] of map) {
    if (!Array.isArray(rows) || !rows.length) continue;
    const cleaned = rows.map((r) => { const { id: _id, ...rest } = r as Record<string, unknown>; return { ...rest, user_id: userId }; });
    const { error } = await (supabase.from(table as never) as never as { insert: (rows: unknown[]) => Promise<{ error: unknown }> }).insert(cleaned);
    if (!error) total += cleaned.length;
  }
  return total;
}

export async function listBackups(userId: string) {
  const { data } = await supabase.from("backup_meta").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  return data ?? [];
}

export async function deleteBackup(id: string, path: string) {
  await supabase.storage.from("backups").remove([path]);
  await supabase.from("backup_meta").delete().eq("id", id);
}

const FREQ_KEY = "daftarak.backup.lastAuto";
export async function maybeRunAutoBackup(userId: string, frequency: "off" | "daily" | "weekly" | "monthly") {
  if (frequency === "off") return;
  const last = Number(localStorage.getItem(FREQ_KEY) ?? 0);
  const ms = Date.now() - last;
  const day = 24 * 60 * 60 * 1000;
  const need = frequency === "daily" ? day : frequency === "weekly" ? 7 * day : 30 * day;
  if (ms < need) return;
  const r = await uploadBackup(userId, "auto");
  if (r) localStorage.setItem(FREQ_KEY, String(Date.now()));
}
