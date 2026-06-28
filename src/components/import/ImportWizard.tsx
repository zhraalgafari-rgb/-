import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { parseExcelFile, mapRows, type ColumnMapping, type Row, type MappedTx } from "@/lib/io/importExcel";
import { extractPdfText } from "@/lib/io/importPdf";
import { commitImportedTxs } from "@/lib/io/commitImport";
import { aiSuggestImportMapping, aiExtractFromPdfText } from "@/lib/ai-import.functions";
import { UploadCloud, ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle, Sparkles, Loader2, FileText } from "lucide-react";

interface Props { open: boolean; onOpenChange: (v: boolean) => void; onDone?: () => void }

type Step = 1 | 2 | 3;

const FIELDS = [
  ["name", "الاسم *"],
  ["amount", "المبلغ *"],
  ["direction", "النوع (له/عليه)"],
  ["date", "التاريخ"],
  ["details", "التفاصيل"],
  ["phone", "الجوال"],
  ["currency", "العملة"],
  ["opening_balance", "رصيد افتتاحي"],
] as const;

export function ImportWizard({ open, onOpenChange, onDone }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({ name: "", amount: "" });
  const [mapped, setMapped] = useState<MappedTx[]>([]);
  const [errors, setErrors] = useState<{ row: number; reason: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const aiSuggest = useServerFn(aiSuggestImportMapping);
  const aiPdf = useServerFn(aiExtractFromPdfText);

  const reset = () => {
    setStep(1); setRows([]); setHeaders([]);
    setMapping({ name: "", amount: "" }); setMapped([]); setErrors([]);
  };

  const guessLocal = (h: string[]): ColumnMapping => {
    const g = (kws: string[]) => h.find((c) => kws.some((k) => c.toLowerCase().includes(k))) ?? "";
    return {
      name: g(["name", "اسم", "client", "عميل"]),
      amount: g(["amount", "مبلغ", "value", "قيمة"]),
      direction: g(["type", "نوع", "direction", "حركة"]),
      date: g(["date", "تاريخ"]),
      details: g(["detail", "note", "تفاصيل", "ملاحظ", "وصف"]),
      phone: g(["phone", "mobile", "جوال", "هاتف", "موبايل"]),
      currency: g(["currency", "عملة"]),
      opening_balance: g(["opening", "افتتاح", "رصيد سابق", "previous"]),
    };
  };

  const handleExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const { headers: h, rows: r } = await parseExcelFile(f);
      if (!r.length) { toast.error("الملف فارغ"); return; }
      setHeaders(h); setRows(r);
      setMapping(guessLocal(h));
      setStep(2);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر قراءة الملف");
    }
  };

  const handlePdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPdfBusy(true);
    try {
      const text = await extractPdfText(f);
      if (text.length < 20) { toast.error("لم يتم العثور على نص قابل للقراءة في PDF"); return; }
      const res = await aiPdf({ data: { text } });
      if (!res.rows.length) { toast.error("لم يتم استخراج صفوف"); return; }
      const pseudoRows: Row[] = res.rows.map((r) => ({
        name: r.name, amount: r.amount, direction: r.direction,
        date: r.date ?? "", details: r.details ?? "", phone: r.phone ?? "",
      }));
      setHeaders(["name", "amount", "direction", "date", "details", "phone"]);
      setRows(pseudoRows);
      setMapping({ name: "name", amount: "amount", direction: "direction", date: "date", details: "details", phone: "phone" });
      toast.success(`استخرج AI ${res.rows.length} صف من PDF`);
      setStep(2);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر تحليل PDF");
    } finally {
      setPdfBusy(false);
    }
  };

  const runAiMap = async () => {
    if (!headers.length) return;
    setAiBusy(true);
    try {
      const out = await aiSuggest({ data: { headers, sampleRows: rows.slice(0, 5) as Record<string, unknown>[] } });
      setMapping(out);
      toast.success("تم اقتراح الأعمدة بواسطة AI");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل الاقتراح");
    } finally {
      setAiBusy(false);
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
    toast.success(
      `استورد ${res.inserted} معاملة، ${res.people} عميل جديد${res.openings ? "، " + res.openings + " رصيد افتتاحي" : ""}${res.failed ? ` (فشل ${res.failed})` : ""}`,
    );
    onDone?.();
    onOpenChange(false);
    setTimeout(reset, 200);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setTimeout(reset, 200); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-right text-[13px]">استيراد ذكي — خطوة {step}/3</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-2.5">
            <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-primary/40 rounded-xl p-5 cursor-pointer hover:bg-primary/5 transition-colors">
              <UploadCloud className="size-7 text-primary" />
              <div className="text-[12px] font-semibold">Excel / CSV</div>
              <div className="text-[10px] text-muted-foreground">.xlsx، .xls، .csv</div>
              <input type="file" accept=".xlsx,.xls,.csv" hidden onChange={handleExcel} />
            </label>
            <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-accent/40 rounded-xl p-5 cursor-pointer hover:bg-accent/5 transition-colors">
              {pdfBusy ? <Loader2 className="size-7 text-accent animate-spin" /> : <FileText className="size-7 text-accent" />}
              <div className="text-[12px] font-semibold">PDF (استخراج بـ AI)</div>
              <div className="text-[10px] text-muted-foreground">يستخرج الصفوف تلقائياً</div>
              <input type="file" accept=".pdf" hidden disabled={pdfBusy} onChange={handlePdf} />
            </label>
            <div className="text-[10px] text-muted-foreground bg-secondary p-2 rounded-md">
              <Sparkles className="size-3 inline ms-0.5 text-primary" /> AI يقترح ربط الأعمدة تلقائياً بعد الرفع
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-muted-foreground">طابق الأعمدة ({rows.length} صف):</div>
              <Button size="sm" variant="outline" disabled={aiBusy} onClick={runAiMap} className="h-7 text-[11px]">
                {aiBusy ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3 text-primary" />}
                اقترح بـ AI
              </Button>
            </div>
            {FIELDS.map(([key, label]) => (
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
                  <tr>
                    <th className="p-1.5 text-right">الاسم</th>
                    <th className="p-1.5">المبلغ</th>
                    <th className="p-1.5">النوع</th>
                    <th className="p-1.5">جوال</th>
                  </tr>
                </thead>
                <tbody>
                  {mapped.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-1.5 text-right">{r.name}</td>
                      <td className="p-1.5 text-center tabular-nums">{r.amount}</td>
                      <td className="p-1.5 text-center">{r.direction === "credit" ? "له" : "عليه"}</td>
                      <td className="p-1.5 text-center" dir="ltr">{r.phone ?? "—"}</td>
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
