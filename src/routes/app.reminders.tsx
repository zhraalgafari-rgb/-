import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowRight, Bell, Plus, Check, Trash2, AlarmClock } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/app/reminders")({ component: RemindersPage });

interface Person { id: string; name: string }
interface Reminder { id: string; person_id: string | null; title: string; note: string | null; due_date: string; is_done: boolean }

function RemindersPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Reminder[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [personId, setPersonId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: r }, { data: p }] = await Promise.all([
      supabase.from("reminders").select("*").order("due_date"),
      supabase.from("people").select("id,name"),
    ]);
    setItems((r ?? []) as Reminder[]);
    setPeople((p ?? []) as Person[]);
  };
  useEffect(() => { load(); }, [user]);

  const reset = () => {
    setTitle(""); setNote(""); setPersonId("");
    const d = new Date(); d.setDate(d.getDate() + 7);
    setDate(d.toISOString().slice(0, 16));
  };

  const add = async () => {
    if (!user) return;
    if (!title.trim()) return toast.error("أدخل عنوان التذكير");
    if (!date) return toast.error("اختر التاريخ");
    setBusy(true);
    const { error } = await supabase.from("reminders").insert({
      user_id: user.id, title: title.trim(), note: note.trim() || null,
      due_date: new Date(date).toISOString(), person_id: personId || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("تم الإضافة"); setOpen(false); load();
  };

  const toggle = async (r: Reminder) => {
    await supabase.from("reminders").update({ is_done: !r.is_done }).eq("id", r.id);
    load();
  };
  const del = async (id: string) => {
    if (!confirm("حذف التذكير؟")) return;
    await supabase.from("reminders").delete().eq("id", id);
    toast.success("تم الحذف"); load();
  };

  const upcoming = items.filter((r) => !r.is_done);
  const done = items.filter((r) => r.is_done);

  return (
    <div className="space-y-4">
      <Link to="/app" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4" /> رجوع
      </Link>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-10 rounded-xl bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-glow">
            <Bell className="size-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">التذكيرات</h1>
            <p className="text-xs text-muted-foreground">{upcoming.length} نشط · {done.length} مكتمل</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={(v) => { if (v) reset(); setOpen(v); }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary text-primary-foreground"><Plus className="size-4" /> جديد</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="text-right">تذكير جديد</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>العنوان</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً: استرداد دين أحمد" maxLength={100} />
              </div>
              <div className="space-y-1.5">
                <Label>التاريخ والوقت</Label>
                <Input type="datetime-local" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>الشخص (اختياري)</Label>
                <Select value={personId || "none"} onValueChange={(v) => setPersonId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="بدون" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون</SelectItem>
                    {people.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>ملاحظة</Label>
                <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
              </div>
              <Button onClick={add} disabled={busy} className="w-full bg-gradient-primary text-primary-foreground">إضافة</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {upcoming.length === 0 && done.length === 0 ? (
          <div className="text-center py-16">
            <div className="size-16 mx-auto rounded-2xl bg-secondary flex items-center justify-center mb-3">
              <AlarmClock className="size-8 text-primary" />
            </div>
            <h3 className="font-bold mb-1">لا توجد تذكيرات</h3>
            <p className="text-sm text-muted-foreground">أضف تذكيراً لمواعيد استرداد الديون</p>
          </div>
        ) : (
          <>
            {upcoming.map((r) => {
              const due = new Date(r.due_date);
              const overdue = due < new Date();
              const person = people.find((p) => p.id === r.person_id);
              return (
                <Card key={r.id} className={`p-3 flex items-start gap-3 ${overdue ? "border-danger/40" : ""}`}>
                  <button onClick={() => toggle(r)} className="size-6 rounded-full border-2 border-muted-foreground hover:border-primary mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{r.title}</div>
                    {person && <div className="text-xs text-primary">{person.name}</div>}
                    {r.note && <div className="text-xs text-muted-foreground mt-0.5">{r.note}</div>}
                    <div className={`text-[11px] mt-1 ${overdue ? "text-danger font-semibold" : "text-muted-foreground"}`}>
                      {overdue ? "⚠️ متأخر · " : ""}{fmtDate(r.due_date)}
                    </div>
                  </div>
                  <button onClick={() => del(r.id)} className="text-muted-foreground hover:text-danger p-1"><Trash2 className="size-4" /></button>
                </Card>
              );
            })}
            {done.length > 0 && (
              <>
                <h3 className="text-xs font-semibold text-muted-foreground mt-4">مكتملة</h3>
                {done.map((r) => (
                  <Card key={r.id} className="p-3 flex items-start gap-3 opacity-60">
                    <button onClick={() => toggle(r)} className="size-6 rounded-full bg-success text-success-foreground flex items-center justify-center mt-0.5 shrink-0"><Check className="size-4" /></button>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm line-through">{r.title}</div>
                      <div className="text-[11px] text-muted-foreground">{fmtDate(r.due_date)}</div>
                    </div>
                    <button onClick={() => del(r.id)} className="text-muted-foreground hover:text-danger p-1"><Trash2 className="size-4" /></button>
                  </Card>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
