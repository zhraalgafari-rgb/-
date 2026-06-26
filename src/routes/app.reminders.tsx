import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Bell, Plus, Check, Trash2, AlarmClock, Clock, Pencil, Repeat, RefreshCw } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { completeReminder, snoozeReminder, syncRemindersFromTransactions, type Reminder, type RepeatKind } from "@/lib/reminders";

export const Route = createFileRoute("/app/reminders")({ component: RemindersPage });

interface Person { id: string; name: string }
type Filter = "overdue" | "today" | "upcoming" | "done";

const REPEAT_LABEL: Record<RepeatKind, string> = {
  none: "لا يتكرر", daily: "يومي", weekly: "أسبوعي", monthly: "شهري",
};

function RemindersPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Reminder[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [filter, setFilter] = useState<Filter>("overdue");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [personId, setPersonId] = useState<string>("");
  const [repeat, setRepeat] = useState<RepeatKind>("none");
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    const [{ data: r }, { data: p }] = await Promise.all([
      supabase.from("reminders").select("*").order("due_date"),
      supabase.from("people").select("id,name").eq("is_archived", false),
    ]);
    setItems((r ?? []) as Reminder[]);
    setPeople((p ?? []) as Person[]);
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      await syncRemindersFromTransactions(user.id);
      await load();
    })();
  }, [user, load]);

  const sync = async () => {
    if (!user) return;
    setSyncing(true);
    const n = await syncRemindersFromTransactions(user.id);
    setSyncing(false);
    toast.success(n > 0 ? `تم إضافة ${n} تذكير من الديون` : "لا توجد ديون جديدة بتاريخ استحقاق");
    load();
  };

  const reset = () => {
    setEditing(null);
    setTitle(""); setNote(""); setPersonId(""); setRepeat("none");
    const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(9, 0, 0, 0);
    setDate(toLocalInput(d.toISOString()));
  };

  const openEdit = (r: Reminder) => {
    setEditing(r);
    setTitle(r.title);
    setNote(r.note ?? "");
    setPersonId(r.person_id ?? "");
    setRepeat((r.repeat as RepeatKind) ?? "none");
    setDate(toLocalInput(r.due_date));
    setOpen(true);
  };

  const save = async () => {
    if (!user) return;
    if (!title.trim()) return toast.error("أدخل عنوان التذكير");
    if (!date) return toast.error("اختر التاريخ");
    setBusy(true);
    const payload = {
      title: title.trim(), note: note.trim() || null,
      due_date: new Date(date).toISOString(),
      person_id: personId || null, repeat,
    };
    const { error } = editing
      ? await supabase.from("reminders").update(payload).eq("id", editing.id)
      : await supabase.from("reminders").insert({ ...payload, user_id: user.id, is_done: false });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "تم التحديث" : "تم الإضافة");
    setOpen(false); load();
  };

  const toggleDone = async (r: Reminder) => {
    if (r.is_done) {
      await supabase.from("reminders").update({ is_done: false }).eq("id", r.id);
    } else {
      await completeReminder(r);
      if (r.repeat !== "none") toast.success(`تم. التالي: ${REPEAT_LABEL[r.repeat]}`);
    }
    load();
  };

  const snooze = async (id: string, days: number) => {
    await snoozeReminder(id, days);
    toast.success(`مؤجل ${days === 1 ? "يوم" : `${days} أيام`}`);
    load();
  };

  const del = async (id: string) => {
    if (!confirm("حذف التذكير؟")) return;
    await supabase.from("reminders").delete().eq("id", id);
    toast.success("تم الحذف"); load();
  };

  const filtered = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
    const endToday = new Date(now); endToday.setHours(23, 59, 59, 999);
    return items.filter((r) => {
      const d = new Date(r.due_date);
      if (filter === "done") return r.is_done;
      if (r.is_done) return false;
      if (filter === "overdue") return d < startToday;
      if (filter === "today") return d >= startToday && d <= endToday;
      return d > endToday; // upcoming
    });
  }, [items, filter]);

  const counts = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
    const endToday = new Date(now); endToday.setHours(23, 59, 59, 999);
    const c = { overdue: 0, today: 0, upcoming: 0, done: 0 };
    for (const r of items) {
      if (r.is_done) { c.done++; continue; }
      const d = new Date(r.due_date);
      if (d < startToday) c.overdue++;
      else if (d <= endToday) c.today++;
      else c.upcoming++;
    }
    return c;
  }, [items]);

  const TABS: Array<{ id: Filter; label: string; count: number; tone: string }> = [
    { id: "overdue", label: "متأخر", count: counts.overdue, tone: "text-danger" },
    { id: "today", label: "اليوم", count: counts.today, tone: "text-warning" },
    { id: "upcoming", label: "قادمة", count: counts.upcoming, tone: "text-primary" },
    { id: "done", label: "مكتملة", count: counts.done, tone: "text-success" },
  ];

  return (
    <div className="space-y-3">
      <PageHeader icon={Bell} title="التذكيرات" subtitle={`${counts.overdue + counts.today + counts.upcoming} نشط · ${counts.done} مكتمل`} back="/app" />

      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="outline" onClick={sync} disabled={syncing} className="h-8 text-[11px] gap-1">
          <RefreshCw className={`size-3 ${syncing ? "animate-spin" : ""}`} /> مزامنة من الديون
        </Button>
        <Dialog open={open} onOpenChange={(v) => { if (v && !editing) reset(); setOpen(v); }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={reset} className="h-8 text-[11px] gap-1 bg-gradient-primary text-primary-foreground ml-auto">
              <Plus className="size-3" /> جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="text-right">{editing ? "تعديل تذكير" : "تذكير جديد"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>العنوان</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً: استرداد دين أحمد" maxLength={100} />
              </div>
              <div className="space-y-1.5">
                <Label>التاريخ والوقت</Label>
                <Input type="datetime-local" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>التكرار</Label>
                  <Select value={repeat} onValueChange={(v) => setRepeat(v as RepeatKind)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(REPEAT_LABEL) as RepeatKind[]).map((k) => (
                        <SelectItem key={k} value={k}>{REPEAT_LABEL[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>الشخص</Label>
                  <Select value={personId || "none"} onValueChange={(v) => setPersonId(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="بدون" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون</SelectItem>
                      {people.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>ملاحظة</Label>
                <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
              </div>
              <Button onClick={save} disabled={busy} className="w-full bg-gradient-primary text-primary-foreground">
                {editing ? "حفظ" : "إضافة"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 ${
              filter === t.id ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/70"
            }`}
          >
            <span>{t.label}</span>
            <span className={`text-[10px] font-bold ${filter === t.id ? "opacity-80" : t.tone}`}>{t.count}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={AlarmClock} title="لا توجد تذكيرات" description="أضف تذكيراً أو زامن من الديون التي لها تاريخ استحقاق" />
      ) : (
        <div className="space-y-1.5 animate-in fade-in">
          {filtered.map((r) => {
            const due = new Date(r.due_date);
            const overdue = !r.is_done && due < new Date();
            const person = people.find((p) => p.id === r.person_id);
            return (
              <Card key={r.id} className={`p-2.5 flex items-start gap-2 ${overdue ? "border-danger/40" : ""} ${r.is_done ? "opacity-60" : ""}`}>
                <button
                  onClick={() => toggleDone(r)}
                  className={`size-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 transition-colors ${
                    r.is_done ? "bg-success border-success text-success-foreground" : "border-muted-foreground hover:border-primary"
                  }`}
                  aria-label={r.is_done ? "إلغاء الإكمال" : "إكمال"}
                >
                  {r.is_done && <Check className="size-3" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`font-semibold text-[13px] leading-tight ${r.is_done ? "line-through" : ""}`}>{r.title}</div>
                  <div className="flex items-center flex-wrap gap-1.5 mt-0.5">
                    {person && <span className="text-[10px] text-primary font-semibold">{person.name}</span>}
                    {r.transaction_id && <span className="text-[10px] px-1 py-0.5 rounded bg-primary/10 text-primary">دين مرتبط</span>}
                    {r.repeat !== "none" && (
                      <span className="text-[10px] inline-flex items-center gap-0.5 text-muted-foreground">
                        <Repeat className="size-2.5" /> {REPEAT_LABEL[r.repeat as RepeatKind]}
                      </span>
                    )}
                  </div>
                  {r.note && <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{r.note}</div>}
                  <div className={`text-[10px] mt-1 ${overdue ? "text-danger font-bold" : "text-muted-foreground"}`}>
                    {overdue ? "⚠️ متأخر · " : ""}{fmtDate(r.due_date)}
                  </div>
                  {!r.is_done && (
                    <div className="flex gap-1 mt-1.5">
                      <button onClick={() => snooze(r.id, 1)} className="text-[10px] inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-secondary hover:opacity-80">
                        <Clock className="size-2.5" /> يوم
                      </button>
                      <button onClick={() => snooze(r.id, 7)} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary hover:opacity-80">أسبوع</button>
                      <button onClick={() => openEdit(r)} className="text-[10px] inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-secondary hover:opacity-80 mr-auto">
                        <Pencil className="size-2.5" /> تعديل
                      </button>
                    </div>
                  )}
                </div>
                <button onClick={() => del(r.id)} className="text-muted-foreground hover:text-danger p-1" aria-label="حذف">
                  <Trash2 className="size-3.5" />
                </button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
