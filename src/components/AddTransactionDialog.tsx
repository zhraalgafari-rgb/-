import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TrendingUp, TrendingDown, Check, ChevronDown, Paperclip, X, FileText, ImageIcon, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { AmountInput } from "@/components/AmountInput";
import { AttachmentsManager } from "@/components/AttachmentsManager";
import { PersonSelector } from "@/components/PersonSelector";
import { useAddTransaction } from "@/hooks/useAddTransaction";

interface Person { id: string; name: string }
interface Currency { id: string; name: string; is_base: boolean; rate?: number }
interface Account { id: string; name: string; is_default: boolean }

interface EditingTx {
  id: string;
  person_id: string;
  account_id?: string | null;
  amount: number;
  direction: string;
  currency_id: string;
  details: string | null;
  transaction_date: string;
  due_date?: string | null;
}

interface Prefill {
  newName?: string;
  amount?: number;
  direction?: "credit" | "debit";
  details?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  people: Person[];
  currencies: Currency[];
  onSuccess: () => void;
  defaultPersonId?: string;
  accounts?: Account[];
  editing?: EditingTx | null;
  prefill?: Prefill | null;
}

export function AddTransactionDialog({ open, onOpenChange, people, currencies, accounts = [], onSuccess, defaultPersonId, editing, prefill }: Props) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const {
    personId, setPersonId,
    newName, setNewName,
    amount, setAmount,
    details, setDetails,
    direction, setDirection,
    currencyId, setCurrencyId,
    accountId, setAccountId,
    date, setDate,
    dueDate, setDueDate,
    busy,
    pendingFile, setPendingFile,
    submit
  } = useAddTransaction({
    open,
    user,
    editing,
    prefill,
    currencies,
    accounts,
    people,
    defaultPersonId,
    onSuccess,
    onOpenChange,
  });

  const selectedPerson = people.find((p) => p.id === personId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right">{editing ? "تعديل معاملة" : "إضافة معاملة"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>الشخص</Label>
            <PersonSelector
              people={people}
              personId={personId}
              setPersonId={setPersonId}
              newName={newName}
              setNewName={setNewName}
              disabled={!!editing}
            />
          </div>

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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>التاريخ والوقت</Label>
              <Input type="datetime-local" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>تاريخ الاستحقاق (اختياري)</Label>
              <Input type="date" dir="ltr" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
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
            <Label>التفاصيل (اختياري)</Label>
            <Textarea rows={2} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="مثلاً: ماء ديتر وكاله" maxLength={500} />
          </div>

          <RadioGroup value={direction} onValueChange={(v) => setDirection(v as "credit" | "debit")} className="grid grid-cols-2 gap-2">
            <label className={`flex items-center justify-center gap-2 rounded-xl border-2 p-3 cursor-pointer transition-all ${direction === "credit" ? "border-success bg-success-soft text-success" : "border-border"}`}>
              <RadioGroupItem value="credit" className="sr-only" />
              <TrendingUp className="size-4" /> له (دائن)
            </label>
            <label className={`flex items-center justify-center gap-2 rounded-xl border-2 p-3 cursor-pointer transition-all ${direction === "debit" ? "border-danger bg-danger-soft text-danger" : "border-border"}`}>
              <RadioGroupItem value="debit" className="sr-only" />
              <TrendingDown className="size-4" /> عليه (مدين)
            </label>
          </RadioGroup>

          {editing ? (
            <div className="pt-2 border-t">
              <AttachmentsManager entityType="transaction" entityId={editing.id} />
            </div>
          ) : (
            <div className="pt-2 border-t space-y-1.5">
              <Label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <Paperclip className="size-3.5" /> إرفاق مستند (اختياري — فاتورة، سند، صورة)
              </Label>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept="image/*,application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 5 * 1024 * 1024) { toast.error("الحد الأقصى 5MB"); return; }
                  setPendingFile(f);
                }}
              />
              {pendingFile ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border-2 border-primary/30 bg-primary/5 px-2.5 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {pendingFile.type.startsWith("image/") ? <ImageIcon className="size-4 text-primary shrink-0" /> : <FileText className="size-4 text-primary shrink-0" />}
                    <div className="min-w-0">
                      <div className="text-[12px] font-medium truncate">{pendingFile.name}</div>
                      <div className="text-[10px] text-muted-foreground">{(pendingFile.size / 1024).toFixed(1)} KB</div>
                    </div>
                  </div>
                  <button type="button" onClick={() => { setPendingFile(null); if (fileRef.current) fileRef.current.value = ""; }} className="p-1 rounded hover:bg-danger/10 text-danger shrink-0">
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary px-3 py-3 text-[12px] font-medium transition-colors"
                >
                  <Paperclip className="size-4" />
                  اختر ملفاً للرفع (PDF أو صورة، حد أقصى 5MB)
                </button>
              )}
            </div>
          )}

          <Button onClick={submit} disabled={busy} className="w-full bg-gradient-primary text-primary-foreground shadow-glow">
            {busy ? "..." : editing ? "حفظ التعديلات" : "حفظ المعاملة"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
