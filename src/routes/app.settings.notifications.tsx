import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/common/PageHeader";
import { Bell, BellRing, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/settings/notifications")({ component: NotificationsPage });

function NotificationsPage() {
  const [enabled, setEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState("09:00");
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    try {
      setEnabled(localStorage.getItem("daftarak.notif.enabled") === "1");
      setReminderTime(localStorage.getItem("daftarak.notif.time") ?? "09:00");
      if (typeof Notification !== "undefined") setPermission(Notification.permission);
    } catch {}
  }, []);

  const requestPerm = async () => {
    if (typeof Notification === "undefined") return toast.error("متصفحك لا يدعم الإشعارات");
    const p = await Notification.requestPermission();
    setPermission(p);
    if (p === "granted") {
      toggle(true);
      new Notification("دفترك", { body: "تم تفعيل الإشعارات بنجاح ✅" });
    } else {
      toast.error("لم يتم منح إذن الإشعارات");
    }
  };

  const toggle = (v: boolean) => {
    setEnabled(v);
    try { localStorage.setItem("daftarak.notif.enabled", v ? "1" : "0"); } catch {}
  };

  const saveTime = (t: string) => {
    setReminderTime(t);
    try { localStorage.setItem("daftarak.notif.time", t); } catch {}
  };

  return (
    <div className="space-y-3">
      <PageHeader icon={Bell} title="الإشعارات" subtitle="تذكيرات الديون والمصاريف" back="/app/settings" />

      <Card className="p-3 space-y-3">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-lg bg-secondary text-primary flex items-center justify-center">
            <BellRing className="size-4" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-[13px] leading-tight">تنبيهات المتصفح</div>
            <div className="text-[11px] text-muted-foreground">
              {permission === "granted" ? "مسموح" : permission === "denied" ? "مرفوض من المتصفح" : "بحاجة لإذن"}
            </div>
          </div>
          {permission === "granted"
            ? <Switch checked={enabled} onCheckedChange={toggle} />
            : <Button size="sm" onClick={requestPerm} disabled={permission === "denied"}>طلب الإذن</Button>}
        </div>
      </Card>

      <Card className="p-3 space-y-3">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-lg bg-secondary text-primary flex items-center justify-center">
            <Clock className="size-4" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-[13px] leading-tight">وقت التذكير اليومي</div>
            <div className="text-[11px] text-muted-foreground">سيتم فحص التذكيرات في هذا الوقت</div>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">الوقت</Label>
          <input
            type="time"
            value={reminderTime}
            onChange={(e) => saveTime(e.target.value)}
            className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-sm"
            dir="ltr"
          />
        </div>
      </Card>

      <p className="text-[11px] text-muted-foreground text-center px-4">
        ملاحظة: تعتمد التنبيهات على بقاء التطبيق مفتوحاً في المتصفح.
      </p>
    </div>
  );
}
