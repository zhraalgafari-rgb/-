import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { SettingsRow } from "@/components/common/SettingsRow";
import { SettingsGroup } from "@/components/common/SettingsGroup";
import { Database, Download, Upload, FileSpreadsheet, Trash2, Cloud, RefreshCw, History } from "lucide-react";
import { toast } from "sonner";
import {
  buildSnapshot, uploadBackup, listBackups, downloadBackup, deleteBackup, restoreFromSnapshot,
} from "@/lib/backup";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/app/settings/data")({ component: DataPage });

interface Backup { id: string; path: string; size_bytes: number; kind: string; created_at: string }

function DataPage() {
  const { user } = useAuth();
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [frequency, setFrequency] = useState<"off" | "daily" | "weekly" | "monthly">("off");
  const fileRef = useRef<HTMLInputElement>(null);

  const loadBackups = async () => {
    if (!user) return;
    setBackups((await listBackups(user.id)) as Backup[]);
  };

  useEffect(() => {
    if (!user) return;
    loadBackups();
    supabase.from("profiles").select("backup_frequency").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setFrequency((data?.backup_frequency ?? "off") as typeof frequency));
  }, [user]);

  const exportJSON = async () => {
    if (!user) return;
    setBusy(true);
    const snap = await buildSnapshot(user.id);
    download(new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" }), `daftarak-backup-${Date.now()}.json`);
    setBusy(false);
    toast.success("تم تنزيل النسخة");
  };

  const exportCSV = async (kind: "transactions" | "expenses") => {
    const { data } = await supabase.from(kind).select("*");
    if (!data?.length) { toast.info("لا توجد بيانات"); return; }
    const headers = Object.keys(data[0]);
    const csv = [headers.join(","), ...data.map((r: Record<string, unknown>) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(","))].join("\n");
    download(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), `daftarak-${kind}-${Date.now()}.csv`);
    toast.success("تم التصدير");
  };

  const cloudBackup = async () => {
    if (!user) return;
    setBusy(true);
    const r = await uploadBackup(user.id, "manual");
    setBusy(false);
    if (!r) { toast.error("فشل الرفع"); return; }
    toast.success("تم حفظ النسخة في السحابة");
    loadBackups();
  };

  const setFreq = async (v: typeof frequency) => {
    if (!user) return;
    setFrequency(v);
    await supabase.from("profiles").update({ backup_frequency: v }).eq("user_id", user.id);
    toast.success("تم الحفظ");
  };

  const restore = async () => {
    if (!user || !restoreId) return;
    const b = backups.find((x) => x.id === restoreId);
    if (!b) return;
    setBusy(true);
    const snap = await downloadBackup(b.path);
    if (!snap) { setBusy(false); toast.error("تعذّر تحميل النسخة"); return; }
    const n = await restoreFromSnapshot(user.id, snap, "merge");
    setBusy(false);
    toast.success(`تم استرجاع ${n} عنصر`);
    setRestoreId(null);
  };

  const removeBackup = async (b: Backup) => {
    await deleteBackup(b.id, b.path);
    toast.success("تم الحذف");
    loadBackups();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try {
      const snap = JSON.parse(await file.text());
      if (!snap.version) throw new Error("ملف غير صالح");
      const n = await restoreFromSnapshot(user.id, snap, "merge");
      toast.success(`تم استيراد ${n} عنصر`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل الاستيراد");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const wipe = async () => {
    if (!user) return;
    setBusy(true);
    const tables = ["transactions", "expenses", "reminders", "recurring_rules", "budgets", "people"];
    for (const t of tables) {
      await (supabase.from(t as never) as never as { delete: () => { eq: (k: string, v: string) => Promise<unknown> } }).delete().eq("user_id", user.id);
    }
    setBusy(false);
    toast.success("تم مسح البيانات");
  };

  const FREQS: Array<{ v: typeof frequency; l: string }> = [
    { v: "off", l: "إيقاف" }, { v: "daily", l: "يومي" }, { v: "weekly", l: "أسبوعي" }, { v: "monthly", l: "شهري" },
  ];

  return (
    <div className="space-y-2.5">
      <PageHeader icon={Database} title="البيانات والنسخ الاحتياطي" subtitle="السحابة، التصدير، الاستيراد" back="/app/settings" />

      <SettingsGroup title="النسخ الاحتياطي السحابي">
        <SettingsRow icon={Cloud} label="إنشاء نسخة احتياطية الآن" desc="رفع فوري إلى التخزين السحابي" tone="primary" onClick={cloudBackup} />
        <SettingsRow icon={History} label="سجل النشاط" desc="آخر العمليات" to="/app/activity" tone="muted" />
      </SettingsGroup>

      <Card className="p-2.5 space-y-2">
        <div className="font-semibold text-[12px] leading-tight">النسخ التلقائي</div>
        <div className="grid grid-cols-4 gap-1.5">
          {FREQS.map((f) => (
            <button key={f.v} onClick={() => setFreq(f.v)}
              className={`py-1.5 rounded-md text-[11px] font-semibold transition-all ${frequency === f.v ? "bg-gradient-primary text-primary-foreground shadow-glow" : "bg-secondary text-muted-foreground"}`}>
              {f.l}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">يتم النسخ تلقائياً عند فتح التطبيق وفقاً لهذه الفترة.</p>
      </Card>

      {backups.length > 0 && (
        <SettingsGroup title={`النسخ المحفوظة (${backups.length}/10)`}>
          {backups.map((b) => (
            <div key={b.id} className="flex items-center gap-2 p-2 hover:bg-secondary rounded-lg">
              <div className="size-8 rounded-lg bg-secondary text-primary flex items-center justify-center shrink-0 ring-1 ring-border">
                <Cloud className="size-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[12px] flex items-center gap-1.5 leading-tight">
                  <span>{b.kind === "auto" ? "تلقائي" : "يدوي"}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{(b.size_bytes / 1024).toFixed(1)} KB</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{fmtDate(b.created_at)}</div>
              </div>
              <button onClick={() => setRestoreId(b.id)} className="text-primary p-1 hover:bg-primary/10 rounded-md" aria-label="استعادة">
                <RefreshCw className="size-3.5" />
              </button>
              <button onClick={() => removeBackup(b)} className="text-danger p-1 hover:bg-danger-soft rounded-md" aria-label="حذف">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </SettingsGroup>
      )}

      <SettingsGroup title="التصدير والاستيراد المحلي">
        <SettingsRow icon={Download} label="نسخة احتياطية كاملة (JSON)" desc="تحميل ملف على جهازك" tone="primary" onClick={exportJSON} />
        <SettingsRow icon={FileSpreadsheet} label="تصدير المعاملات (CSV)" desc="ديون فقط" tone="success" onClick={() => exportCSV("transactions")} />
        <SettingsRow icon={FileSpreadsheet} label="تصدير المصاريف (CSV)" desc="مصاريف فقط" tone="success" onClick={() => exportCSV("expenses")} />
        <SettingsRow icon={Upload} label="استيراد من نسخة احتياطية" desc="ملف JSON" tone="accent" onClick={() => fileRef.current?.click()} />
      </SettingsGroup>

      <input ref={fileRef} type="file" accept="application/json" hidden onChange={handleImport} />

      <Card className="p-1.5">
        <SettingsRow icon={Trash2} label="مسح كل البيانات" desc="لا يمكن التراجع" onClick={() => setConfirmWipe(true)} danger />
      </Card>

      <ConfirmDialog
        open={confirmWipe} onOpenChange={setConfirmWipe}
        title="مسح كل البيانات؟"
        description="سيتم حذف جميع الأشخاص والمعاملات والمصاريف. هذا الإجراء لا يمكن التراجع عنه."
        confirmLabel={busy ? "جارٍ..." : "مسح كل شيء"} destructive onConfirm={wipe}
      />
      <ConfirmDialog
        open={!!restoreId} onOpenChange={(v) => !v && setRestoreId(null)}
        title="استعادة هذه النسخة؟"
        description="سيتم دمج بيانات النسخة مع بياناتك الحالية. لن يُحذف شيء."
        confirmLabel={busy ? "جارٍ..." : "استعادة"} onConfirm={restore}
      />
      <Link to="/app/settings" className="hidden">.</Link>
      <Button className="hidden">_</Button>
    </div>
  );
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
