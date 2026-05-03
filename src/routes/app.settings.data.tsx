import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { SettingsRow } from "@/components/common/SettingsRow";
import { Database, Download, Upload, FileSpreadsheet, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/settings/data")({ component: DataPage });

function DataPage() {
  const { user } = useAuth();
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportJSON = async () => {
    if (!user) return;
    setBusy(true);
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
    const blob = new Blob([JSON.stringify({
      version: 1, exportedAt: new Date().toISOString(),
      people: people.data, transactions: txs.data, expenses: expenses.data,
      currencies: currencies.data, categories: categories.data,
      budgets: budgets.data, reminders: reminders.data, recurring: recurring.data,
    }, null, 2)], { type: "application/json" });
    download(blob, `daftarak-backup-${Date.now()}.json`);
    setBusy(false);
    toast.success("تم تنزيل النسخة الاحتياطية");
  };

  const exportCSV = async (kind: "transactions" | "expenses") => {
    if (!user) return;
    const { data } = await supabase.from(kind).select("*");
    if (!data || data.length === 0) return toast.info("لا توجد بيانات");
    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(","),
      ...data.map((r: any) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")),
    ].join("\n");
    download(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), `daftarak-${kind}-${Date.now()}.csv`);
    toast.success("تم التصدير");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.version) throw new Error("ملف غير صالح");
      // Best-effort import: re-stamp user_id
      const tables = ["people","currencies","categories","transactions","expenses","budgets","reminders","recurring"];
      let total = 0;
      for (const k of tables) {
        const rows = data[k];
        if (!Array.isArray(rows) || rows.length === 0) continue;
        const tableName = k === "categories" ? "expense_categories" : k === "recurring" ? "recurring_rules" : k;
        const cleaned = rows.map((r: any) => { const { id, ...rest } = r; return { ...rest, user_id: user.id }; });
        const { error } = await (supabase.from(tableName as any) as any).insert(cleaned);
        if (!error) total += cleaned.length;
      }
      toast.success(`تم استيراد ${total} عنصر`);
    } catch (err: any) {
      toast.error(err.message ?? "فشل الاستيراد");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const wipe = async () => {
    if (!user) return;
    setBusy(true);
    const tables = ["transactions", "expenses", "reminders", "recurring_rules", "budgets", "people"];
    for (const t of tables) {
      await (supabase.from(t as any) as any).delete().eq("user_id", user.id);
    }
    setBusy(false);
    toast.success("تم مسح البيانات");
  };

  return (
    <div className="space-y-4">
      <PageHeader icon={Database} title="البيانات والنسخ الاحتياطي" subtitle="تصدير، استيراد، ومسح" back="/app/settings" />

      <Card className="p-1.5">
        <SettingsRow icon={Download} label="نسخة احتياطية كاملة (JSON)" desc="جميع بياناتك في ملف واحد" tone="primary" onClick={exportJSON} />
        <SettingsRow icon={FileSpreadsheet} label="تصدير المعاملات (CSV)" desc="ديون فقط" tone="success" onClick={() => exportCSV("transactions")} />
        <SettingsRow icon={FileSpreadsheet} label="تصدير المصاريف (CSV)" desc="مصاريف فقط" tone="success" onClick={() => exportCSV("expenses")} />
        <SettingsRow icon={Upload} label="استيراد من نسخة احتياطية" desc="ملف JSON" tone="accent" onClick={() => fileRef.current?.click()} />
      </Card>

      <input ref={fileRef} type="file" accept="application/json" hidden onChange={handleImport} />

      <Card className="p-1.5">
        <SettingsRow icon={Trash2} label="مسح كل البيانات" desc="لا يمكن التراجع" onClick={() => setConfirmWipe(true)} danger />
      </Card>

      <ConfirmDialog
        open={confirmWipe}
        onOpenChange={setConfirmWipe}
        title="مسح كل البيانات؟"
        description="سيتم حذف جميع الأشخاص والمعاملات والمصاريف. هذا الإجراء لا يمكن التراجع عنه."
        confirmLabel={busy ? "جارٍ..." : "مسح كل شيء"}
        destructive
        onConfirm={wipe}
      />
    </div>
  );
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

void Button;
