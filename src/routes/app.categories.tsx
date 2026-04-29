import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, ArrowRight, Tags } from "lucide-react";
import { IconByName, CATEGORY_ICONS, CATEGORY_COLORS } from "@/components/IconByName";
import { toast } from "sonner";

export const Route = createFileRoute("/app/categories")({ component: CategoriesPage });

interface Cat { id: string; name: string; icon: string; color: string; is_default: boolean; sort_order: number }

function CategoriesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Cat[]>([]);
  const [editing, setEditing] = useState<Cat | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("Tag");
  const [color, setColor] = useState("#3b82f6");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("expense_categories").select("*").order("sort_order").order("created_at");
    setItems((data ?? []) as Cat[]);
  };
  useEffect(() => { load(); }, [user]);

  const openNew = () => { setEditing(null); setName(""); setIcon("Tag"); setColor("#3b82f6"); setOpen(true); };
  const openEdit = (c: Cat) => { setEditing(c); setName(c.name); setIcon(c.icon); setColor(c.color); setOpen(true); };

  const save = async () => {
    if (!user) return;
    if (!name.trim()) return toast.error("أدخل الاسم");
    setBusy(true);
    if (editing) {
      const { error } = await supabase.from("expense_categories").update({ name: name.trim(), icon, color }).eq("id", editing.id);
      if (error) { setBusy(false); return toast.error(error.message); }
    } else {
      const max = items.reduce((m, x) => Math.max(m, x.sort_order), 0);
      const { error } = await supabase.from("expense_categories").insert({ user_id: user.id, name: name.trim(), icon, color, sort_order: max + 1 });
      if (error) { setBusy(false); return toast.error(error.message); }
    }
    setBusy(false); setOpen(false); toast.success("تم الحفظ"); load();
  };

  const del = async (c: Cat) => {
    if (!confirm(`حذف تصنيف "${c.name}"؟`)) return;
    const { error } = await supabase.from("expense_categories").delete().eq("id", c.id);
    if (error) return toast.error("لا يمكن الحذف — قد يكون مستخدماً في مصاريف");
    toast.success("تم الحذف"); load();
  };

  return (
    <div className="space-y-4">
      <Link to="/app/settings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4" /> رجوع للإعدادات
      </Link>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-10 rounded-xl bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-glow">
            <Tags className="size-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">التصنيفات</h1>
            <p className="text-xs text-muted-foreground">{items.length} تصنيف</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="bg-gradient-primary text-primary-foreground"><Plus className="size-4" /> جديد</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="text-right">{editing ? "تعديل التصنيف" : "تصنيف جديد"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>الاسم</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="مثلاً: قهوة" />
              </div>
              <div className="space-y-2">
                <Label>اللون</Label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_COLORS.map((c) => (
                    <button key={c} onClick={() => setColor(c)} style={{ background: c }}
                      className={`size-8 rounded-full transition-transform ${color === c ? "ring-2 ring-offset-2 ring-foreground scale-110" : ""}`} />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>الأيقونة</Label>
                <div className="grid grid-cols-8 gap-2 max-h-48 overflow-y-auto p-2 rounded-xl border">
                  {CATEGORY_ICONS.map((n) => (
                    <button key={n} onClick={() => setIcon(n)}
                      className={`size-9 rounded-lg flex items-center justify-center transition-all ${icon === n ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/70"}`}>
                      <IconByName name={n} className="size-4" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary">
                <div className="size-10 rounded-xl flex items-center justify-center" style={{ background: color + "33", color }}>
                  <IconByName name={icon} className="size-5" />
                </div>
                <div className="text-sm font-semibold">{name || "معاينة"}</div>
              </div>
              <Button onClick={save} disabled={busy} className="w-full bg-gradient-primary text-primary-foreground">{editing ? "حفظ التعديلات" : "إضافة"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-2">
        {items.map((c) => (
          <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary transition-colors">
            <div className="size-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: c.color + "22", color: c.color }}>
              <IconByName name={c.icon} className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{c.name}</div>
              {c.is_default && <div className="text-[10px] text-muted-foreground">افتراضي</div>}
            </div>
            <button onClick={() => openEdit(c)} className="p-2 text-muted-foreground hover:text-primary"><Pencil className="size-4" /></button>
            <button onClick={() => del(c)} className="p-2 text-muted-foreground hover:text-danger"><Trash2 className="size-4" /></button>
          </div>
        ))}
      </Card>
    </div>
  );
}
