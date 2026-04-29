import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { IconByName } from "@/components/IconByName";

interface Currency { id: string; name: string; is_base: boolean }
interface Category { id: string; name: string; icon: string; color: string }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currencies: Currency[];
  categories: Category[];
  editing?: { id: string; amount: number; category_id: string | null; currency_id: string; note: string | null; expense_date: string } | null;
  onSuccess: () => void;
}

export function ExpenseDialog({ open, onOpenChange, currencies, categories, editing, onSuccess }: Props) {
  const { user } = useAuth();
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [currencyId, setCurrencyId] = useState<string>("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setAmount(String(editing.amount));
      setCategoryId(editing.category_id ?? "");
      setCurrencyId(editing.currency_id);
      setNote(editing.note ?? "");
      setDate(new Date(editing.expense_date).toISOString().slice(0, 16));
    } else {
      setAmount(""); setNote("");
      setCategoryId(categories[0]?.id ?? "");
      const base = currencies.find((c) => c.is_base) ?? currencies[0];
      setCurrencyId(base?.id ?? "");
      setDate(new Date().toISOString().slice(0, 16));
    }
  }, [open, editing, categories, currencies]);

  const submit = async () => {
    if (!user) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("أدخل مبلغاً صحيحاً");
    if (!currencyId) return toast.error("اختر العملة");
    setBusy(true);
    const payload = {
      user_id: user.id,
      amount: amt,
      category_id: categoryId || null,
      currency_id: currencyId,
      note: note.trim() || null,
      expense_date: new Date(date).toISOString(),
    };
    const op = editing
      ? supabase.from("expenses").update(payload).eq("id", editing.id)
      : supabase.from("expenses").insert(payload);
    const { error } = await op;
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "تم التعديل" : "تمت الإضافة");
    onSuccess(); onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="text-right">{editing ? "تعديل مصروف" : "إضافة مصروف"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>المبلغ</Label>
              <Input type="number" inputMode="decimal" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>العملة</Label>
              <Select value={currencyId} onValueChange={setCurrencyId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>التصنيف</Label>
            <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
              {categories.map((c) => {
                const sel = c.id === categoryId;
                return (
                  <button key={c.id} onClick={() => setCategoryId(c.id)}
                    className={`p-2 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${sel ? "border-primary bg-secondary" : "border-border hover:border-primary/50"}`}>
                    <div className="size-9 rounded-lg flex items-center justify-center" style={{ background: c.color + "22", color: c.color }}>
                      <IconByName name={c.icon} className="size-4" />
                    </div>
                    <div className="text-[10px] font-medium truncate w-full text-center">{c.name}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>التاريخ</Label>
            <Input type="datetime-local" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>ملاحظة (اختياري)</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="ماذا اشتريت؟" maxLength={300} />
          </div>

          <Button onClick={submit} disabled={busy} className="w-full bg-gradient-primary text-primary-foreground shadow-glow">
            {busy ? "..." : editing ? "حفظ التعديلات" : "حفظ المصروف"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
