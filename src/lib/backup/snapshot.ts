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
