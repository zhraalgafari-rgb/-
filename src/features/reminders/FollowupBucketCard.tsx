import { Bucket, severityMeta } from "@/lib/money/followup";
import { fmtMoney } from "@/lib/format";
import { Link } from "@tanstack/react-router";
import { Phone, Clock, Sparkles, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  bucket: Bucket;
  onGenerateMessage: (bucket: Bucket, tone?: "polite" | "firm" | "friendly") => void;
  onSendWhatsApp: (bucket: Bucket, text: string) => void;
}

export function FollowupBucketCard({ bucket, onGenerateMessage, onSendWhatsApp }: Props) {
  const meta = severityMeta[bucket.severity];

  function getSuggestions(b: Bucket): string[] {
    const out: string[] = [];
    if (b.severity === "critical") {
      out.push("اتصل مباشرة بالعميل وحدد موعداً نهائياً للسداد.");
      out.push("اقترح تقسيط المبلغ على دفعتين أو ثلاث.");
      out.push("ابدأ بإيقاف أي تعاملات جديدة حتى السداد.");
    } else if (b.severity === "late") {
      out.push("أرسل تذكيراً مهذباً عبر الواتساب الآن.");
      out.push("حدّد موعد سداد جديد ودوّنه كتذكير.");
    } else if (b.severity === "soon") {
      out.push("أرسل تذكيراً ودياً قبل موعد الاستحقاق.");
    }
    if (b.person.credit_limit && b.net > b.person.credit_limit) {
      out.push("تجاوز الحد الائتماني — يفضل تقليل التعامل الآجل.");
    }
    return out;
  }

  const suggestions = getSuggestions(bucket);

  return (
    <div className={`rounded-lg border bg-card shadow-card p-2.5 space-y-2 ring-1 ${meta.ring}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${meta.cls}`}>{meta.label}</span>
          <Link to="/app/person/$id" params={{ id: bucket.person.id }} className="font-bold text-foreground hover:text-primary truncate">
            {bucket.person.name}
          </Link>
        </div>
        <div className="text-left">
          <div className="text-[10px] text-muted-foreground">المستحق</div>
          <div className="font-black tabular-nums text-danger text-sm">
            {fmtMoney(bucket.net)} <span className="text-[10px]">{bucket.currency}</span>
          </div>
        </div>
      </div>
      
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-muted-foreground">
        {bucket.person.phone && (
          <span className="flex items-center gap-1" dir="ltr"><Phone className="size-3" />{bucket.person.phone}</span>
        )}
        {bucket.daysOverdue >= 0 && (
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {bucket.daysOverdue === 0 ? "يستحق اليوم" : `متأخر ${bucket.daysOverdue} يوم`}
          </span>
        )}
        <span>{bucket.txCount} معاملة</span>
      </div>
      
      {suggestions.length > 0 && (
        <ul className="text-[10.5px] space-y-0.5 bg-secondary/40 rounded p-1.5 border border-border/60">
          {suggestions.map((s, i) => (
            <li key={i} className="flex gap-1.5"><span className="text-primary">•</span><span>{s}</span></li>
          ))}
        </ul>
      )}
      
      <div className="flex gap-1.5">
        <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] flex-1" onClick={() => onGenerateMessage(bucket, "polite")}>
          <Sparkles className="size-3" /> رسالة ذكية
        </Button>
        <Button
          size="sm"
          className="h-7 px-2 text-[11px] flex-1 bg-success text-success-foreground hover:bg-success/90"
          onClick={() => {
            const t = `السلام عليكم ${bucket.person.name}،\nتذكير ودي بمبلغ ${fmtMoney(bucket.net)} ${bucket.currency} المستحق.\nشكراً لتعاونكم.`;
            onSendWhatsApp(bucket, t);
          }}
        >
          <MessageCircle className="size-3" /> واتساب
        </Button>
      </div>
    </div>
  );
}
