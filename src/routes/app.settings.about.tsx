import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/common/PageHeader";
import { Info, Wallet, Heart, Github, Globe } from "lucide-react";

export const Route = createFileRoute("/app/settings/about")({ component: AboutPage });

function AboutPage() {
  return (
    <div className="space-y-2.5">
      <PageHeader icon={Info} title="حول التطبيق" back="/app/settings" />

      <Card className="p-3 flex flex-col items-center gap-1.5 text-center">
        <div className="size-12 rounded-xl bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-glow">
          <Wallet className="size-6" />
        </div>
        <div>
          <div className="font-black text-[14px]">دفترك</div>
          <div className="text-[10px] text-muted-foreground">إصدار 1.0.0</div>
        </div>
        <p className="text-[11px] text-muted-foreground max-w-xs leading-relaxed">
          تطبيق احترافي لإدارة الديون والمصاريف الشخصية بسهولة وأمان.
        </p>
      </Card>

      <Card className="p-1 divide-y divide-border/50">
        <Row icon={Globe} label="الموقع الإلكتروني" desc="lovable.app" />
        <Row icon={Github} label="المصدر المفتوح" desc="مبني بأحدث التقنيات" />
        <Row icon={Heart} label="صُنع بحب" desc="نقدر استخدامك للتطبيق" />
      </Card>

      <Card className="p-2.5 space-y-1 text-[10px] text-muted-foreground leading-relaxed">
        <p className="font-semibold text-foreground text-[11px]">الخصوصية والأمان</p>
        <p>بياناتك مشفّرة ومحفوظة بأمان. لا نشارك أو نبيع أي معلومات شخصية.</p>
        <p>يمكنك تصدير أو حذف بياناتك في أي وقت من إعدادات البيانات.</p>
      </Card>

      <p className="text-center text-[10px] text-muted-foreground">
        © {new Date().getFullYear()} دفترك. جميع الحقوق محفوظة.
      </p>
    </div>
  );
}

function Row({ icon: Icon, label, desc }: { icon: React.ComponentType<{ className?: string }>; label: string; desc: string }) {
  return (
    <div className="flex items-center gap-2 p-1.5">
      <div className="size-7 rounded-md bg-secondary text-primary flex items-center justify-center ring-1 ring-border">
        <Icon className="size-3.5" />
      </div>
      <div className="flex-1 text-right">
        <div className="font-semibold text-[12px] leading-tight">{label}</div>
        <div className="text-[10px] text-muted-foreground">{desc}</div>
      </div>
    </div>
  );
}
