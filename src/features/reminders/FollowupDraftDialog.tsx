import { Sparkles, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bucket } from "@/lib/money/followup";
import { toast } from "sonner";

interface Props {
  draftFor: Bucket | null;
  draftText: string;
  aiLoading: boolean;
  onClose: () => void;
  onDraftTextChange: (text: string) => void;
  onGenerateMessage: (bucket: Bucket, tone: "polite" | "friendly" | "firm") => void;
  onSendWhatsApp: (bucket: Bucket, text: string) => void;
}

export function FollowupDraftDialog({ draftFor, draftText, aiLoading, onClose, onDraftTextChange, onGenerateMessage, onSendWhatsApp }: Props) {
  if (!draftFor) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={onClose}>
      <div className="bg-card rounded-xl border shadow-elevated w-full max-w-md p-3 space-y-2.5 animate-in slide-in-from-bottom-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="font-bold text-sm flex items-center gap-1.5"><Sparkles className="size-4 text-primary" /> رسالة لـ {draftFor.person.name}</div>
          <button onClick={onClose} className="text-muted-foreground text-xs">✕</button>
        </div>
        <div className="flex gap-1">
          {(["polite", "friendly", "firm"] as const).map((t) => (
            <button key={t} onClick={() => onGenerateMessage(draftFor, t)} className="text-[10px] px-2 py-1 rounded border bg-secondary hover:bg-primary hover:text-primary-foreground transition">
              {t === "polite" ? "مهذبة" : t === "friendly" ? "ودية" : "حازمة"}
            </button>
          ))}
        </div>
        <textarea
          value={draftText}
          onChange={(e) => onDraftTextChange(e.target.value)}
          rows={7}
          dir="rtl"
          className="w-full text-[12px] p-2 rounded border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder={aiLoading ? "جاري توليد الرسالة..." : "اكتب أو عدّل الرسالة..."}
        />
        {aiLoading && (
          <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground"><Loader2 className="size-3 animate-spin" /> جاري التوليد بالذكاء الاصطناعي...</div>
        )}
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" className="flex-1 h-8" onClick={() => { navigator.clipboard.writeText(draftText); toast.success("تم النسخ"); }}>
            نسخ
          </Button>
          <Button
            size="sm"
            className="flex-1 h-8 bg-success text-success-foreground hover:bg-success/90"
            disabled={!draftText.trim()}
            onClick={() => { onSendWhatsApp(draftFor, draftText); onClose(); }}
          >
            <Send className="size-3" /> إرسال واتساب
          </Button>
        </div>
      </div>
    </div>
  );
}
