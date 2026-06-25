import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { parseExcelFile, mapRows, type ColumnMapping, type Row, type MappedTx } from "@/lib/io/importExcel";
import { commitImportedTxs } from "@/lib/io/commitImport";
import { UploadCloud, ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";

interface Props { open: boolean; onOpenChange: (v: boolean) => void; onDone?: () => void }

export function ImportWizard({ open, onOpenChange, onDone }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({ name: "", amount: "" });
  const [mapped, setMapped] = useState<MappedTx[]>([]);
  const [errors, setErrors] = useState<{ row: number; reason: string }[]>([]);
  const [busy, setBusy] = useState(false);

  const reset = () => { setStep(1); setRows([]); setHeaders([]); setMapping({ name: "", amount: "" }); setMapped([]); setErrors([]); };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const { headers: h, rows: r } = await parseExcelFile(f);
      if (!r.length) { toast.error("الملف فارغ"); return; }
      setHeaders(h); setRows(r);
      // Auto-guess
      const guess = (kws: string[]) => h.find((c) => kws.some((k) => c.toLowerCase().includes(k))) ?? "";
      setMapping({
        name: guess(["name", "اسم", "client", "عميل"]),
        amount: guess(["amount", "مبلغ", "value", "قيمة"]),
        direction: guess(["type", "نوع", "direction", "حركة"]),
        date: guess(["date", "تاريخ"]),
        details: guess(["detail", "note", "تفاصيل", "ملاحظ", "وصف"]),
      });
      setStep(2);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر قراءة الملف");
    }
  };

  const preview = () => {
    if (!mapping.name || !mapping.amount) { toast.error("اختر عمودي الاسم والمبلغ"); return; }
    const { ok, errors } = mapRows(rows, mapping);
    setMapped(ok); setErrors(errors); setStep(3);
  };

  const commit = async () => {
    if (!user || !mapped.length) return;
    setBusy(true);
    const { data: cur } = await supabase.from("currencies").select("id").eq("user_id", user.id).eq("is_base", true).maybeSingle();
    if (!cur?.id) { toast.error("لا توجد عملة أساسية"); setBusy(false); return; }
    const res = await commitImportedTxs(user.id, cur.id, mapped);
    setBusy(false);
    toast.success(`تم استيراد ${res.inserted} معاملة${res.failed ? ` (فشل ${res.failed})` : ""}`);
    onDone?.();
    onOpenChange(false);
    setTimeout(reset, 200);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setTimeout(reset, 200); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-right text-[13px]">استيراد من Excel — خطوة {step}/3</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-3">
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer hover:bg-secondary transition-colors">
              <UploadCloud className="size-8 text-primary" />
              <div className="text-[12px] font-semibold">اضغط لاختيار ملف .xlsx أو .csv</div>
              <div className="text-[10px] text-muted-foreground">الصف الأول يجب أن يحتوي على أسماء الأعمدة</div>
              <input type="file" accept=".xlsx,.xls,.csv" hidden onChange={handleFile} />
            </label>
            <div className="text-[10px] text-muted-foreground bg-secondary p-2 rounded-md">
              الأعمدة الموصى بها: الاسم، المبلغ، النوع (له/عليه)، التاريخ، تفاصيل
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2.5">
            <div className="text-[11px] text-muted-foreground">طابق الأعمدة من ملفك ({rows.length} صف):</div>
            {([
              ["name", "الاسم *", true],
              ["amount", "المبلغ *", true],
              ["direction", "النوع (له/عليه)", false],
              ["date", "التاريخ", false],
              ["details", "التفاصيل", false],
            ] as const).map(([key, label]) => (
              <div key={key} className="grid grid-cols-3 items-center gap-2">
                <Label className="text-[11px]">{label}</Label>
                <Select value={(mapping[key] as string) || "__none"} onValueChange={(v) => setMapping((m) => ({ ...m, [key]: v === "__none" ? "" : v }))}>
                  <SelectTrigger className="col-span-2 h-8 text-[11px]"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div className="flex justify-between pt-2">
              <Button variant="outline" size="sm" onClick={() => setStep(1)}><ArrowRight className="size-3.5" /> رجوع</Button>
              <Button size="sm" onClick={preview} className="bg-gradient-primary text-primary-foreground">معاينة <ArrowLeft className="size-3.5" /></Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-[12px]">
              <CheckCircle2 className="size-4 text-success" /> صالح: <b>{mapped.length}</b>
              {errors.length > 0 && <><AlertTriangle className="size-4 text-danger ms-3" /> أخطاء: <b>{errors.length}</b></>}
            </div>
            <div className="max-h-56 overflow-auto rounded-lg border text-[11px]">
              <table className="w-full">
                <thead className="bg-secondary sticky top-0">
                  <tr><th className="p-1.5 text-right">الاسم</th><th className="p-1.5">المبلغ</th><th className="p-1.5">النوع</th><th className="p-1.5">التاريخ</th></tr>
                </thead>
                <tbody>
                  {mapped.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-1.5 text-right">{r.name}</td>
                      <td className="p-1.5 text-center tabular-nums">{r.amount}</td>
                      <td className="p-1.5 text-center">{r.direction === "credit" ? "له" : "عليه"}</td>
                      <td className="p-1.5 text-center" dir="ltr">{r.date.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {mapped.length > 50 && <div className="text-[10px] text-muted-foreground">عرض أول 50 من {mapped.length}</div>}
            <div className="flex justify-between pt-2">
              <Button variant="outline" size="sm" onClick={() => setStep(2)}><ArrowRight className="size-3.5" /> رجوع</Button>
              <Button size="sm" disabled={busy || !mapped.length} onClick={commit} className="bg-gradient-success text-white">
                {busy ? "جارٍ..." : `استيراد ${mapped.length}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
