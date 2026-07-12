import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Paperclip, X, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { IconByName } from "@/components/IconByName";
import { AmountInput } from "@/components/AmountInput";
import { Wallet } from "lucide-react";
import { useExpenseForm } from "@/hooks/useExpenseForm";

interface Currency { id: string; name: string; is_base: boolean }
interface Category { id: string; name: string; icon: string; color: string }
interface Account { id: string; name: string; is_default: boolean }

interface Editing {
  id: string;
  amount: number;
  category_id: string | null;
  account_id?: string | null;
  currency_id: string;
  note: string | null;
  expense_date: string;
  receipt_path?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currencies: Currency[];
  categories: Category[];
  accounts?: Account[];
  editing?: Editing | null;
  onSuccess: () => void;
}

export function ExpenseDialog({ open, onOpenChange, currencies, categories, accounts = [], editing, onSuccess }: Props) {
  const { user } = useAuth();
  
  const {
    amount, setAmount,
    categoryId, setCategoryId,
    accountId, setAccountId,
    currencyId, setCurrencyId,
    note, setNote,
    date, setDate,
    receiptUrl,
    uploading,
    busy,
    handleUpload,
    removeReceipt,
    submit
  } = useExpenseForm({
    open,
    user,
    editing,
    currencies,
    categories,
    accounts,
    onSuccess,
    onOpenChange,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[92dvh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-right">{editing ? "تعديل مصروف" : "إضافة مصروف"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>المبلغ</Label>
              <AmountInput value={amount} onChange={setAmount} />
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
                    className={`p-2 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${sel ? "border-primary bg-secondary scale-[1.02]" : "border-border hover:border-primary/50"}`}>
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
            <Label>المحفظة / الحساب</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="اختر المحفظة" /></SelectTrigger>
              <SelectContent>
                {accounts.length === 0 ? (
                  <SelectItem value="none" disabled>لا توجد محافظ</SelectItem>
                ) : (
                  accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      <div className="flex items-center gap-2">
                        <Wallet className="size-3.5 text-muted-foreground" />
                        {a.name}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>ملاحظة (اختياري)</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="ماذا اشتريت؟" maxLength={300} />
          </div>

          <div className="space-y-1.5">
            <Label>صورة الفاتورة (اختياري)</Label>
            {receiptUrl ? (
              <div className="relative rounded-xl overflow-hidden border bg-secondary">
                {/* eslint-disable-next-line jsx-a11y/img-redundant-alt */}
                <img src={receiptUrl} alt="صورة الفاتورة" className="w-full max-h-48 object-contain" />
                <button onClick={removeReceipt} className="absolute top-2 left-2 size-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80">
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-1 p-4 rounded-xl border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors">
                {uploading ? (
                  <div className="text-xs text-muted-foreground">جاري الرفع...</div>
                ) : (
                  <>
                    <div className="size-10 rounded-xl bg-secondary text-primary flex items-center justify-center">
                      {receiptPath ? <ImageIcon className="size-5" /> : <Paperclip className="size-5" />}
                    </div>
                    <div className="text-xs text-muted-foreground">انقر لرفع صورة الفاتورة</div>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
                />
              </label>
            )}
          </div>

          <Button onClick={submit} disabled={busy || uploading} className="w-full bg-gradient-primary text-primary-foreground shadow-glow">
            {busy ? "..." : editing ? "حفظ التعديلات" : "حفظ المصروف"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
