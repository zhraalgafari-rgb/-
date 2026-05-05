import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { fetchPending, markAllSeen, type PendingItem } from "@/lib/notifications";
import { fmtDate } from "@/lib/format";
import { Bell, AlarmClock, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/app/notifications")({ component: NotificationsCenter });

function NotificationsCenter() {
  const { user } = useAuth();
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const list = await fetchPending(user.id);
      setItems(list);
      await markAllSeen(user.id);
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="space-y-4">
      <PageHeader icon={Bell} title="مركز الإشعارات" subtitle={`${items.length} تنبيه`} back="/app" />

      {loading ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">جارٍ التحميل...</Card>
      ) : items.length === 0 ? (
        <EmptyState icon={Bell} title="لا توجد إشعارات" description="ستظهر هنا التذكيرات المستحقة والديون المتأخرة" />
      ) : (
        <div className="space-y-2 animate-in fade-in">
          {items.map((it) => (
            <Card key={it.id} className="p-3 flex items-start gap-3">
              <div className="size-10 rounded-xl bg-danger-soft text-danger flex items-center justify-center shrink-0">
                <AlarmClock className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{it.title}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{fmtDate(it.due_date)}</div>
              </div>
              <Link to="/app/reminders" className="text-primary text-xs font-semibold p-1">
                <ArrowLeft className="size-4" />
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
