import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Wand2, AlertTriangle, ExternalLink } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { parseDebtText } from "@/lib/ai.functions";
import { toast } from "sonner";

export interface ParsedDraft {
  person_name: string;
  amount: number;
  direction: "credit" | "debit";
  details: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onParsed: (draft: ParsedDraft) => void;
}

const EXAMPLES = [
  "أعطيت أحمد 500 ريال قرض",
  "استلمت من سامي 200 سداد ديون",
  "خالد أخذ 1200 لإصلاح السيارة",
];

function friendlyAiError(msg: string): { title: string; desc?: string; link?: string } {
  if (msg.includes("quota") || msg.includes("Quota") || msg.includes("exceeded") || msg.includes("rate")) {
    return {
      title: "تجاوزت الحد المجاني لـ Gemini AI",
      desc: "لاستمرار الاستخدام، يمكنك تفعيل الفوترة في حسابك أو الترقية عبر الرابط أدناه.",
      link: "https://ai.dev/rate-limit",
    };
  }
  if (msg.includes("not found") || msg.includes("available")) {
    return {
      title: "النموذج غير متاح حالياً",
      desc: "تحقق من مفتاح API وتأكد من دعم النموذج في حسابك.",
    };
  }
  if (msg.includes("مفاتيح الذكاء") || msg.includes("API")) {
    return {
      title: "مفتاح الذكاء الاصطناعي غير مضاف",
      desc: "أضف متغير GEMINI_API_KEY أو OPENROUTER_API_KEY في إعدادات البيئة (.env).",
    };
  }
  return { title: msg };
}

export function SmartAddDialog({ open, onOpenChange, onParsed }: Props) {
  const parse = useServerFn(parseDebtText);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiError, setAiError] = useState<ReturnType<typeof friendlyAiError> | null>(null);

  const run = async () => {
    if (text.trim().length < 3) return toast.error("اكتب وصفاً أوضح");
    setBusy(true);
    setAiError(null);
    try {
      const draft = await parse({ data: { text: text.trim() } });
      onParsed(draft as ParsedDraft);
      setText("");
      onOpenChange(false);
      toast.success("تم التحليل — راجع البيانات");
    } catch (e) {
      const err = e as { message?: string };
      setAiError(friendlyAiError(err.message ?? "تعذّر التحليل"));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setAiError(null); }}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-1.5"><Wand2 className="size-4 text-primary" /> إضافة ذكية</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-[11px] text-muted-foreground">اكتب المعاملة بلغتك الطبيعية وسيقوم الذكاء الاصطناعي بتعبئة الحقول.</p>

          {aiError && (
            <div className="rounded-xl border border-amber-400/40 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-[12.5px]">
                <AlertTriangle className="size-4 shrink-0" />
                {aiError.title}
              </div>
              {aiError.desc && <p className="text-[11px] text-amber-600 dark:text-amber-400/80">{aiError.desc}</p>}
              {aiError.link && (
                <a
                  href={aiError.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-primary font-semibold hover:underline"
                >
                  <ExternalLink className="size-3" /> مراجعة استخدام Gemini API
                </a>
              )}
            </div>
          )}

          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="مثال: أعطيت أحمد 500 ريال قرض" className="text-[13px]" />
          <div className="flex flex-wrap gap-1">
            {EXAMPLES.map((e) => (
              <button key={e} onClick={() => setText(e)} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary hover:bg-secondary/70">{e}</button>
            ))}
          </div>
          <Button onClick={run} disabled={busy} className="w-full bg-gradient-primary text-primary-foreground">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <><Sparkles className="size-4 ms-1" /> تحليل</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

